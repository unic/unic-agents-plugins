// @ts-check
// Tests for the `prepare` script that sets `core.hooksPath`. Every repository here is temporary.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'set-hooks-path.mjs')

const scratch = realpathSync.native(mkdtempSync(join(tmpdir(), 'hooks-path-')))
after(() => rmSync(scratch, { recursive: true, force: true }))

/**
 * @param {string[]} args
 * @param {string} cwd
 */
const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' }).stdout.trim()

/** Resolve short names and symlinks, so two spellings of one directory compare equal. */
const canonical = (/** @type {string} */ path) => realpathSync.native(path).toLowerCase()

/**
 * A fresh repository with one commit. Its `.githooks` holds a pre-commit unless told otherwise.
 * @param {{ withPreCommit?: boolean }} [options]
 */
function repo({ withPreCommit = true } = {}) {
	const dir = mkdtempSync(join(scratch, 'repo-'))
	git(['init', '-q'], dir)
	mkdirSync(join(dir, '.githooks'))
	writeFileSync(join(dir, '.githooks', withPreCommit ? 'pre-commit' : 'README'), '#!/bin/sh\n')
	git(['add', '.'], dir)
	git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'init'], dir)
	return dir
}

/** @param {string} cwd */
const prepare = (cwd) => spawnSync('node', [SCRIPT], { cwd, encoding: 'utf8' })

describe('set-hooks-path', () => {
	test('points a normal clone at its own .githooks', () => {
		const dir = repo()
		prepare(dir)
		assert.equal(canonical(git(['config', '--get', 'core.hooksPath'], dir)), canonical(join(dir, '.githooks')))
	})
	test('prints nothing in a normal clone', () => {
		assert.equal(prepare(repo()).stderr, '')
	})
	test('points a linked worktree at the main work tree', () => {
		const dir = repo()
		const worktree = join(scratch, `wt-${Date.now()}`)
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		prepare(worktree)
		assert.equal(canonical(git(['config', '--get', 'core.hooksPath'], worktree)), canonical(join(dir, '.githooks')))
	})
	test('warns when the main work tree has no pre-commit', () => {
		assert.match(prepare(repo({ withPreCommit: false })).stderr, /has no pre-commit/)
	})
	test('prints nothing where there is no repository', () => {
		assert.equal(prepare(mkdtempSync(join(scratch, 'plain-'))).stderr, '')
	})
	test('reports a core.hooksPath it overwrites', () => {
		const dir = repo()
		git(['config', 'core.hooksPath', '/old/hooks'], dir)
		assert.match(prepare(dir).stderr, /was \/old\/hooks, and is now /)
	})
})
