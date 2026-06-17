// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Structural regression guard for issue #252 — Work Item discovery contract.
 *
 * Two invariants:
 *
 *  1. `commands/review-pr.md` Step 1.5 must pipe `FETCHER_OUTPUT.workItemRefs` (the
 *     top-level refs array) to `discover-work-items` — never the raw `prMetadata` blob.
 *     Piping prMetadata silently loses workItemRefs on large PRs (the original bug).
 *
 *  2. `agents/ado-fetcher.md` Step 6 must emit `workItemRefs` as a top-level field
 *     (2-space indent in the JSON example), not nested inside `prMetadata` (4-space
 *     indent). Top-level placement keeps the small refs array in the "summary tier"
 *     the agent keeps inline even when the bulky prMetadata blob is abbreviated.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Normalise CRLF → LF so regex patterns work on Windows and Unix identically.
const reviewPr = readFileSync(join(ROOT, 'commands/review-pr.md'), 'utf8').replace(/\r\n/g, '\n')
const adoFetcher = readFileSync(join(ROOT, 'agents/ado-fetcher.md'), 'utf8').replace(/\r\n/g, '\n')

/**
 * Extract all fenced `sh` code blocks from a markdown string.
 * @param {string} content
 * @returns {string[]}
 */
function extractShBlocks(content) {
	return [...content.matchAll(/```sh\n([\s\S]*?)```/g)].map((m) => m[1])
}

/**
 * Extract all fenced `json` code blocks from a markdown string.
 * @param {string} content
 * @returns {string[]}
 */
function extractJsonBlocks(content) {
	return [...content.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1])
}

describe('Work Item discovery contract', () => {
	describe('review-pr.md Step 1.5: pipes workItemRefs (not prMetadata) to discover-work-items', () => {
		it('no sh block containing discover-work-items also contains prMetadata', () => {
			const violations = /** @type {string[]} */ ([])
			for (const block of extractShBlocks(reviewPr)) {
				if (block.includes('discover-work-items') && block.includes('prMetadata')) {
					violations.push(block.trim())
				}
			}
			assert.deepEqual(
				violations,
				[],
				`sh blocks with discover-work-items must not reference prMetadata — pipe workItemRefs array instead:\n${violations.join('\n---\n')}`
			)
		})

		it('Step 1.5 section references FETCHER_OUTPUT.workItemRefs', () => {
			assert.ok(
				reviewPr.includes('FETCHER_OUTPUT.workItemRefs'),
				'review-pr.md Step 1.5 must reference FETCHER_OUTPUT.workItemRefs (top-level field)'
			)
		})
	})

	describe('ado-fetcher.md Step 6: workItemRefs is a top-level field in the output schema', () => {
		it('Step 6 JSON example has workItemRefs at top-level indent (2 spaces)', () => {
			const jsonBlocks = extractJsonBlocks(adoFetcher)
			// Identified by its two distinguishing fields; other json blocks in the file lack both
			const step6Block = jsonBlocks.find((b) => b.includes('"prMetadata"') && b.includes('"mode"'))
			assert.ok(step6Block, 'ado-fetcher.md must contain a Step 6 JSON output schema block')

			const lines = step6Block.split('\n')
			const topLevelWorkItemRefs = lines.some((l) => /^ {2}"workItemRefs"/.test(l))
			assert.ok(
				topLevelWorkItemRefs,
				'workItemRefs must appear at top-level (2-space indent) in the Step 6 JSON schema, not nested inside prMetadata'
			)
		})

		it('Step 6 JSON example does not have workItemRefs nested inside prMetadata (4+ spaces)', () => {
			const jsonBlocks = extractJsonBlocks(adoFetcher)
			const step6Block = jsonBlocks.find((b) => b.includes('"prMetadata"') && b.includes('"mode"'))
			assert.ok(step6Block, 'ado-fetcher.md must contain a Step 6 JSON output schema block')

			const lines = step6Block.split('\n')
			// Find the prMetadata block range and check workItemRefs does not appear inside it.
			// Assumption: the Step 6 JSON is multi-line formatted. A single-line prMetadata
			// block (e.g. `"prMetadata": { "pullRequestId": 42 }`) would exit insideMetadata
			// before the violation check runs — acceptable because the ado-fetcher.md schema
			// is always formatted with one key per line.
			let insideMetadata = false
			let depth = 0
			const nestedViolations = /** @type {string[]} */ ([])
			for (const line of lines) {
				if (/^ {2}"prMetadata"/.test(line)) {
					insideMetadata = true
					depth = 0
				}
				if (insideMetadata) {
					depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
					if (depth <= 0 && line.includes('}')) {
						insideMetadata = false
					} else if (/^ {4,}"workItemRefs"/.test(line)) {
						nestedViolations.push(line.trim())
					}
				}
			}
			assert.deepEqual(
				nestedViolations,
				[],
				`workItemRefs must not be nested inside prMetadata in Step 6 schema:\n${nestedViolations.join('\n')}`
			)
		})
	})
})
