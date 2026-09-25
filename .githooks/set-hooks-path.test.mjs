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

const GUARDS = ['pre-commit', 'commit-msg', 'nda-match.mjs']

/**
 * A fresh repository with one commit. Its `.githooks` holds every guard file unless told otherwise.
 * @param {{ without?: string }} [options]
 */
function repo({ without = '' } = {}) {
	const dir = mkdtempSync(join(scratch, 'repo-'))
	git(['init', '-q'], dir)
	mkdirSync(join(dir, '.githooks'))
	writeFileSync(join(dir, '.githooks', 'README'), 'hooks\n')
	for (const file of GUARDS.filter((name) => name !== without)) {
		writeFileSync(join(dir, '.githooks', file), '#!/bin/sh\n')
	}
	git(['add', '.'], dir)
	git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'init'], dir)
	return dir
}

/**
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 */
const prepare = (cwd, env = {}) =>
	spawnSync('node', [SCRIPT], { cwd, encoding: 'utf8', env: { ...process.env, ...env } })

/**
 * Run the script the way a person does, through `pnpm install`. At a terminal pnpm's default reporter
 * replaces a lifecycle script's output with "Done" when the script exits 0. In a pipe that reporter can
 * still show the line of a slow script, so only a non-zero exit, after which pnpm prints the output in
 * full, proves the person sees it.
 * @param {string} cwd
 */
function install(cwd) {
	writeFileSync(
		join(cwd, 'package.json'),
		JSON.stringify({ name: 't', private: true, scripts: { prepare: `node "${SCRIPT}"` } })
	)
	const result = spawnSync('pnpm', ['install', '--reporter=default'], {
		cwd,
		encoding: 'utf8',
		shell: process.platform === 'win32',
	})
	return { status: result.status, output: result.stdout + result.stderr }
}

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
	test('names pre-commit when the main work tree lacks it', () => {
		assert.match(prepare(repo({ without: 'pre-commit' })).stderr, /lacks pre-commit,/)
	})
	test('names commit-msg when the main work tree lacks it', () => {
		assert.match(prepare(repo({ without: 'commit-msg' })).stderr, /lacks commit-msg,/)
	})
	test('prints nothing where there is no repository', () => {
		assert.equal(prepare(mkdtempSync(join(scratch, 'plain-'))).stderr, '')
	})
	test('reports a core.hooksPath it overwrites', () => {
		const dir = repo()
		git(['config', 'core.hooksPath', '/old/hooks'], dir)
		assert.match(prepare(dir).stderr, /was \/old\/hooks, and is now /)
	})
	test('fails pnpm install and shows why when the main work tree lacks a guard', () => {
		const { status, output } = install(repo({ without: 'pre-commit' }))
		assert.deepEqual(
			{ failed: status !== 0, shown: /lacks pre-commit,/.test(output) },
			{ failed: true, shown: true },
			output
		)
	})
	test('exits non-zero and names config.worktree when a per-worktree core.hooksPath wins', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], dir)
		const { status, stderr } = prepare(dir)
		assert.deepEqual({ status, named: /config\.worktree/.test(stderr) }, { status: 1, named: true }, stderr)
	})
	test('leaves the repository an exported GIT_DIR names alone', () => {
		const outer = repo()
		prepare(repo(), { GIT_DIR: join(outer, '.git') })
		assert.equal(git(['config', '--get', 'core.hooksPath'], outer), '')
	})
	test('sets its own repository when GIT_DIR names another', () => {
		const dir = repo()
		prepare(dir, { GIT_DIR: join(repo(), '.git') })
		assert.equal(canonical(git(['config', '--get', 'core.hooksPath'], dir)), canonical(join(dir, '.githooks')))
	})
	test('sets its own repository when GIT_CONFIG names another file', () => {
		const dir = repo()
		prepare(dir, { GIT_CONFIG: join(scratch, `config-${Date.now()}`) })
		assert.equal(
			canonical(git(['config', '--local', '--get', 'core.hooksPath'], dir)),
			canonical(join(dir, '.githooks'))
		)
	})
	test('exits non-zero with a readable cause when git cannot be run', { skip: process.platform === 'win32' }, () => {
		const bin = mkdtempSync(join(scratch, 'bin-'))
		writeFileSync(join(bin, 'git'), '#!/bin/sh\n', { mode: 0o644 })
		const { status, stderr } = spawnSync(process.execPath, [SCRIPT], {
			cwd: repo(),
			encoding: 'utf8',
			env: { ...process.env, PATH: bin },
		})
		assert.deepEqual({ status, cause: /EACCES/.test(stderr) }, { status: 1, cause: true }, stderr)
	})
})
