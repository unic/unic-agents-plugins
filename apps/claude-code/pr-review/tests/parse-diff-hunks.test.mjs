// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseDiffHunks } from '../scripts/re-review/parse-diff-hunks.mjs'

describe('parseDiffHunks', () => {
	it('returns [] for empty input', () => {
		assert.deepEqual(parseDiffHunks(''), [])
	})

	it('parses a single-file single-hunk diff into one slash-prefixed entry', () => {
		const diff = [
			'diff --git a/src/foo.ts b/src/foo.ts',
			'index abc..def 100644',
			'--- a/src/foo.ts',
			'+++ b/src/foo.ts',
			'@@ -10,3 +10,5 @@',
			' context',
			'+added',
			'+added',
		].join('\n')
		const result = parseDiffHunks(diff)
		assert.deepEqual(result, [{ filePath: '/src/foo.ts', startLine: 10, endLine: 14 }])
	})

	it('preserves per-hunk granularity across multi-file diff (no dedup)', () => {
		const diff = [
			'diff --git a/src/a.ts b/src/a.ts',
			'@@ -1,2 +1,2 @@',
			' x',
			'+y',
			'@@ -20,1 +20,3 @@',
			'+a',
			'+b',
			'+c',
			'diff --git a/src/b.ts b/src/b.ts',
			'@@ -5,1 +5,1 @@',
			'-old',
			'+new',
		].join('\n')
		const result = parseDiffHunks(diff)
		assert.deepEqual(result, [
			{ filePath: '/src/a.ts', startLine: 1, endLine: 2 },
			{ filePath: '/src/a.ts', startLine: 20, endLine: 22 },
			{ filePath: '/src/b.ts', startLine: 5, endLine: 5 },
		])
	})

	it('defaults count to 1 when hunk header omits the count (@@ -1 +5 @@)', () => {
		const diff = ['diff --git a/x.md b/x.md', '@@ -1 +5 @@', '+only-line'].join('\n')
		const result = parseDiffHunks(diff)
		assert.deepEqual(result, [{ filePath: '/x.md', startLine: 5, endLine: 5 }])
	})

	it('skips hunk headers that lack the +side (binary diff or pure delete header)', () => {
		const diff = [
			'diff --git a/bin/blob.png b/bin/blob.png',
			'Binary files a/bin/blob.png and b/bin/blob.png differ',
			'diff --git a/src/keep.ts b/src/keep.ts',
			'@@ -3,2 +3,2 @@',
			'-old',
			'+new',
		].join('\n')
		const result = parseDiffHunks(diff)
		assert.deepEqual(result, [{ filePath: '/src/keep.ts', startLine: 3, endLine: 4 }])
	})

	it('is robust to CRLF line endings', () => {
		const diff = ['diff --git a/src/foo.ts b/src/foo.ts', '@@ -10,2 +12,3 @@', ' ctx', '+a', '+b'].join('\r\n')
		const result = parseDiffHunks(diff)
		assert.deepEqual(result, [{ filePath: '/src/foo.ts', startLine: 12, endLine: 14 }])
	})

	it('ignores hunk headers that appear before any diff --git line (no current file)', () => {
		const diff = ['@@ -1,2 +1,2 @@', ' a', '+b'].join('\n')
		const result = parseDiffHunks(diff)
		assert.deepEqual(result, [])
	})
})
