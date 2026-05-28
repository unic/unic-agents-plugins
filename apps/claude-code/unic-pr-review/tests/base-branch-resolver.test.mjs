// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveBaseBranch } from '../scripts/lib/base-branch-resolver.mjs'

/** @import { Exec, ExecResult } from '../scripts/lib/base-branch-resolver.mjs' */

/**
 * Build a sequential stub Exec that returns the given results in order.
 *
 * @param {...ExecResult} results
 * @returns {Exec}
 */
function seqExec(...results) {
	let i = 0
	return () => results[i++] ?? { ok: false, stdout: '', stderr: 'no more results' }
}

/** @param {string} stdout @returns {ExecResult} */
const ok = (stdout) => ({ ok: true, stdout, stderr: '' })

/** @returns {ExecResult} */
const fail = () => ({ ok: false, stdout: '', stderr: 'not found' })

describe('resolveBaseBranch', () => {
	it('uses symbolic-ref when it returns a full ref with origin/ prefix', () => {
		const exec = seqExec(ok('refs/remotes/origin/main\n'))
		assert.equal(resolveBaseBranch(exec), 'main')
	})

	it('uses symbolic-ref when pointing at develop', () => {
		const exec = seqExec(ok('refs/remotes/origin/develop\n'))
		assert.equal(resolveBaseBranch(exec), 'develop')
	})

	it('strips trailing whitespace from symbolic-ref output', () => {
		const exec = seqExec(ok('refs/remotes/origin/my-base\r\n'))
		assert.equal(resolveBaseBranch(exec), 'my-base')
	})

	it('falls back to develop when symbolic-ref fails', () => {
		// call 1: symbolic-ref fails; call 2: origin/develop ok
		const exec = seqExec(fail(), ok('abc123'))
		assert.equal(resolveBaseBranch(exec), 'develop')
	})

	it('falls back to main when symbolic-ref and develop both fail', () => {
		// call 1: symbolic-ref; call 2: develop; call 3: main
		const exec = seqExec(fail(), fail(), ok('abc123'))
		assert.equal(resolveBaseBranch(exec), 'main')
	})

	it('falls back to master when symbolic-ref, develop, and main all fail', () => {
		const exec = seqExec(fail(), fail(), fail(), ok('abc123'))
		assert.equal(resolveBaseBranch(exec), 'master')
	})

	it('throws when all four options fail', () => {
		const exec = seqExec(fail(), fail(), fail(), fail())
		assert.throws(
			() => resolveBaseBranch(exec),
			(err) => {
				assert.ok(err instanceof Error)
				assert.match(err.message, /Cannot resolve base branch/)
				return true
			}
		)
	})
})
