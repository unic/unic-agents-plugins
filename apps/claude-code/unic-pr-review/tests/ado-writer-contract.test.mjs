// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

const writerMd = readFileSync(resolve(root, 'agents/ado-writer.md'), 'utf8')

/**
 * Extract fenced JSON code blocks from a markdown section.
 * Returns all ```json ... ``` blocks found between `startMarker` and the next
 * heading of any level (h1-h4), or end of file.
 * @param {string} md
 * @param {string} startMarker  — exact section header text to anchor on
 * @returns {unknown[]}
 */
function extractJsonBlocks(md, startMarker) {
	const start = md.indexOf(startMarker)
	if (start === -1) return []
	// Bound section at the next heading (any level h1-h4)
	const after = md.slice(start + startMarker.length)
	const nextHeading = after.search(/^#{1,4} /m)
	const section = nextHeading === -1 ? after : after.slice(0, nextHeading)
	const blocks = []
	const re = /```json\s*([\s\S]*?)```/g
	for (const match of section.matchAll(re)) {
		try {
			blocks.push(JSON.parse(match[1]))
		} catch {
			// malformed block — surface in the test that reads it
			blocks.push(null)
		}
	}
	return blocks
}

describe('ado-writer.md contract — Step 5c reopen shape', () => {
	const step5c = writerMd.slice(writerMd.indexOf('#### 5c'), writerMd.indexOf('### Step 6'))

	it('Step 5c specifies replySuccess and statusSuccess fields on reopen entries', () => {
		assert.ok(step5c.includes('replySuccess'), 'Step 5c must specify replySuccess on the reopen result')
		assert.ok(step5c.includes('statusSuccess'), 'Step 5c must specify statusSuccess on the reopen result')
	})

	it('Step 5c does not record a top-level success field on reopen entries', () => {
		assert.ok(
			!step5c.includes('"reopen", success'),
			'Step 5c must not record a single top-level success field on reopen entries'
		)
		assert.ok(step5c.includes('replySuccess'), 'Step 5c recorded shape must include replySuccess')
	})

	it('Step 5c specifies that both sub-operations run regardless of each other', () => {
		assert.ok(
			step5c.includes('regardless') || step5c.includes('no early abort'),
			'Step 5c must state both sub-ops run regardless of each other (no early abort)'
		)
	})

	it('Step 5c specifies error aggregation with semicolon separator for dual failures', () => {
		// Anchor on the surrounding rule text, not a bare "; " — a bare substring would
		// stay green even if the dual-failure concatenation rule were reworded away.
		assert.match(
			step5c,
			/concatenated with `; ` when both failed/,
			'Step 5c must document concatenating both sub-op error messages with "; " when both fail'
		)
	})

	it('Step 5c specifies the error is null on full success and a single message when one sub-op fails', () => {
		assert.match(step5c, /`null` when both succeeded/, 'Step 5c must state error is null when both sub-ops succeed')
		assert.match(
			step5c,
			/failing sub-op's error message when exactly one failed/,
			'Step 5c must state error is the single failing sub-op message when exactly one fails'
		)
	})
})

describe('ado-writer.md contract — Step 6 best-effort policy', () => {
	const step6 = writerMd.slice(writerMd.indexOf('### Step 6'), writerMd.indexOf('### Step 7'))

	it('Step 6 states best-effort-and-continue for fresh Finding POST failures', () => {
		assert.ok(
			step6.includes('best-effort') || step6.includes('continue'),
			'Step 6 must document best-effort-and-continue policy for fresh Finding POST failures'
		)
	})

	it('Step 6 states that a POST failure does not abort the run', () => {
		assert.ok(
			step6.includes('do not abort') || step6.includes('continue to the next'),
			'Step 6 must state that a POST failure does not abort the run'
		)
	})
})

describe('ado-writer.md contract — Step 8 aggregation shape', () => {
	it('Step 8 example JSON for partial-failure reopen has replySuccess and statusSuccess', () => {
		const blocks = extractJsonBlocks(writerMd, '### Step 8')
		assert.ok(blocks.length > 0, 'Step 8 must contain at least one JSON code block')
		const partialFailure = /** @type {any} */ (blocks[0])
		assert.ok(partialFailure, 'First Step 8 JSON block must parse without error')

		const threadActionResults = partialFailure.threadActionResults
		assert.ok(Array.isArray(threadActionResults), 'threadActionResults must be an array')

		const reopenEntry = threadActionResults.find((/** @type {any} */ e) => e.action === 'reopen')
		assert.ok(reopenEntry, 'Step 8 partial-failure example must contain an action: "reopen" entry')
		assert.ok('replySuccess' in reopenEntry, 'reopen entry must have a replySuccess field')
		assert.ok('statusSuccess' in reopenEntry, 'reopen entry must have a statusSuccess field')
		assert.ok(!('success' in reopenEntry), 'reopen entry must NOT have a top-level success field')
	})

	it('Step 8 partial-failure example has top-level success: false when a reopen sub-op failed', () => {
		const blocks = extractJsonBlocks(writerMd, '### Step 8')
		assert.ok(blocks.length > 0, 'Step 8 must contain at least one JSON code block')
		const partialFailure = /** @type {any} */ (blocks[0])

		const reopenEntry = partialFailure.threadActionResults?.find((/** @type {any} */ e) => e.action === 'reopen')
		assert.ok(reopenEntry, 'Step 8 must have a reopen entry in the partial-failure example')

		// The partial-failure example must show at least one false sub-op
		const isPartialFailure = !reopenEntry.replySuccess || !reopenEntry.statusSuccess
		assert.ok(isPartialFailure, 'Step 8 partial-failure example must show reopen with at least one false sub-op')
		assert.equal(partialFailure.success, false, 'top-level success must be false when a reopen sub-op failed')
	})

	it('Step 8 success example has top-level success: true when reopen both sub-ops succeeded', () => {
		const blocks = extractJsonBlocks(writerMd, '### Step 8')
		assert.ok(
			blocks.length >= 2,
			'Step 8 must contain at least two JSON code blocks (partial-failure and full-success)'
		)
		const successExample = /** @type {any} */ (blocks[1])
		assert.ok(successExample, 'Second Step 8 JSON block must parse without error')

		const reopenEntry = successExample.threadActionResults?.find((/** @type {any} */ e) => e.action === 'reopen')
		assert.ok(reopenEntry, 'Step 8 success example must contain a reopen entry')
		assert.equal(reopenEntry.replySuccess, true, 'replySuccess must be true in success example')
		assert.equal(reopenEntry.statusSuccess, true, 'statusSuccess must be true in success example')
		assert.equal(reopenEntry.error, null, 'error must be null when both reopen sub-ops succeed')
		assert.equal(successExample.success, true, 'top-level success must be true in success example')
	})

	it('Step 8 reply/resolve entries keep a single success field and are never split', () => {
		const blocks = extractJsonBlocks(writerMd, '### Step 8')
		const partialFailure = /** @type {any} */ (blocks[0])
		const nonReopen = partialFailure.threadActionResults?.filter((/** @type {any} */ e) => e.action !== 'reopen')
		assert.ok(nonReopen?.length, 'Step 8 example must contain at least one reply/resolve entry')
		for (const entry of nonReopen) {
			assert.ok('success' in entry, `${entry.action} entry must keep a single success field`)
			assert.ok(!('replySuccess' in entry), `${entry.action} entry must NOT be split into replySuccess`)
			assert.ok(!('statusSuccess' in entry), `${entry.action} entry must NOT be split into statusSuccess`)
		}
	})

	it('Step 8 states reopen requires both replySuccess and statusSuccess for overall success', () => {
		const step8Start = writerMd.indexOf('### Step 8')
		const step8 = writerMd.slice(step8Start)
		assert.ok(
			step8.includes('replySuccess') && step8.includes('statusSuccess'),
			'Step 8 prose must name both replySuccess and statusSuccess'
		)
	})
})
