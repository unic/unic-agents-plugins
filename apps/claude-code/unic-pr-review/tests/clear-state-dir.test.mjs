// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { clearStateDir } from '../scripts/lib/clear-state-dir.mjs'

const KEY = 'abc1234567890def'

function tempCwd() {
	return mkdtempSync(join(tmpdir(), 'clear-state-dir-'))
}

describe('clearStateDir', () => {
	it('deletes an existing state directory and its contents', () => {
		const cwd = tempCwd()
		const dir = join(cwd, '.unic-pr-review', KEY)
		mkdirSync(dir, { recursive: true })
		writeFileSync(join(dir, 'state.json'), '{}', 'utf8')

		const returned = clearStateDir(KEY, { cwd })

		assert.equal(returned, dir)
		assert.equal(existsSync(dir), false)
	})

	it('tolerates an already-absent directory (force:true → no throw)', () => {
		const cwd = tempCwd() // no .unic-pr-review/<key> created
		assert.doesNotThrow(() => clearStateDir(KEY, { cwd }))
	})

	it('throws if key is empty', () => {
		assert.throws(() => clearStateDir('', { cwd: tempCwd() }), /clear-state-dir: missing key/)
	})

	it('throws if key is undefined', () => {
		assert.throws(
			() => clearStateDir(/** @type {any} */ (undefined), { cwd: tempCwd() }),
			/clear-state-dir: missing key/
		)
	})

	it('targets <cwd>/.unic-pr-review/<key>/ — matches getApprovalStateDir', () => {
		const cwd = tempCwd()
		let removed = ''
		clearStateDir(KEY, { cwd, rmSync: (p) => (removed = p) })
		assert.equal(removed, join(cwd, '.unic-pr-review', KEY))
	})

	it('rethrows non-ENOENT errors (e.g. EPERM) instead of masking them', () => {
		const eperm = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' })
		assert.throws(
			() =>
				clearStateDir(KEY, {
					cwd: tempCwd(),
					rmSync: () => {
						throw eperm
					},
				}),
			(e) => e === eperm
		)
	})
})
