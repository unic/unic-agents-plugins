// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { describe, it } from 'node:test'
import { buildInitialState, deriveId, runApprovalLoop, sortFindings } from '../scripts/approval-loop.mjs'
import { sha16 } from '../scripts/lib/cache-paths.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `approval-loop-test-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

/** @param {string} input */
function scriptedStdin(input) {
	return Readable.from([input])
}

/** @returns {{ write: (s: string) => void, lines: string[] }} */
function captureOutput() {
	const lines = /** @type {string[]} */ ([])
	return { write: (s) => lines.push(s), lines }
}

const SAMPLE_FINDINGS = [
	{
		severity: 'critical',
		confidence: 95,
		filePath: 'src/auth.ts',
		startLine: 42,
		endLine: 50,
		title: 'Null dereference possible',
		body: 'The token may be undefined here.',
	},
	{
		severity: 'important',
		confidence: 85,
		filePath: 'src/api.ts',
		startLine: 10,
		endLine: 15,
		title: 'Missing error handler',
		body: 'Unhandled promise rejection.',
	},
]

/** @param {object[]} findings @param {string} dir @returns {string} */
function writeFindingsFile(findings, dir) {
	const p = join(dir, 'findings.json')
	writeFileSync(p, JSON.stringify(findings), 'utf8')
	return p
}

/** @param {string} dir @returns {string} */
function approvedPath(dir) {
	return join(dir, 'approved.json')
}

/**
 * @param {{ findingsPath?: string, approvedPath?: string, key?: string, headSha?: string, mode?: string, pluginVersion?: string, isYes?: boolean, isReset?: boolean, iteration?: number, cwd?: string }} params
 * @param {{ isTTY?: boolean, stdin?: NodeJS.ReadableStream, stdout?: { write: (s: string) => void }, stderr?: { write: (s: string) => void }, exit?: (code: number) => never, existsSync?: (p: string) => boolean, mkdirSync?: (p: string, o?: { recursive?: boolean }) => void, readFile?: (p: string, enc: BufferEncoding) => string, writeFile?: (p: string, d: string, enc: BufferEncoding) => void, renameSync?: (from: string, to: string) => void, rmSync?: (p: string, o: { recursive: boolean, force: boolean }) => void, cwd?: string, now?: () => string }} deps
 * @returns {Promise<void>}
 */
function loop(params, deps) {
	return runApprovalLoop(
		{
			findingsPath: params.findingsPath ?? '',
			approvedPath: params.approvedPath ?? '',
			key: params.key ?? sha16('test-pr-url'),
			headSha: params.headSha ?? 'abc123',
			mode: params.mode ?? 'first-review',
			pluginVersion: params.pluginVersion ?? '2.0.0',
			isYes: params.isYes ?? false,
			isReset: params.isReset ?? false,
			...(params.iteration !== undefined && { iteration: params.iteration }),
		},
		{
			isTTY: true,
			stdout: { write: () => {} },
			stderr: { write: () => {} },
			now: () => '2026-06-03T00:00:00.000Z',
			...deps,
		}
	)
}

/** Minimal LoopParams used in buildInitialState unit tests (unused path fields are intentional). */
const BASE_PARAMS = {
	findingsPath: '',
	approvedPath: '',
	key: 'testkey1234abcd0',
	headSha: 'sha1',
	mode: 'first-review',
	pluginVersion: '2.0.0',
	isYes: false,
	isReset: false,
}

const CREATED_AT = '2026-06-03T00:00:00.000Z'

// ─── deriveId ────────────────────────────────────────────────────────────────

describe('deriveId', () => {
	it('returns a 16-char hex string', () => {
		const id = deriveId({ filePath: 'src/foo.ts', startLine: 10, title: 'Bug' })
		assert.match(id, /^[0-9a-f]{16}$/)
	})

	it('is stable across calls with the same input', () => {
		const a = deriveId({ filePath: 'src/foo.ts', startLine: 10, title: 'Bug' })
		const b = deriveId({ filePath: 'src/foo.ts', startLine: 10, title: 'Bug' })
		assert.equal(a, b)
	})

	it('differs when any field differs', () => {
		const base = { filePath: 'src/foo.ts', startLine: 10, title: 'Bug' }
		assert.notEqual(deriveId(base), deriveId({ ...base, startLine: 11 }))
		assert.notEqual(deriveId(base), deriveId({ ...base, filePath: 'src/bar.ts' }))
		assert.notEqual(deriveId(base), deriveId({ ...base, title: 'Other' }))
	})
})

// ─── sortFindings ─────────────────────────────────────────────────────────────

describe('sortFindings', () => {
	it('orders critical before important before minor', () => {
		const findings = /** @type {any[]} */ ([
			{ id: 'a', severity: 'minor', confidence: 65, filePath: 'z.ts', startLine: 1, title: 'T', body: '' },
			{ id: 'b', severity: 'critical', confidence: 95, filePath: 'a.ts', startLine: 1, title: 'T', body: '' },
			{ id: 'c', severity: 'important', confidence: 85, filePath: 'm.ts', startLine: 1, title: 'T', body: '' },
		])
		const sorted = sortFindings(findings)
		assert.equal(sorted[0].severity, 'critical')
		assert.equal(sorted[1].severity, 'important')
		assert.equal(sorted[2].severity, 'minor')
	})

	it('within same severity, orders by filePath then startLine then id', () => {
		const findings = /** @type {any[]} */ ([
			{ id: 'z', severity: 'critical', confidence: 95, filePath: 'a.ts', startLine: 20, title: 'T', body: '' },
			{ id: 'a', severity: 'critical', confidence: 95, filePath: 'a.ts', startLine: 5, title: 'T', body: '' },
			{ id: 'b', severity: 'critical', confidence: 95, filePath: 'b.ts', startLine: 1, title: 'T', body: '' },
		])
		const sorted = sortFindings(findings)
		assert.equal(sorted[0].id, 'a')
		assert.equal(sorted[1].id, 'z')
		assert.equal(sorted[2].id, 'b')
	})

	it('does not mutate the input array', () => {
		const findings = /** @type {any[]} */ ([
			{ id: 'z', severity: 'minor', confidence: 65, filePath: 'z.ts', startLine: 1, title: 'T', body: '' },
			{ id: 'a', severity: 'critical', confidence: 95, filePath: 'a.ts', startLine: 1, title: 'T', body: '' },
		])
		sortFindings(findings)
		assert.equal(findings[0].id, 'z')
	})
})

// ─── buildInitialState ────────────────────────────────────────────────────────

describe('buildInitialState', () => {
	it('all findings start as pending', () => {
		const state = buildInitialState(SAMPLE_FINDINGS, BASE_PARAMS, CREATED_AT)
		assert.equal(
			state.findings.every((f) => f.decision === 'pending'),
			true
		)
	})

	it('assigns stable id to each finding', () => {
		const state = buildInitialState(SAMPLE_FINDINGS, BASE_PARAMS, CREATED_AT)
		assert.equal(
			state.findings.every((f) => /^[0-9a-f]{16}$/.test(f.id)),
			true
		)
	})

	it('findings are sorted by severity bucket', () => {
		const state = buildInitialState(SAMPLE_FINDINGS, BASE_PARAMS, CREATED_AT)
		assert.equal(state.findings[0].severity, 'critical')
		assert.equal(state.findings[1].severity, 'important')
	})

	it('state shape contains all required fields', () => {
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{ ...BASE_PARAMS, key: 'deadbeef01234567', headSha: 'abc123' },
			CREATED_AT
		)
		assert.equal(state.pluginVersion, '2.0.0')
		assert.equal(state.createdAt, CREATED_AT)
		assert.equal(state.mode, 'first-review')
		assert.equal(state.key, 'deadbeef01234567')
		assert.equal(state.headSha, 'abc123')
		assert.equal(Array.isArray(state.findings), true)
	})

	it('includes endLine when present in raw finding', () => {
		const state = buildInitialState(SAMPLE_FINDINGS, { ...BASE_PARAMS, key: 'key', headSha: 'sha' }, CREATED_AT)
		assert.equal(state.findings[0].endLine, 50)
	})

	it('includes iteration when provided', () => {
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{ ...BASE_PARAMS, key: 'key', headSha: 'sha', iteration: 3 },
			CREATED_AT
		)
		assert.equal(state.iteration, 3)
	})
})

// ─── non-TTY abort ────────────────────────────────────────────────────────────

describe('non-TTY abort', () => {
	it('exits 2 when isTTY is false and isYes is false', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		let exitCode = /** @type {number | null} */ (null)
		const stderrLines = /** @type {string[]} */ ([])

		await runApprovalLoop(
			{
				findingsPath: fp,
				approvedPath: approvedPath(dir),
				key: sha16('test'),
				headSha: 'abc',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: false,
				isReset: false,
			},
			{
				isTTY: false,
				stdin: scriptedStdin(''),
				stdout: { write: () => {} },
				stderr: { write: (s) => stderrLines.push(s) },
				exit: (code) => {
					exitCode = code
					throw new Error(`exit:${code}`)
				},
				cwd: dir,
				now: () => '2026-06-03T00:00:00.000Z',
			}
		).catch((err) => {
			if (!String(err.message).startsWith('exit:')) throw err
		})

		assert.equal(exitCode, 2)
		assert.ok(stderrLines.some((l) => /TTY|--yes/i.test(l)))
	})

	it('proceeds when isTTY is false but isYes is true', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, isYes: true, cwd: dir }, { isTTY: false, cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 2)
	})
})

// ─── --yes bulk-accept ────────────────────────────────────────────────────────

describe('--yes bulk-accept', () => {
	it('accepts all findings and writes approved.json', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, isYes: true, cwd: dir }, { cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 2)
		assert.ok(approved.every(/** @param {any} f */ (f) => f.decision === 'accept'))
	})

	it('state.json has all decisions as accept (not pending)', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const key = sha16('yes-test')
		const out = approvedPath(dir)

		// Inject fs to capture state writes
		const writes = /** @type {Record<string, string>} */ ({})
		const renames = /** @type {[string, string][]} */ ([])

		await runApprovalLoop(
			{
				findingsPath: fp,
				approvedPath: out,
				key,
				headSha: 'abc',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: true,
				isReset: false,
			},
			{
				isTTY: false,
				stdout: { write: () => {} },
				stderr: { write: () => {} },
				now: () => '2026-06-03T00:00:00.000Z',
				cwd: dir,
				writeFile: (p, data) => {
					writes[p] = String(data)
					writeFileSync(p, data, 'utf8')
				},
				renameSync: (from, to) => {
					renames.push([from, to])
					renameSync(from, to)
				},
			}
		).catch(() => {})

		// The last persisted state (written to the tmp path before the final
		// rename) must carry accept decisions, not pending — the premise this
		// test's name promises.
		const stateDir = join(dir, '.unic-pr-review', key)
		const statePath = join(stateDir, 'state.json')
		const lastState = JSON.parse(writes[`${statePath}.tmp`])
		assert.ok(
			lastState.findings.every(/** @param {any} f */ (f) => f.decision === 'accept'),
			'every decision persisted as accept'
		)
		// State dir must survive — orchestrator owns cleanup (ADR-0014)
		assert.ok(existsSync(stateDir), 'state dir survives for orchestrator to gate deletion on ADO write success')
	})

	it('--yes with real temp dirs: state file written, state dir survives for orchestrator', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const key = sha16('yes-cleanup-test')
		const out = approvedPath(dir)
		const stateDir = join(dir, '.unic-pr-review', key)

		await loop({ findingsPath: fp, approvedPath: out, isYes: true, key, cwd: dir }, { cwd: dir })

		// State dir must survive — orchestrator owns cleanup (ADR-0014)
		assert.ok(existsSync(stateDir), 'state dir survives for orchestrator to gate deletion on ADO write success')
		// approved.json must exist
		assert.ok(existsSync(out))
	})
})

// ─── accept/edit/skip transitions ─────────────────────────────────────────────

describe('accept transition', () => {
	it('accepted finding appears in approved.json with decision: accept', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, cwd: dir }, { stdin: scriptedStdin('a\n'), cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].decision, 'accept')
		assert.equal(approved[0].title, SAMPLE_FINDINGS[0].title)
	})

	it('decidedAt is set on accepted finding', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, cwd: dir }, { stdin: scriptedStdin('a\n'), cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved[0].decidedAt, '2026-06-03T00:00:00.000Z')
	})
})

describe('edit transition', () => {
	it('edited finding appears in approved.json with editedBody set', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)

		await loop(
			{ findingsPath: fp, approvedPath: out, cwd: dir },
			{ stdin: scriptedStdin('e\nReplacement body text\n'), cwd: dir }
		)

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].decision, 'edit')
		assert.equal(approved[0].editedBody, 'Replacement body text')
	})

	it('empty edit line keeps original body', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, cwd: dir }, { stdin: scriptedStdin('e\n\n'), cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved[0].editedBody, SAMPLE_FINDINGS[0].body)
	})
})

describe('skip transition', () => {
	it('skipped finding is absent from approved.json', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, cwd: dir }, { stdin: scriptedStdin('s\n'), cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 0)
	})

	it('mixed a/e/s across two findings: only accepted and edited go to approved.json', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const out = approvedPath(dir)

		// critical first (a), then important (s)
		await loop({ findingsPath: fp, approvedPath: out, cwd: dir }, { stdin: scriptedStdin('a\ns\n'), cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].severity, 'critical')
	})
})

// ─── resume from partial state ────────────────────────────────────────────────

describe('resume from partial state', () => {
	it('skips non-pending findings and continues with remaining pending ones', async () => {
		const dir = tempDir()
		const key = sha16('resume-test-pr')
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const out = approvedPath(dir)

		// Seed state with first finding already accepted
		const stateDir = join(dir, '.unic-pr-review', key)
		mkdirSync(stateDir, { recursive: true })
		writeFileSync(join(dir, '.unic-pr-review', '.gitignore'), '*\n', 'utf8')

		const seededState = {
			pluginVersion: '2.0.0',
			createdAt: '2026-06-03T00:00:00.000Z',
			mode: 'first-review',
			key,
			headSha: 'abc123',
			findings: buildInitialState(
				SAMPLE_FINDINGS,
				{
					findingsPath: fp,
					approvedPath: out,
					key,
					headSha: 'abc123',
					mode: 'first-review',
					pluginVersion: '2.0.0',
					isYes: false,
					isReset: false,
				},
				'2026-06-03T00:00:00.000Z'
			).findings.map((f, i) => (i === 0 ? { ...f, decision: 'accept', decidedAt: '2026-06-03T00:00:00.000Z' } : f)),
		}
		writeFileSync(join(stateDir, 'state.json'), JSON.stringify(seededState, null, 2), 'utf8')

		// Resume: only the second finding (important/pending) needs input
		await loop(
			{ findingsPath: fp, approvedPath: out, key, headSha: 'abc123', cwd: dir },
			{ stdin: scriptedStdin('s\n'), cwd: dir }
		)

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		// First was pre-accepted, second was skipped → only 1 in approved
		assert.equal(approved.length, 1)
		assert.equal(approved[0].severity, 'critical')
	})
})

/**
 * Write a seeded state.json to disk with all findings set to a given decision.
 *
 * @param {string} stateDir
 * @param {string} key
 * @param {string} fp - findings file path (used for LoopParams only)
 * @param {string} out - approved file path (used for LoopParams only)
 * @param {'accept' | 'skip'} decision
 * @param {string} [headSha]
 */
function seedStateFile(stateDir, key, fp, out, decision, headSha = 'old-sha') {
	mkdirSync(stateDir, { recursive: true })
	writeFileSync(join(stateDir, '..', '.gitignore'), '*\n', 'utf8')
	const params = { ...BASE_PARAMS, findingsPath: fp, approvedPath: out, key, headSha }
	const findings = buildInitialState([SAMPLE_FINDINGS[0]], params, CREATED_AT).findings.map((f) => ({
		...f,
		decision,
		decidedAt: CREATED_AT,
	}))
	const state = { pluginVersion: '2.0.0', createdAt: CREATED_AT, mode: 'first-review', key, headSha, findings }
	writeFileSync(join(stateDir, 'state.json'), JSON.stringify(state, null, 2), 'utf8')
}

// ─── head-SHA mismatch prompt ─────────────────────────────────────────────────

describe('head-SHA mismatch', () => {
	it('prompts user on mismatch; choosing "f" (fresh) starts over', async () => {
		const dir = tempDir()
		const key = sha16('mismatch-test')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		seedStateFile(join(dir, '.unic-pr-review', key), key, fp, out, 'skip')
		const outputLines = captureOutput()

		// 'f' = fresh start, then 'a' = accept the finding
		await loop(
			{ findingsPath: fp, approvedPath: out, key, headSha: 'new-sha', cwd: dir },
			{ stdin: scriptedStdin('f\na\n'), stdout: outputLines, cwd: dir }
		)

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].decision, 'accept')
	})

	it('prompts user on mismatch; choosing "c" (continue) resumes with stale findings', async () => {
		const dir = tempDir()
		const key = sha16('mismatch-continue')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		seedStateFile(join(dir, '.unic-pr-review', key), key, fp, out, 'accept')

		// 'c' = continue with stale findings (all already decided, no more prompts needed)
		await loop(
			{ findingsPath: fp, approvedPath: out, key, headSha: 'new-sha', cwd: dir },
			{ stdin: scriptedStdin('c\n'), cwd: dir }
		)

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].decision, 'accept')
	})

	it('--reset forces fresh start without prompting', async () => {
		const dir = tempDir()
		const key = sha16('reset-test')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		seedStateFile(join(dir, '.unic-pr-review', key), key, fp, out, 'skip')

		// --reset + 'a' = no prompt, fresh start, accept
		await loop(
			{ findingsPath: fp, approvedPath: out, key, headSha: 'new-sha', isReset: true, cwd: dir },
			{ stdin: scriptedStdin('a\n'), cwd: dir }
		)

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].decision, 'accept')
	})
})

// ─── state file persistence ───────────────────────────────────────────────────

describe('state persistence', () => {
	it('state.json is written after each decision', async () => {
		const dir = tempDir()
		const key = sha16('state-persist-test')
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const out = approvedPath(dir)

		const stateWrites = /** @type {string[]} */ ([])

		await runApprovalLoop(
			{
				findingsPath: fp,
				approvedPath: out,
				key,
				headSha: 'abc',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: false,
				isReset: false,
			},
			{
				isTTY: true,
				stdin: scriptedStdin('a\ns\n'),
				stdout: { write: () => {} },
				stderr: { write: () => {} },
				now: () => '2026-06-03T00:00:00.000Z',
				cwd: dir,
				writeFile: (p, data, enc) => {
					if (String(p).endsWith('state.json.tmp')) stateWrites.push(String(data))
					writeFileSync(p, data, enc)
				},
				renameSync: (from, to) => renameSync(from, to),
			}
		)

		// state.json.tmp is written on init + after each decision: 1 (init) + N (decisions)
		assert.ok(stateWrites.length >= 3)
	})

	it('state.json directory persists after completion (orchestrator owns cleanup — ADR-0014)', async () => {
		const dir = tempDir()
		const key = sha16('cleanup-test')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		const stateDir = join(dir, '.unic-pr-review', key)

		await loop({ findingsPath: fp, approvedPath: out, key, cwd: dir }, { stdin: scriptedStdin('a\n'), cwd: dir })

		assert.ok(existsSync(stateDir), 'state dir survives for orchestrator to gate deletion on ADO write success')
	})

	it('gitignore is created in .unic-pr-review/ root on first use', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		const gitignorePath = join(dir, '.unic-pr-review', '.gitignore')

		assert.ok(!existsSync(gitignorePath), 'gitignore absent before first run')

		await loop({ findingsPath: fp, approvedPath: out, isYes: true, cwd: dir }, { isTTY: false, cwd: dir })

		assert.ok(existsSync(gitignorePath), 'gitignore written on first use')
		const content = readFileSync(gitignorePath, 'utf8')
		assert.equal(content.trim(), '*')
	})
})

// ─── edge-case: unrecognised input character ──────────────────────────────────

describe('unknown input character', () => {
	it('treats unrecognised input as skip (current behaviour)', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)

		// 'x' is not 'a', 'e', or 's' — falls to the else branch → skip
		await loop({ findingsPath: fp, approvedPath: out, cwd: dir }, { stdin: scriptedStdin('x\n'), cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 0, 'unrecognised input treated as skip')
	})
})

// ─── edge-case: empty findings array ─────────────────────────────────────────

describe('empty findings array', () => {
	it('--yes with zero findings writes empty approved.json', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([], dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, isYes: true, cwd: dir }, { isTTY: false, cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.deepEqual(approved, [])
	})
})

// ─── edge-case: suggestion field rendering ────────────────────────────────────

describe('suggestion field rendering', () => {
	it('renders Suggestion: block in stdout when finding has suggestion', async () => {
		const dir = tempDir()
		const findingWithSuggestion = {
			...SAMPLE_FINDINGS[0],
			suggestion: 'Use optional chaining: token?.value',
		}
		const fp = writeFindingsFile([findingWithSuggestion], dir)
		const out = approvedPath(dir)
		const outputLines = captureOutput()

		await loop(
			{ findingsPath: fp, approvedPath: out, cwd: dir },
			{ stdin: scriptedStdin('a\n'), stdout: outputLines, cwd: dir }
		)

		const allOutput = outputLines.lines.join('')
		assert.ok(allOutput.includes('Suggestion:'), 'Suggestion: block rendered when suggestion field present')
		assert.ok(allOutput.includes('Use optional chaining: token?.value'), 'suggestion text rendered')
	})

	it('omits Suggestion: block when finding has no suggestion', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		const outputLines = captureOutput()

		await loop(
			{ findingsPath: fp, approvedPath: out, cwd: dir },
			{ stdin: scriptedStdin('a\n'), stdout: outputLines, cwd: dir }
		)

		const allOutput = outputLines.lines.join('')
		assert.ok(!allOutput.includes('Suggestion:'), 'Suggestion: block absent when no suggestion field')
	})
})

// ─── input validation & robustness ───────────────────────────────────────────

describe('input validation', () => {
	it('exits 1 when the findings file is not a JSON array', async () => {
		const dir = tempDir()
		const fp = join(dir, 'findings.json')
		writeFileSync(fp, JSON.stringify({ not: 'an array' }), 'utf8')
		let exitCode = /** @type {number | null} */ (null)
		const stderrLines = /** @type {string[]} */ ([])

		await loop(
			{ findingsPath: fp, approvedPath: approvedPath(dir), isYes: true, cwd: dir },
			{
				isTTY: false,
				cwd: dir,
				stderr: { write: (s) => stderrLines.push(s) },
				exit: (code) => {
					exitCode = code
					throw new Error(`exit:${code}`)
				},
			}
		).catch((err) => {
			if (!String(err.message).startsWith('exit:')) throw err
		})

		assert.equal(exitCode, 1)
		assert.ok(stderrLines.some((l) => /must contain a JSON array/.test(l)))
	})

	it('exits 1 when the resumed state file is malformed', async () => {
		const dir = tempDir()
		const key = sha16('malformed-state')
		const stateDir = join(dir, '.unic-pr-review', key)
		mkdirSync(stateDir, { recursive: true })
		writeFileSync(join(stateDir, 'state.json'), JSON.stringify({ findings: 'not-an-array' }), 'utf8')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		let exitCode = /** @type {number | null} */ (null)
		const stderrLines = /** @type {string[]} */ ([])

		await loop(
			{ findingsPath: fp, approvedPath: approvedPath(dir), key, isYes: true, cwd: dir },
			{
				isTTY: false,
				cwd: dir,
				stderr: { write: (s) => stderrLines.push(s) },
				exit: (code) => {
					exitCode = code
					throw new Error(`exit:${code}`)
				},
			}
		).catch((err) => {
			if (!String(err.message).startsWith('exit:')) throw err
		})

		assert.equal(exitCode, 1)
		assert.ok(stderrLines.some((l) => /malformed/.test(l)))
	})

	it('--reset rescues a malformed state file by starting fresh', async () => {
		const dir = tempDir()
		const key = sha16('reset-malformed')
		const stateDir = join(dir, '.unic-pr-review', key)
		mkdirSync(stateDir, { recursive: true })
		writeFileSync(join(stateDir, 'state.json'), JSON.stringify({ findings: 'not-an-array' }), 'utf8')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)

		await loop({ findingsPath: fp, approvedPath: out, key, isYes: true, isReset: true, cwd: dir }, { cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].decision, 'accept')
	})
})

describe('head-SHA mismatch under --yes', () => {
	it('starts fresh without prompting when state is stale and --yes is set', async () => {
		const dir = tempDir()
		const key = sha16('yes-mismatch')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		// Seed stale state where the finding was previously skipped.
		seedStateFile(join(dir, '.unic-pr-review', key), key, fp, out, 'skip')

		await loop(
			{ findingsPath: fp, approvedPath: out, key, headSha: 'new-sha', isYes: true, cwd: dir },
			{ isTTY: false, cwd: dir }
		)

		// Fresh start ignores the stale skip and bulk-accepts.
		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1)
		assert.equal(approved[0].decision, 'accept')
	})
})

describe('early stream close (Ctrl-D)', () => {
	it('writes a partial approved.json from decisions made before EOF', async () => {
		// Documents current behaviour: when stdin closes mid-walk, the loop breaks
		// and finalises whatever was decided so far. Resumability across an
		// interrupted session relies on Ctrl-C (SIGINT), not Ctrl-D (stream EOF).
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const out = approvedPath(dir)

		// Decide the first finding ('a'), then the stream ends before the second.
		await loop({ findingsPath: fp, approvedPath: out, cwd: dir }, { stdin: scriptedStdin('a\n'), cwd: dir })

		const approved = JSON.parse(readFileSync(out, 'utf8'))
		assert.equal(approved.length, 1, 'only the pre-EOF decision is approved')
		assert.equal(approved[0].decision, 'accept')
	})
})

describe('atomic & best-effort I/O', () => {
	it('writes approved.json atomically via tmp + rename', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		const renames = /** @type {[string, string][]} */ ([])

		await loop(
			{ findingsPath: fp, approvedPath: out, isYes: true, cwd: dir },
			{
				isTTY: false,
				cwd: dir,
				writeFile: (p, d, enc) => writeFileSync(p, d, enc),
				renameSync: (from, to) => {
					renames.push([from, to])
					renameSync(from, to)
				},
			}
		)

		assert.ok(
			renames.some(([from, to]) => from === `${out}.tmp` && to === out),
			'approved.json is produced by a tmp → final rename'
		)
		assert.equal(JSON.parse(readFileSync(out, 'utf8')).length, 1)
	})

	it('does NOT delete the state directory (ADR-0014: orchestrator owns cleanup)', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		const key = sha16('test-pr-url') // same default key used by loop()

		await loop(
			{ findingsPath: fp, approvedPath: out, isYes: true, cwd: dir },
			{ isTTY: false, cwd: dir },
		)

		// The approval landed and the state dir is still present for the orchestrator.
		assert.equal(JSON.parse(readFileSync(out, 'utf8')).length, 1)
		const stateDir = join(dir, '.unic-pr-review', key)
		assert.ok(existsSync(stateDir), 'state dir must survive so orchestrator can gate deletion on ADO write success')
	})
})

// ─── sha16 (re-exported from cache-paths) ────────────────────────────────────

describe('sha16', () => {
	it('returns a 16-char lowercase hex string', () => {
		const k = sha16('https://dev.azure.com/org/_git/repo/pullrequest/123')
		assert.match(k, /^[0-9a-f]{16}$/)
	})

	it('is stable across calls', () => {
		assert.equal(sha16('same-input'), sha16('same-input'))
	})

	it('differs for different inputs', () => {
		assert.notEqual(sha16('pr-url-1'), sha16('pr-url-2'))
	})

	it('uses different values for ADO mode vs Pre-PR mode convention', () => {
		const ado = sha16('https://dev.azure.com/org/_git/repo/pullrequest/99')
		const prePr = sha16('/Users/me/project main')
		assert.notEqual(ado, prePr)
	})
})
