// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyseChangedFiles } from '../scripts/lib/changed-file-analyser.mjs'

describe('analyseChangedFiles', () => {
	it('returns ["code-reviewer"] for a single changed file', () => {
		assert.deepEqual(analyseChangedFiles(['src/index.mjs']), ['code-reviewer'])
	})

	it('returns ["code-reviewer"] for multiple changed files of any type', () => {
		assert.deepEqual(analyseChangedFiles(['src/index.mjs', 'tests/foo.test.mjs', 'types/bar.d.ts']), ['code-reviewer'])
	})

	it('returns [] for an empty changed-files list', () => {
		assert.deepEqual(analyseChangedFiles([]), [])
	})
})
