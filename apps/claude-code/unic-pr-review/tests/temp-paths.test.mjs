// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { basename } from 'node:path'
import { describe, it } from 'node:test'
import { tempFilePath } from '../scripts/lib/temp-paths.mjs'

const KEY = 'abc1234567890def'

describe('tempFilePath', () => {
	it('returns a path inside os.tmpdir()', () => {
		const p = tempFilePath('findings', KEY)
		assert.ok(p.startsWith(tmpdir()), `expected path to start with tmpdir; got ${p}`)
	})

	it('includes kind=findings and the key in the filename', () => {
		const name = basename(tempFilePath('findings', KEY))
		assert.match(name, new RegExp(`unic-pr-review-findings-${KEY}`))
	})

	it('includes kind=approved and the key in the filename', () => {
		const name = basename(tempFilePath('approved', KEY))
		assert.match(name, new RegExp(`unic-pr-review-approved-${KEY}`))
	})

	it('returns a .json file', () => {
		assert.ok(tempFilePath('findings', KEY).endsWith('.json'))
		assert.ok(tempFilePath('approved', KEY).endsWith('.json'))
	})

	it('findings and approved paths are distinct', () => {
		assert.notEqual(tempFilePath('findings', KEY), tempFilePath('approved', KEY))
	})
})
