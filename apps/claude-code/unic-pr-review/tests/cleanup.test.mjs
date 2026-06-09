// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { cleanupFile } from '../scripts/lib/cleanup.mjs'

let _seq = 0
function tempPath() {
	return join(tmpdir(), `cleanup-test-${Date.now()}-${++_seq}.json`)
}

describe('cleanupFile', () => {
	it('deletes an existing file', () => {
		const p = tempPath()
		writeFileSync(p, '{}', 'utf8')
		cleanupFile(p)
		assert.equal(existsSync(p), false)
	})

	it('tolerates ENOENT — already-deleted file does not throw', () => {
		const p = tempPath() // does not exist
		assert.doesNotThrow(() => cleanupFile(p))
	})

	it('throws if path arg is empty string', () => {
		assert.throws(() => cleanupFile(''), /cleanup: missing path arg/)
	})

	it('throws if path arg is undefined', () => {
		assert.throws(() => cleanupFile(/** @type {any} */ (undefined)), /cleanup: missing path arg/)
	})

	it('rethrows non-ENOENT errors (e.g. EPERM)', () => {
		const eperm = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' })
		assert.throws(
			() =>
				cleanupFile('/some/path', {
					unlinkSync: () => {
						throw eperm
					},
				}),
			(e) => e === eperm
		)
	})

	it('does not rethrow ENOENT from injected unlinkSync', () => {
		const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
		assert.doesNotThrow(() =>
			cleanupFile('/some/path', {
				unlinkSync: () => {
					throw enoent
				},
			})
		)
	})
})
