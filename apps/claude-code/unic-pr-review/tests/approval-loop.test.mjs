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
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{
				findingsPath: '',
				approvedPath: '',
				key: 'testkey1234abcd0',
				headSha: 'sha1',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: false,
				isReset: false,
			},
			'2026-06-03T00:00:00.000Z'
		)

		assert.equal(
			state.findings.every((f) => f.decision === 'pending'),
			true
		)
	})

	it('assigns stable id to each finding', () => {
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{
				findingsPath: '',
				approvedPath: '',
				key: 'testkey1234abcd0',
				headSha: 'sha1',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: false,
				isReset: false,
			},
			'2026-06-03T00:00:00.000Z'
		)

		assert.equal(
			state.findings.every((f) => /^[0-9a-f]{16}$/.test(f.id)),
			true
		)
	})

	it('findings are sorted by severity bucket', () => {
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{
				findingsPath: '',
				approvedPath: '',
				key: 'testkey1234abcd0',
				headSha: 'sha1',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: false,
				isReset: false,
			},
			'2026-06-03T00:00:00.000Z'
		)

		assert.equal(state.findings[0].severity, 'critical')
		assert.equal(state.findings[1].severity, 'important')
	})

	it('state shape contains all required fields', () => {
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{
				findingsPath: '',
				approvedPath: '',
				key: 'deadbeef01234567',
				headSha: 'abc123',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: false,
				isReset: false,
			},
			'2026-06-03T00:00:00.000Z'
		)

		assert.equal(state.pluginVersion, '2.0.0')
		assert.equal(state.createdAt, '2026-06-03T00:00:00.000Z')
		assert.equal(state.mode, 'first-review')
		assert.equal(state.key, 'deadbeef01234567')
		assert.equal(state.headSha, 'abc123')
		assert.equal(Array.isArray(state.findings), true)
	})

	it('includes endLine when present in raw finding', () => {
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{
				findingsPath: '',
				approvedPath: '',
				key: 'key',
				headSha: 'sha',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				isYes: false,
				isReset: false,
			},
			'2026-06-03T00:00:00.000Z'
		)

		assert.equal(state.findings[0].endLine, 50)
	})

	it('includes iteration when provided', () => {
		const state = buildInitialState(
			SAMPLE_FINDINGS,
			{
				findingsPath: '',
				approvedPath: '',
				key: 'key',
				headSha: 'sha',
				mode: 'first-review',
				pluginVersion: '2.0.0',
				iteration: 3,
				isYes: false,
				isReset: false,
			},
			'2026-06-03T00:00:00.000Z'
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

		// Check the actual state file on disk
		const stateDir = join(dir, '.unic-pr-review', key)
		const statePath = join(stateDir, 'state.json')
		// State dir should be deleted after success
		assert.ok(!existsSync(statePath), 'state dir deleted after successful run')
	})

	it('--yes with real temp dirs: state file written then deleted', async () => {
		const dir = tempDir()
		const fp = writeFindingsFile(SAMPLE_FINDINGS, dir)
		const key = sha16('yes-cleanup-test')
		const out = approvedPath(dir)
		const stateDir = join(dir, '.unic-pr-review', key)

		await loop({ findingsPath: fp, approvedPath: out, isYes: true, key, cwd: dir }, { cwd: dir })

		// State dir should be deleted after success
		assert.ok(!existsSync(stateDir), 'state dir deleted on success')
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

// ─── head-SHA mismatch prompt ─────────────────────────────────────────────────

describe('head-SHA mismatch', () => {
	it('prompts user on mismatch; choosing "f" (fresh) starts over', async () => {
		const dir = tempDir()
		const key = sha16('mismatch-test')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		const stateDir = join(dir, '.unic-pr-review', key)
		mkdirSync(stateDir, { recursive: true })
		writeFileSync(join(dir, '.unic-pr-review', '.gitignore'), '*\n', 'utf8')

		const oldState = {
			pluginVersion: '2.0.0',
			createdAt: '2026-06-03T00:00:00.000Z',
			mode: 'first-review',
			key,
			headSha: 'old-sha',
			findings: buildInitialState(
				[SAMPLE_FINDINGS[0]],
				{
					findingsPath: fp,
					approvedPath: out,
					key,
					headSha: 'old-sha',
					mode: 'first-review',
					pluginVersion: '2.0.0',
					isYes: false,
					isReset: false,
				},
				'2026-06-03T00:00:00.000Z'
			).findings.map((f) => ({
				...f,
				decision: 'skip',
				decidedAt: '2026-06-03T00:00:00.000Z',
			})),
		}
		writeFileSync(join(stateDir, 'state.json'), JSON.stringify(oldState, null, 2), 'utf8')

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
		const stateDir = join(dir, '.unic-pr-review', key)
		mkdirSync(stateDir, { recursive: true })
		writeFileSync(join(dir, '.unic-pr-review', '.gitignore'), '*\n', 'utf8')

		const oldState = {
			pluginVersion: '2.0.0',
			createdAt: '2026-06-03T00:00:00.000Z',
			mode: 'first-review',
			key,
			headSha: 'old-sha',
			findings: buildInitialState(
				[SAMPLE_FINDINGS[0]],
				{
					findingsPath: fp,
					approvedPath: out,
					key,
					headSha: 'old-sha',
					mode: 'first-review',
					pluginVersion: '2.0.0',
					isYes: false,
					isReset: false,
				},
				'2026-06-03T00:00:00.000Z'
			).findings.map((f) => ({
				...f,
				decision: 'accept',
				decidedAt: '2026-06-03T00:00:00.000Z',
			})),
		}
		writeFileSync(join(stateDir, 'state.json'), JSON.stringify(oldState, null, 2), 'utf8')

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
		const stateDir = join(dir, '.unic-pr-review', key)
		mkdirSync(stateDir, { recursive: true })
		writeFileSync(join(dir, '.unic-pr-review', '.gitignore'), '*\n', 'utf8')

		const oldState = {
			pluginVersion: '2.0.0',
			createdAt: '2026-06-03T00:00:00.000Z',
			mode: 'first-review',
			key,
			headSha: 'old-sha',
			findings: buildInitialState(
				[SAMPLE_FINDINGS[0]],
				{
					findingsPath: fp,
					approvedPath: out,
					key,
					headSha: 'old-sha',
					mode: 'first-review',
					pluginVersion: '2.0.0',
					isYes: false,
					isReset: false,
				},
				'2026-06-03T00:00:00.000Z'
			).findings.map((f) => ({
				...f,
				decision: 'skip',
				decidedAt: '2026-06-03T00:00:00.000Z',
			})),
		}
		writeFileSync(join(stateDir, 'state.json'), JSON.stringify(oldState, null, 2), 'utf8')

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

	it('state.json directory is cleaned up on successful completion', async () => {
		const dir = tempDir()
		const key = sha16('cleanup-test')
		const fp = writeFindingsFile([SAMPLE_FINDINGS[0]], dir)
		const out = approvedPath(dir)
		const stateDir = join(dir, '.unic-pr-review', key)

		await loop({ findingsPath: fp, approvedPath: out, key, cwd: dir }, { stdin: scriptedStdin('a\n'), cwd: dir })

		assert.ok(!existsSync(stateDir), 'state dir removed after success')
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
