#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * approval-loop.mjs — interactive Approval Loop (ADR-0003).
 *
 * Reads findings.json, walks each Finding one at a time (accept / edit /
 * skip), and writes approved.json containing only the accepted and edited
 * Findings. State is persisted to `<cwd>/.unic-pr-review/<key>/state.json`
 * after every decision so the loop is resumable across Ctrl-C.
 *
 * Non-TTY guard: exits 2 when stdin is not a TTY and --yes is absent, so
 * the plugin never silently posts unreviewed Findings in CI.
 *
 * CLI flags:
 *   --findings <path>        input Findings JSON file
 *   --approved <path>        output approved-Findings JSON file
 *   --key <key>              16-char hex state-dir key
 *   --head-sha <sha>         current HEAD commit SHA (for resume mismatch guard)
 *   --mode <mode>            review mode stored in state
 *   --plugin-version <ver>   plugin version stored in state
 *   --iteration <n>          optional iteration number stored in state
 *   --yes                    bulk-accept all Findings without prompting
 *   --reset                  force fresh state even when head-SHA mismatches
 */

import { createHash } from 'node:crypto'
import {
	existsSync as realExistsSync,
	mkdirSync as realMkdirSync,
	readFileSync as realReadFile,
	renameSync as realRename,
	writeFileSync as realWriteFile,
} from 'node:fs'
import { join } from 'node:path'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import { parseArgs } from './lib/args.mjs'
import { getApprovalStateDir } from './lib/cache-paths.mjs'
import { SEVERITY_ORDER } from './lib/severity-bucketer.mjs'

/** @import { CachePathDeps } from './lib/cache-paths.mjs' */

/**
 * @typedef {'pending' | 'accept' | 'edit' | 'skip'} Decision
 */

/**
 * @typedef {Object} LoopFinding
 * @property {string} id
 * @property {string} severity
 * @property {number} confidence
 * @property {string} filePath
 * @property {number} startLine
 * @property {number} [endLine]
 * @property {string} title
 * @property {string} body
 * @property {string} [suggestion]
 * @property {Decision} decision
 * @property {string} [editedBody]
 * @property {string} [decidedAt]
 */

/**
 * @typedef {Object} LoopState
 * @property {string} pluginVersion
 * @property {string} createdAt
 * @property {string} mode
 * @property {string} key
 * @property {string} headSha
 * @property {number} [iteration]
 * @property {LoopFinding[]} findings
 */

/**
 * @typedef {Object} LoopDeps
 * @property {boolean} [isTTY] - whether stdin is a TTY; defaults to process.stdin.isTTY
 * @property {NodeJS.ReadableStream} [stdin] - readable stream; defaults to process.stdin
 * @property {{ write: (s: string) => void }} [stdout] - writable; defaults to process.stdout
 * @property {{ write: (s: string) => void }} [stderr] - writable; defaults to process.stderr
 * @property {(code: number) => never} [exit] - defaults to process.exit
 * @property {(path: string) => boolean} [existsSync]
 * @property {(path: string, options?: { recursive?: boolean }) => void} [mkdirSync]
 * @property {(path: string, encoding: BufferEncoding) => string} [readFile]
 * @property {(path: string, data: string, encoding: BufferEncoding) => void} [writeFile]
 * @property {(from: string, to: string) => void} [renameSync]
 * @property {string} [cwd] - override for process.cwd() used in state dir
 * @property {() => string} [now] - override for new Date().toISOString()
 */

/**
 * @typedef {Object} LoopParams
 * @property {string} findingsPath
 * @property {string} approvedPath
 * @property {string} key
 * @property {string} headSha
 * @property {string} mode
 * @property {string} pluginVersion
 * @property {number} [iteration]
 * @property {boolean} isYes
 * @property {boolean} isReset
 */

/**
 * Derive a stable Finding ID from its content.
 *
 * @param {{ filePath: string, startLine: number, title: string }} f
 * @returns {string}
 */
export function deriveId(f) {
	return createHash('sha256').update(`${f.filePath}:${f.startLine}:${f.title}`, 'utf8').digest('hex').slice(0, 16)
}

/**
 * Sort Findings by the stable ordering rule: severity bucket → file →
 * startLine → stable id.
 *
 * @param {LoopFinding[]} findings
 * @returns {LoopFinding[]}
 */
export function sortFindings(findings) {
	return [...findings].sort((a, b) => {
		const sd = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
		if (sd !== 0) return sd
		const fd = a.filePath.localeCompare(b.filePath)
		if (fd !== 0) return fd
		if (a.startLine !== b.startLine) return a.startLine - b.startLine
		return a.id.localeCompare(b.id)
	})
}

/**
 * Build initial LoopState from raw findings and run parameters.
 *
 * @param {object[]} rawFindings - raw objects from findings.json
 * @param {LoopParams} params
 * @param {string} createdAt - ISO timestamp
 * @returns {LoopState}
 */
export function buildInitialState(rawFindings, params, createdAt) {
	/** @type {LoopFinding[]} */
	const findings = rawFindings.map((r) => {
		const raw = /** @type {Record<string, unknown>} */ (r)
		const finding = /** @type {LoopFinding} */ ({
			id: deriveId({
				filePath: String(raw.filePath ?? ''),
				startLine: Number(raw.startLine ?? 0),
				title: String(raw.title ?? ''),
			}),
			severity: String(raw.severity ?? 'minor'),
			confidence: Number(raw.confidence ?? 60),
			filePath: String(raw.filePath ?? ''),
			startLine: Number(raw.startLine ?? 0),
			...(raw.endLine !== undefined && { endLine: Number(raw.endLine) }),
			title: String(raw.title ?? ''),
			body: String(raw.body ?? ''),
			...(raw.suggestion !== undefined && { suggestion: String(raw.suggestion) }),
			decision: 'pending',
		})
		return finding
	})

	return {
		pluginVersion: params.pluginVersion,
		createdAt,
		mode: params.mode,
		key: params.key,
		headSha: params.headSha,
		...(params.iteration !== undefined && { iteration: params.iteration }),
		findings: sortFindings(findings),
	}
}

/**
 * Read and parse a JSON file with descriptive error messages.
 *
 * @param {(path: string, enc: BufferEncoding) => string} readFile
 * @param {string} filePath
 * @param {string} label - human-readable name for error messages
 * @returns {unknown}
 */
function readJson(readFile, filePath, label) {
	let text
	try {
		text = readFile(filePath, 'utf8')
	} catch (err) {
		throw new Error(
			`approval-loop: cannot read ${label} at ${filePath}: ${err instanceof Error ? err.message : String(err)}`
		)
	}
	try {
		return JSON.parse(text)
	} catch (err) {
		throw new Error(
			`approval-loop: ${label} is not valid JSON at ${filePath}: ${err instanceof Error ? err.message : String(err)}`
		)
	}
}

/**
 * Atomically write a JSON file via tmp + rename so a crash mid-write can never
 * leave a partially-written file in place. Used for both `state.json` and the
 * `approved.json` artifact that the posting step consumes.
 *
 * @param {string} filePath
 * @param {unknown} value
 * @param {{ writeFile: LoopDeps['writeFile'], renameSync: LoopDeps['renameSync'] }} deps
 */
function writeJsonAtomic(filePath, value, deps) {
	const write = deps.writeFile ?? realWriteFile
	const rename = deps.renameSync ?? realRename
	const tmp = `${filePath}.tmp`
	write(tmp, JSON.stringify(value, null, 2), 'utf8')
	rename(tmp, filePath)
}

/**
 * Run the interactive Approval Loop.
 *
 * The caller is responsible for providing the state directory key via
 * `params.key`; `getApprovalStateDir` is called internally to derive and
 * create the full directory path.
 *
 * @param {LoopParams} params
 * @param {LoopDeps} [deps]
 * @returns {Promise<void>}
 */
export async function runApprovalLoop(params, deps = {}) {
	const { findingsPath, approvedPath, key, headSha, isYes, isReset } = params

	const isTTY = deps.isTTY !== undefined ? deps.isTTY : Boolean(process.stdin.isTTY)
	const stdin = deps.stdin ?? process.stdin
	const stdout = deps.stdout ?? process.stdout
	const stderr = deps.stderr ?? process.stderr
	const exit = deps.exit ?? /** @type {(code: number) => never} */ (process.exit.bind(process))
	const existsSync = deps.existsSync ?? realExistsSync
	const mkdirSync = deps.mkdirSync ?? realMkdirSync
	const readFile = deps.readFile ?? realReadFile
	const writeFile = deps.writeFile ?? realWriteFile
	const renameSync = deps.renameSync ?? realRename
	const cwd = deps.cwd ?? process.cwd()
	const now = deps.now ?? (() => new Date().toISOString())

	if (!isTTY && !isYes) {
		stderr.write(
			'approval-loop: --post requires an interactive terminal (TTY) or --yes to bulk-accept.\n' +
				'Run with --yes to post all Findings without prompting, or run in a terminal.\n'
		)
		return exit(2)
	}

	const parsedFindings = readJson(readFile, findingsPath, '--findings file')
	if (!Array.isArray(parsedFindings)) {
		stderr.write(
			`approval-loop: findings file must contain a JSON array (got ${typeof parsedFindings}): ${findingsPath}\n`
		)
		return exit(1)
	}
	const rawFindings = /** @type {object[]} */ (parsedFindings)

	const stateDir = getApprovalStateDir(key, {
		cwd,
		existsSync,
		mkdirSync,
		writeFile,
	})
	const statePath = join(stateDir, 'state.json')

	/** @type {LoopState} */
	let state

	// Create a single readline interface shared between the SHA-mismatch prompt
	// (if needed) and the main interactive loop. Creating two interfaces on the
	// same stream causes the first one to buffer and discard data the second one
	// needs, so the interface must be opened once and reused throughout.
	const rl = isYes ? null : readline.createInterface({ input: stdin, terminal: false })
	const lines = rl ? rl[Symbol.asyncIterator]() : null

	try {
		// `--reset` always discards prior state and starts fresh; otherwise reuse
		// the persisted state when it exists.
		if (existsSync(statePath) && !isReset) {
			const existing = /** @type {LoopState} */ (readJson(readFile, statePath, 'state file (use --reset to discard)'))

			if (existing === null || typeof existing !== 'object' || !Array.isArray(existing.findings)) {
				stderr.write(
					`approval-loop: state file is malformed (findings is not an array): ${statePath}\n` +
						`Run with --reset to discard prior state and start fresh.\n`
				)
				return exit(1)
			}

			if (existing.headSha !== headSha) {
				if (!isYes && lines) {
					stdout.write(
						`\napproval-loop: HEAD has changed since this review was generated.\n` +
							`  Prior SHA : ${existing.headSha}\n` +
							`  Current SHA: ${headSha}\n\n` +
							`  [c]ontinue with stale findings  /  [f]resh start (discard prior state): `
					)

					const { value: line } = await lines.next()
					const choice = (line ?? '').trim().toLowerCase().charAt(0)
					state = choice === 'c' ? existing : buildInitialState(rawFindings, params, now())
				} else {
					state = buildInitialState(rawFindings, params, now())
				}
			} else {
				state = existing
			}
		} else {
			state = buildInitialState(rawFindings, params, now())
		}

		writeJsonAtomic(statePath, state, { writeFile, renameSync })

		if (isYes) {
			for (const finding of state.findings) {
				if (finding.decision === 'pending') {
					finding.decision = 'accept'
					finding.decidedAt = now()
				}
			}
			writeJsonAtomic(statePath, state, { writeFile, renameSync })
		} else if (lines) {
			for (const finding of state.findings) {
				if (finding.decision !== 'pending') continue

				stdout.write(
					`\n${'─'.repeat(60)}\n` +
						`[${finding.severity.toUpperCase()}] ${finding.title}\n` +
						`${finding.filePath}:${finding.startLine}\n\n` +
						`${finding.body}\n` +
						(finding.suggestion ? `\nSuggestion:\n${finding.suggestion}\n` : '') +
						`\n[a]ccept / [e]dit / [s]kip: `
				)

				const { value: choiceLine, done } = await lines.next()
				if (done) break

				const choice = (choiceLine ?? '').trim().toLowerCase().charAt(0)

				if (choice === 'e') {
					stdout.write(`\nEdit body (current shown above). Enter replacement or press Enter to keep:\n> `)

					const { value: editLine, done: done2 } = await lines.next()
					if (done2) break

					const edited = (editLine ?? '').trim()
					finding.decision = 'edit'
					finding.editedBody = edited || finding.body
					finding.decidedAt = now()
				} else if (choice === 'a') {
					finding.decision = 'accept'
					finding.decidedAt = now()
				} else {
					finding.decision = 'skip'
					finding.decidedAt = now()
				}

				writeJsonAtomic(statePath, state, { writeFile, renameSync })
			}
		}
	} finally {
		if (rl) rl.close()
	}

	const approved = state.findings.filter((f) => f.decision === 'accept' || f.decision === 'edit')
	writeJsonAtomic(approvedPath, approved, { writeFile, renameSync })

	stdout.write(`\napproval-loop: done. ${approved.length} Finding(s) approved → ${approvedPath}\n`)
}

async function main() {
	let parsed
	try {
		parsed = parseArgs(process.argv.slice(2), { booleanFlags: new Set(['yes', 'reset']) })
	} catch (err) {
		process.stderr.write(`approval-loop: ${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	}

	const {
		findings: findingsPath,
		approved: approvedPath,
		key,
		'head-sha': headSha,
		mode,
		'plugin-version': pluginVersion,
		iteration,
	} = parsed

	for (const [val, flag] of /** @type {[string | undefined, string][]} */ ([
		[findingsPath, '--findings'],
		[approvedPath, '--approved'],
		[key, '--key'],
		[headSha, '--head-sha'],
		[mode, '--mode'],
		[pluginVersion, '--plugin-version'],
	])) {
		if (!val) {
			process.stderr.write(`approval-loop: ${flag} is required\n`)
			process.exit(1)
		}
	}

	await runApprovalLoop({
		findingsPath,
		approvedPath,
		key,
		headSha,
		mode,
		pluginVersion,
		...(iteration !== undefined && { iteration: Number(iteration) }),
		isYes: 'yes' in parsed,
		isReset: 'reset' in parsed,
	})
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`approval-loop: unexpected error: ${err?.message ?? String(err)}\n`)
		process.exit(1)
	})
}
