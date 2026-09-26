// @ts-check
// Tests for the `prepare` script that sets `core.hooksPath`. Every repository here is temporary.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { findMainWorkTree } from './main-work-tree.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'set-hooks-path.mjs')
const { packageManager: PNPM } = JSON.parse(readFileSync(join(dirname(SCRIPT), '..', 'package.json'), 'utf8'))
// The pin may carry a `+sha512.…` suffix, which pnpm leaves out of its version.
const PNPM_VERSION = /^pnpm@([^+]+)/.exec(PNPM)?.[1] ?? ''

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
 * Run the script the way a person does, through `pnpm install`, with the pnpm this repository pins.
 * Reporters differ between pnpm versions. At a terminal pnpm 10 replaces a lifecycle script's output
 * with "Done" when the script exits 0, and pnpm 12 cuts the line at the terminal width. In a pipe the
 * reporter can still show the line of a slow script, so only a non-zero exit, after which the pinned
 * pnpm 10.33.2 prints the output in full, proves the person sees it. That holds for 10.33.2 only:
 * pnpm 12 does not print the cut line again after the failure.
 * @param {string} cwd
 */
function install(cwd) {
	writeFileSync(
		join(cwd, 'package.json'),
		JSON.stringify({ name: 't', private: true, packageManager: PNPM, scripts: { prepare: `node "${SCRIPT}"` } })
	)
	const result = spawnSync('pnpm', ['install', '--reporter=default'], {
		cwd,
		encoding: 'utf8',
		shell: process.platform === 'win32',
	})
	return { status: result.status, output: `${result.error?.message ?? ''}${result.stdout ?? ''}${result.stderr ?? ''}` }
}

/**
 * An environment whose `git` runs one shell line first, then the real git. POSIX only.
 * @param {string} line
 */
function withFakeGit(line) {
	const bin = mkdtempSync(join(scratch, 'bin-'))
	const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim()
	writeFileSync(join(bin, 'git'), `#!/bin/sh\n${line}\nexec "${realGit}" "$@"\n`, { mode: 0o755 })
	return { PATH: `${bin}:${process.env.PATH}` }
}

/**
 * Is the git on PATH at least `major.minor`?
 * @param {number} major
 * @param {number} minor
 */
function hasGit(major, minor) {
	const [, a = '0', b = '0'] = /(\d+)\.(\d+)/.exec(spawnSync('git', ['--version'], { encoding: 'utf8' }).stdout) ?? []
	return Number(a) > major || (Number(a) === major && Number(b) >= minor)
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
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		prepare(worktree)
		assert.equal(canonical(git(['config', '--get', 'core.hooksPath'], worktree)), canonical(join(dir, '.githooks')))
	})
	test('names pre-commit when the main work tree lacks it', () => {
		assert.match(prepare(repo({ without: 'pre-commit' })).stderr, /lacks pre-commit\./)
	})
	test('names commit-msg when the main work tree lacks it', () => {
		assert.match(prepare(repo({ without: 'commit-msg' })).stderr, /lacks commit-msg\./)
	})
	test('prints nothing where there is no repository', () => {
		assert.equal(prepare(mkdtempSync(join(scratch, 'plain-'))).stderr, '')
	})
	test('reports a core.hooksPath it overwrites', () => {
		const dir = repo()
		git(['config', 'core.hooksPath', '/old/hooks'], dir)
		assert.match(prepare(dir).stderr, /It was \/old\/hooks, and is now /)
	})
	test('fails pnpm install and shows why when the main work tree lacks a guard', () => {
		const { status, output } = install(repo({ without: 'pre-commit' }))
		assert.deepEqual(
			{ failed: status !== 0, shown: /lacks pre-commit\./.test(output) },
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
		const other = join(mkdtempSync(join(scratch, 'config-')), 'config')
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
		const worktree = mkdtempSync(join(scratch, 'wt-'))
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
		const bare = mkdtempSync(join(scratch, 'bare-'))
		git(['clone', '-q', '--bare', repo(), bare], scratch)
		const worktree = mkdtempSync(join(scratch, 'bare-wt-'))
		git(['worktree', 'add', '-q', worktree], bare)
		const { status, stderr } = prepare(worktree)
		assert.deepEqual({ status, warned: /found no main work tree/.test(stderr) }, { status: 0, warned: true }, stderr)
	})
	test('warns and exits 0 in a clone made with --separate-git-dir', () => {
		const dir = mkdtempSync(join(scratch, 'sep-'))
		git(
			['clone', '-q', '--separate-git-dir', join(mkdtempSync(join(scratch, 'sep-git-')), 'git'), repo(), dir],
			scratch
		)
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
				{ status, named: /skips pre-commit, because it is not executable/.test(stderr) },
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
		assert.deepEqual(
			{ status, named: /because git could not update it/.test(stderr) },
			{ status: 1, named: true },
			stderr
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
	test('runs pnpm install with the pnpm this repository pins', () => {
		const { status, output } = install(repo())
		assert.deepEqual(
			{ status, pinned: PNPM_VERSION !== '' && output.includes(`using pnpm v${PNPM_VERSION}`) },
			{ status: 0, pinned: true },
			output
		)
	})
	test('gives the docs remedy, not a path set by hand, when it fails', () => {
		const { stderr } = prepare(repo({ without: 'pre-commit' }))
		assert.deepEqual(
			{
				docs: /Some or all of the NDA git hooks may be off until the cause above is fixed\..*check out a branch that carries it in the main work tree, then run pnpm install there/.test(
					stderr
				),
				byHand: /git config core\.hookspath "/i.test(stderr),
			},
			{ docs: true, byHand: false },
			stderr
		)
	})
	test('says because and the reason before any path in every prepare: line', () => {
		const isPosix = process.platform !== 'win32'
		/** @type {string[]} */
		const outputs = []
		/** @param {string} cwd @param {Record<string, string>} [env] */
		const collect = (cwd, env) => outputs.push(prepare(cwd, env).stderr)

		const dir = repo({ without: 'pre-commit' })
		if (isPosix) chmodSync(join(dir, '.githooks', 'commit-msg'), 0o644)
		git(['config', 'core.hooksPath', '/old/hooks'], dir)
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		const overridden = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', overridden, '-b', 'overridden'], dir)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], overridden)
		const unreadable = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', unreadable, '-b', 'unreadable'], dir)
		writeFileSync(join(dir, '.git', 'worktrees', unreadable.split(/[\\/]/).pop() ?? '', 'config.worktree'), '[core\n')
		const gone = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', gone, '-b', 'gone'], dir)
		rmSync(gone, { recursive: true, force: true })
		const reused = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', reused, '-b', 'reused'], dir)
		rmSync(reused, { recursive: true, force: true })
		mkdirSync(reused)
		git(['init', '-q'], reused)
		collect(dir)

		const linked = repo()
		const orphan = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', orphan, '-b', 'wt'], linked)
		rmSync(join(linked, '.githooks'), { recursive: true })
		collect(orphan)

		const bare = mkdtempSync(join(scratch, 'bare-'))
		git(['clone', '-q', '--bare', repo(), bare], scratch)
		git(['config', 'extensions.worktreeConfig', 'true'], bare)
		const bareWorktree = mkdtempSync(join(scratch, 'bare-wt-'))
		git(['worktree', 'add', '-q', bareWorktree], bare)
		git(['config', 'core.bare', 'true'], bare)
		collect(bareWorktree)

		const own = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], own)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], own)
		collect(own)

		const locked = repo()
		writeFileSync(join(locked, '.git', 'config.lock'), '')
		collect(locked)

		const expected = [
			/the hooks stay off, because this is a linked worktree/,
			/because git found no main work tree with a \.githooks/,
			/because git rev-parse failed/,
			/because the hooks directory lacks pre-commit/,
			/core\.hooksPath changed, because pnpm install set it/,
			/the hooks are off here, because another value wins/,
			/because core\.hooksPath resolves there to/,
			/because git could not read its config/,
			/because git marks it prunable or its directory is gone/,
			/because its old path now holds another git repository/,
			/because git could not update it/,
		]
		if (isPosix) {
			collect(repo(), withFakeGit('[ "$1" = rev-parse ] && [ "$2" = --show-prefix ] && { echo nope >&2; exit 5; }'))
			collect(repo(), withFakeGit('[ "$1" = worktree ] && exit 3'))
			collect(repo(), withFakeGit('[ "$2" = --show-origin ] && { echo nope >&2; exit 2; }'))
			expected.push(
				/because it is not executable/,
				/the hooks are off, because git rev-parse failed/,
				/because git worktree list failed/,
				/because git could not read the config back/
			)
		}
		const stderr = outputs.join('\n')
		const lines = stderr.split('\n').filter((line) => line.startsWith('prepare: '))
		const pathFirst = lines.filter((line) => {
			const reasonAt = line.indexOf(' because ')
			return reasonAt < 0 || /[\\/]/.test(line.slice(0, reasonAt))
		})
		const missing = expected.filter((pattern) => !lines.some((line) => pattern.test(line))).map(String)
		assert.deepEqual({ missing, pathFirst }, { missing: [], pathFirst: [] }, stderr)
	})
	test(
		'exits non-zero and blames git, not the value, when it cannot read the config back',
		{ skip: process.platform === 'win32' },
		() => {
			const { status, stderr } = prepare(repo(), withFakeGit('[ "$2" = --show-origin ] && { echo nope >&2; exit 2; }'))
			assert.deepEqual(
				{
					status,
					named: /because git could not read the config back \(nope\)/.test(stderr),
					blamed: /resolves to/.test(stderr),
				},
				{ status: 1, named: true, blamed: false },
				stderr
			)
		}
	)
	test('exits non-zero and names another worktree whose config.worktree overrides the value', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], worktree)
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{
				status,
				named:
					stderr.includes(`resolves there to`) &&
					stderr.includes('/elsewhere') &&
					stderr.includes(worktree.split(/[\\/]/).pop() ?? ''),
			},
			{ status: 1, named: true },
			stderr
		)
	})
	test('warns, skips the check and exits 0 for a worktree whose directory is gone', () => {
		const dir = repo()
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		rmSync(worktree, { recursive: true, force: true })
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{ status, skipped: /because git marks it prunable or its directory is gone/.test(stderr) },
			{ status: 0, skipped: true },
			stderr
		)
	})
	test('reads a main work tree path without the \\r of a CRLF worktree list', () => {
		assert.equal(findMainWorkTree('worktree /repo\r\nHEAD abc\r\nbranch refs/heads/main\r\n\r\n'), '/repo')
	})
	test('exits non-zero with the cause, not a stack trace, when git rev-parse --show-toplevel fails', () => {
		const bare = mkdtempSync(join(scratch, 'bare-'))
		git(['clone', '-q', '--bare', repo(), bare], scratch)
		git(['config', 'extensions.worktreeConfig', 'true'], bare)
		const worktree = mkdtempSync(join(scratch, 'bare-wt-'))
		git(['worktree', 'add', '-q', worktree], bare)
		git(['config', 'core.bare', 'true'], bare)
		const { status, stderr } = prepare(worktree)
		assert.deepEqual(
			{ status, named: /because git rev-parse failed \(/.test(stderr), stack: /\n\s+at /.test(stderr) },
			{ status: 1, named: true, stack: false },
			stderr
		)
	})
	test('says git could not read the config of another worktree, rather than blame its value', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		writeFileSync(join(dir, '.git', 'worktrees', worktree.split(/[\\/]/).pop() ?? '', 'config.worktree'), '[core\n')
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{ status, named: /because git could not read its config/.test(stderr), blamed: /resolves there to/.test(stderr) },
			{ status: 1, named: true, blamed: false },
			stderr
		)
	})
	test('checks a worktree whose path holds a newline', { skip: process.platform === 'win32' }, () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		const worktree = join(mkdtempSync(join(scratch, 'wt-')), 'new\nline')
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], worktree)
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{ status, named: /resolves there to/.test(stderr), skipped: /skipped/.test(stderr) },
			{ status: 1, named: true, skipped: false },
			stderr
		)
	})
	test('warns with the repair remedy and exits 0 for a prunable worktree whose directory still exists', () => {
		const dir = repo()
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		rmSync(join(worktree, '.git'))
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{
				status,
				skipped: /because git marks it prunable/.test(stderr),
				remedy:
					/may still be in use.*If it still exists, make it reachable, or run git worktree repair <new path>, then pnpm install\. Only when it is gone, run git worktree prune\./.test(
						stderr
					),
			},
			{ status: 0, skipped: true, remedy: true },
			stderr
		)
	})
	test('exits 0 and prints nothing with a healthy linked worktree beside the main work tree', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		const { status, stderr } = prepare(dir)
		assert.deepEqual({ status, stderr }, { status: 0, stderr: '' })
	})
	test(
		'falls back to the plain worktree list and sets the value when git rejects -z',
		{ skip: process.platform === 'win32' },
		() => {
			const dir = repo()
			const bin = mkdtempSync(join(scratch, 'bin-'))
			const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim()
			writeFileSync(
				join(bin, 'git'),
				`#!/bin/sh\nfor arg in "$@"; do [ "$arg" = -z ] && { echo "error: unknown switch \\\`z'" >&2; exit 129; }; done\nexec "${realGit}" "$@"\n`,
				{ mode: 0o755 }
			)
			const { status, stderr } = spawnSync(process.execPath, [SCRIPT], {
				cwd: dir,
				encoding: 'utf8',
				env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
			})
			const hooksPath = canonical(git(['config', '--get', 'core.hooksPath'], dir))
			assert.deepEqual(
				{ status, stderr, hooksPath },
				{ status: 0, stderr: '', hooksPath: canonical(join(dir, '.githooks')) },
				stderr
			)
		}
	)
	test('warns with git worktree unlock and exits 0 for a locked worktree whose directory is gone', () => {
		const dir = repo()
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		git(['worktree', 'lock', worktree], dir)
		rmSync(worktree, { recursive: true, force: true })
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{
				status,
				skipped: /because git marks it prunable or its directory is gone/.test(stderr),
				unlock: /Only when it is gone, run git worktree unlock ".+", then git worktree prune\./.test(stderr),
			},
			{ status: 0, skipped: true, unlock: true },
			stderr
		)
	})
	test('skips an entry whose old path holds another repository and names its admin directory', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		const name = worktree.split(/[\\/]/).pop() ?? ''
		rmSync(worktree, { recursive: true, force: true })
		mkdirSync(worktree)
		git(['init', '-q'], worktree)
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{
				status,
				skipped: /because its old path now holds another git repository/.test(stderr),
				admin: stderr.includes(`worktrees${process.platform === 'win32' ? '\\' : '/'}${name}.`),
				blamed: /resolves there to/.test(stderr),
				otherTouched: git(['config', '--get', 'core.hooksPath'], worktree),
			},
			{ status: 0, skipped: true, admin: true, blamed: false, otherTouched: '' },
			stderr
		)
	})
	test('prints the remedy once when several checks fail', () => {
		const dir = repo({ without: 'pre-commit' })
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		git(['config', '--worktree', 'core.hooksPath', '/elsewhere'], dir)
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{
				status,
				failures: stderr.split('\nprepare: ').length,
				remedies: stderr.split('Some or all of the NDA git hooks may be off').length - 1,
			},
			{ status: 1, failures: 2, remedies: 1 },
			stderr
		)
	})
	test(
		'names the admin directory of a reused entry that git wrote with a relative gitdir',
		{ skip: !hasGit(2, 48) && 'needs git 2.48 for worktree.useRelativePaths' },
		() => {
			const dir = repo()
			git(['config', 'worktree.useRelativePaths', 'true'], dir)
			const worktree = mkdtempSync(join(scratch, 'wt-'))
			git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
			const name = worktree.split(/[\\/]/).pop() ?? ''
			rmSync(worktree, { recursive: true, force: true })
			mkdirSync(worktree)
			git(['init', '-q'], worktree)
			const { status, stderr } = prepare(dir)
			assert.deepEqual(
				{ status, admin: stderr.includes(`worktrees${process.platform === 'win32' ? '\\' : '/'}${name}.`) },
				{ status: 0, admin: true },
				stderr
			)
		}
	)
	test('still warns and exits 0 for a reused entry when another admin entry has a gitdir it cannot read', () => {
		const dir = repo()
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		const name = worktree.split(/[\\/]/).pop() ?? ''
		rmSync(worktree, { recursive: true, force: true })
		mkdirSync(worktree)
		git(['init', '-q'], worktree)
		mkdirSync(join(dir, '.git', 'worktrees', '0-leftover', 'gitdir'), { recursive: true })
		const { status, stderr } = prepare(dir)
		assert.deepEqual(
			{
				status,
				skipped: /because its old path now holds another git repository/.test(stderr),
				admin: stderr.includes(`worktrees${process.platform === 'win32' ? '\\' : '/'}${name}.`),
			},
			{ status: 0, skipped: true, admin: true },
			stderr
		)
	})
	test('passes a worktree whose value names the same .githooks with a trailing slash', () => {
		const dir = repo()
		git(['config', 'extensions.worktreeConfig', 'true'], dir)
		const worktree = mkdtempSync(join(scratch, 'wt-'))
		git(['worktree', 'add', '-q', worktree, '-b', 'wt'], dir)
		git(['config', '--worktree', 'core.hooksPath', `${join(dir, '.githooks')}/`], worktree)
		const { status, stderr } = prepare(dir)
		assert.deepEqual({ status, stderr }, { status: 0, stderr: '' })
	})
	test(
		'fails closed when git worktree list -z fails for a reason other than the switch',
		{ skip: process.platform === 'win32' },
		() => {
			const dir = repo()
			const { status, stderr } = prepare(
				dir,
				withFakeGit('for arg in "$@"; do [ "$arg" = -z ] && { echo broken >&2; exit 3; }; done')
			)
			assert.deepEqual(
				{
					status,
					named: /because git worktree list failed \(broken\)/.test(stderr),
					hooksPath: git(['config', '--get', 'core.hooksPath'], dir),
				},
				{ status: 1, named: true, hooksPath: '' },
				stderr
			)
		}
	)
})
