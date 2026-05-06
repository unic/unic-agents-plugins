// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { classifyThread } from '../scripts/re-review/classify-thread.mjs'

const SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'

/** @param {string} name */
const loadFixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

/**
 * Converts a raw ADO thread (fixture format) to the PriorThread shape expected by classifyThread.
 * @param {object} raw
 * @returns {import('../scripts/re-review/classify-thread.mjs').PriorThread}
 */
const toThread = (raw) => ({
	threadId: raw.id,
	filePath: raw.threadContext?.filePath ?? null,
	start: raw.threadContext?.rightFileStart ?? null,
	end: raw.threadContext?.rightFileEnd ?? null,
	comments: raw.comments ?? [],
	status: raw.status ?? 'active',
})

/** @type {import('../scripts/re-review/classify-thread.mjs').DiffHunk[]} */
const noChangeDiff = loadFixture('diff-hunks-no-change')

/** @type {import('../scripts/re-review/classify-thread.mjs').DiffHunk[]} */
const withChangesDiff = loadFixture('diff-hunks-with-changes')

describe('classifyThread', () => {
	it('status fixed → addressed', () => {
		const thread = toThread(loadFixture('threads-addressed-status').value[0])
		const result = classifyThread({ thread, diffHunks: noChangeDiff, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'addressed')
	})

	it('active status, line intersects diff hunk → addressed', () => {
		// threads-addressed-diff: /src/feature.ts line 42, hunk covers 40–45
		const thread = toThread(loadFixture('threads-addressed-diff').value[0])
		const result = classifyThread({ thread, diffHunks: withChangesDiff, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'addressed')
	})

	it('active status, human reply present → disputed', () => {
		const thread = toThread(loadFixture('threads-disputed').value[0])
		const result = classifyThread({ thread, diffHunks: withChangesDiff, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'disputed')
	})

	it('active status, no human replies, line not in diff → pending', () => {
		// threads-pending: /src/api.ts line 42, hunk covers lines 1–10 only
		const thread = toThread(loadFixture('threads-pending').value[0])
		const result = classifyThread({ thread, diffHunks: withChangesDiff, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'pending')
	})

	it('file absent from diff → obsolete', () => {
		// threads-obsolete: /src/legacy.ts not present in withChangesDiff
		const thread = toThread(loadFixture('threads-obsolete').value[0])
		const result = classifyThread({ thread, diffHunks: withChangesDiff, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'obsolete')
	})

	it('multi-line thread (10–15) with hunk at 12–13 → addressed', () => {
		/** @type {import('../scripts/re-review/classify-thread.mjs').PriorThread} */
		const thread = {
			threadId: 99,
			filePath: '/src/utils.ts',
			start: { line: 10 },
			end: { line: 15 },
			comments: [{ content: `Finding.\n---\n${SIGNATURE_PREFIX} — Iteration 1` }],
			status: 'active',
		}
		/** @type {import('../scripts/re-review/classify-thread.mjs').DiffHunk[]} */
		const hunks = [{ filePath: '/src/utils.ts', startLine: 12, endLine: 13 }]
		const result = classifyThread({ thread, diffHunks: hunks, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'addressed')
	})

	it('general thread (filePath null), human reply → disputed', () => {
		/** @type {import('../scripts/re-review/classify-thread.mjs').PriorThread} */
		const thread = {
			threadId: 100,
			filePath: null,
			start: null,
			end: null,
			comments: [
				{ content: `Some bot comment.\n---\n${SIGNATURE_PREFIX} — Iteration 1` },
				{ content: 'A human replied here.' },
			],
			status: 'active',
		}
		const result = classifyThread({ thread, diffHunks: [], signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'disputed')
	})

	it('general thread (filePath null), no human replies → pending', () => {
		/** @type {import('../scripts/re-review/classify-thread.mjs').PriorThread} */
		const thread = {
			threadId: 101,
			filePath: null,
			start: null,
			end: null,
			comments: [{ content: `Only bot comment.\n---\n${SIGNATURE_PREFIX} — Iteration 1` }],
			status: 'active',
		}
		const result = classifyThread({ thread, diffHunks: [], signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'pending')
	})

	it('thread with null end, file changed in diff → pending (intersection requires both start and end)', () => {
		/** @type {import('../scripts/re-review/classify-thread.mjs').PriorThread} */
		const thread = {
			threadId: 102,
			filePath: '/src/feature.ts',
			start: { line: 42 },
			end: null,
			comments: [{ content: `Finding.\n---\n${SIGNATURE_PREFIX} — Iteration 1` }],
			status: 'active',
		}
		const result = classifyThread({ thread, diffHunks: withChangesDiff, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'pending')
	})

	it('file present in diff with all-zero hunks (deleted) → obsolete', () => {
		/** @type {import('../scripts/re-review/classify-thread.mjs').PriorThread} */
		const thread = {
			threadId: 103,
			filePath: '/src/deleted.ts',
			start: { line: 5 },
			end: { line: 5 },
			comments: [{ content: `Finding.\n---\n${SIGNATURE_PREFIX} — Iteration 1` }],
			status: 'active',
		}
		/** @type {import('../scripts/re-review/classify-thread.mjs').DiffHunk[]} */
		const hunks = [{ filePath: '/src/deleted.ts', startLine: 0, endLine: 0 }]
		const result = classifyThread({ thread, diffHunks: hunks, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result, 'obsolete')
	})

	it('numeric status 2 (wontFix) → addressed', () => {
		/** @type {import('../scripts/re-review/classify-thread.mjs').PriorThread} */
		const thread = {
			threadId: 104,
			filePath: '/src/api.ts',
			start: { line: 42 },
			end: { line: 42 },
			comments: [{ content: `Finding.\n---\n${SIGNATURE_PREFIX} — Iteration 1` }],
			status: 2,
		}
		assert.equal(classifyThread({ thread, diffHunks: noChangeDiff, signaturePrefix: SIGNATURE_PREFIX }), 'addressed')
	})

	it('numeric status 5 (byDesign) → addressed', () => {
		/** @type {import('../scripts/re-review/classify-thread.mjs').PriorThread} */
		const thread = {
			threadId: 105,
			filePath: '/src/api.ts',
			start: { line: 42 },
			end: { line: 42 },
			comments: [{ content: `Finding.\n---\n${SIGNATURE_PREFIX} — Iteration 1` }],
			status: 5,
		}
		assert.equal(classifyThread({ thread, diffHunks: noChangeDiff, signaturePrefix: SIGNATURE_PREFIX }), 'addressed')
	})
})
