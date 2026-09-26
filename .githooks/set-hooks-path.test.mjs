// @ts-check
// Tests for the `prepare` script that sets `core.hooksPath`. Every repository here is temporary.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
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

const GUARDS = ['pre-commit', 'commit-msg', 'pre-push', 'nda-match.mjs', 'nda-push.mjs', 'main-work-tree.mjs']

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
		writeFileSync(join(dir, '.githooks', file), '#!/bin/sh\n', { mode: 0o755 })
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
	return { status: result.status, output: `${result.error?.message ?? ''}${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe('set-hooks-path', () => {
	test('points a normal clone at its own .githooks', () => {
		const dir = repo()
		prepare(dir)
		assert.equal(canonical(git(['config', '--get', 'core.hooksPath'], dir)), canonical(join(dir, '.githooks')))
	})
	test('exits 0 and prints nothing in a normal clone', () => {
		const { status, stderr } = prepare(repo())
		assert.deepEqual({ status, stderr }, { status: 0, stderr: '' })
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
	test('sets its own repository, not the file GIT_CONFIG names', () => {
		const dir = repo()
		const other = join(scratch, `config-${Date.now()}`)
		prepare(dir, { GIT_CONFIG: other })
		const local = canonical(git(['config', '--local', '--get', 'core.hooksPath'], dir))
		assert.deepEqual(
			{ local, isOtherWritten: existsSync(other) },
			{ local: canonical(join(dir, '.githooks')), isOtherWritten: false }
		)
	})
	test('exits non-zero and writes nothing when git worktree list fails', { skip: process.platform === 'win32' }, () => {
		const dir = repo()
		const bin = mkdtempSync(join(scratch, 'bin-'))
		const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim()
		writeFileSync(join(bin, 'git'), `#!/bin/sh\n[ "$1" = worktree ] && exit 3\nexec "${realGit}" "$@"\n`, {
			mode: 0o755,
		})
		const { status, stderr } = spawnSync(process.execPath, [SCRIPT], {
			cwd: dir,
			encoding: 'utf8',
			env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
		})
		const hooksPath = git(['config', '--get', 'core.hooksPath'], dir)
		assert.deepEqual(
			{ status, named: /worktree list failed/.test(stderr), hooksPath },
			{ status: 1, named: true, hooksPath: '' },
			stderr
		)
	})
	test('exits non-zero when a clone has no git on PATH', { skip: process.platform === 'win32' }, () => {
		const bin = mkdtempSync(join(scratch, 'bin-'))
		const { status, stderr } = spawnSync(process.execPath, [SCRIPT], {
			cwd: repo(),
			encoding: 'utf8',
			env: { ...process.env, PATH: bin },
		})
		assert.deepEqual({ status, cause: /ENOENT/.test(stderr) }, { status: 1, cause: true }, stderr)
	})
	test('exits 0 in silence where there is no repository and no git', { skip: process.platform === 'win32' }, () => {
		const bin = mkdtempSync(join(scratch, 'bin-'))
		const { status, stderr } = spawnSync(process.execPath, [SCRIPT], {
			cwd: mkdtempSync(join(scratch, 'plain-')),
			encoding: 'utf8',
			env: { ...process.env, PATH: bin },
		})
		assert.deepEqual({ status, stderr }, { status: 0, stderr: '' })
	})
	test('exits non-zero in a linked worktree when the main work tree has no .githooks', () => {
		const dir = repo()
		const worktree = join(scratch, `wt-${Date.now()}`)
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		rmSync(join(dir, '.githooks'), { recursive: true })
		const { status, stderr } = prepare(worktree)
		const hooksPath = git(['config', '--get', 'core.hooksPath'], worktree)
		assert.deepEqual(
			{ status, named: /linked worktree/.test(stderr), hooksPath },
			{ status: 1, named: true, hooksPath: '' },
			stderr
		)
	})
	test('warns and exits 0 in a worktree of a bare repository', () => {
		const bare = join(scratch, `bare-${Date.now()}.git`)
		git(['clone', '-q', '--bare', repo(), bare], scratch)
		const worktree = join(scratch, `bare-wt-${Date.now()}`)
		git(['worktree', 'add', '-q', worktree], bare)
		const { status, stderr } = prepare(worktree)
		assert.deepEqual({ status, warned: /found no main work tree/.test(stderr) }, { status: 0, warned: true }, stderr)
	})
	test('warns and exits 0 in a clone made with --separate-git-dir', () => {
		const dir = mkdtempSync(join(scratch, 'sep-'))
		git(['clone', '-q', '--separate-git-dir', join(scratch, `sep-${Date.now()}.git`), repo(), dir], scratch)
		const { status, stderr } = prepare(dir)
		assert.deepEqual({ status, warned: /found no main work tree/.test(stderr) }, { status: 0, warned: true }, stderr)
	})
	test(
		'exits non-zero and names the hook git would skip as not executable',
		{ skip: process.platform === 'win32' },
		() => {
			const dir = repo()
			chmodSync(join(dir, '.githooks', 'pre-commit'), 0o644)
			const { status, stderr } = prepare(dir)
			assert.deepEqual(
				{ status, named: /pre-commit is not executable/.test(stderr) },
				{ status: 1, named: true },
				stderr
			)
		}
	)
	test('ignores a -c value from GIT_CONFIG_PARAMETERS when it reads the value back', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], dir)
		const { status, stderr } = prepare(dir, { GIT_CONFIG_PARAMETERS: `'core.hookspath'='${join(dir, '.githooks')}'` })
		assert.deepEqual({ status, named: /config\.worktree/.test(stderr) }, { status: 1, named: true }, stderr)
	})
	test('ignores a value from GIT_CONFIG_COUNT when it reads the value back', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], dir)
		const env = {
			GIT_CONFIG_COUNT: '1',
			GIT_CONFIG_KEY_0: 'core.hooksPath',
			GIT_CONFIG_VALUE_0: join(dir, '.githooks'),
		}
		const { status, stderr } = prepare(dir, env)
		assert.deepEqual({ status, named: /config\.worktree/.test(stderr) }, { status: 1, named: true }, stderr)
	})
	test('exits non-zero and says so when core.hooksPath cannot be written', () => {
		const dir = repo()
		writeFileSync(join(dir, '.git', 'config.lock'), '')
		const { status, stderr } = prepare(dir)
		assert.deepEqual({ status, named: /was not updated/.test(stderr) }, { status: 1, named: true }, stderr)
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
