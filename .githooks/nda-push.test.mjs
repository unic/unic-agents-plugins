// @ts-check
// Tests for the NDA scan in `pre-push`. Each push goes through a real `git push` into a local bare
// remote, with `core.hooksPath` set to this checkout's hooks, so a test that ran no hook cannot pass:
// every refusal is asserted on its message, and each has a clean control that pushes.
// Every fixture uses a made-up term: a real term in a test publishes it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const TERM = 'zorblax'
const HOOKS = dirname(fileURLToPath(import.meta.url))
const REFUSED = /refusing this push[\s\S]*carries the NDA term/
const ZERO = '0'.repeat(40)

const scratch = mkdtempSync(join(tmpdir(), 'nda-push-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const list = join(scratch, 'denylist.txt')
writeFileSync(list, `${TERM}\n`)
const noHooks = mkdtempSync(join(scratch, 'no-hooks-'))

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 * @param {string} [input]
 */
const run = (cmd, args, cwd, env = {}, input) =>
	spawnSync(cmd, args, { cwd, input, encoding: 'utf8', env: { ...process.env, UNIC_NDA_DENYLIST: list, ...env } })

/**
 * A setup step that fails would make a refusal test pass for the wrong reason, so it throws.
 * @param {string} dir
 * @param {string[]} args
 */
function git(dir, ...args) {
	const result = run('git', args, dir)
	assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`)
	return result.stdout.trim()
}

/** A clone of a fresh bare remote, which runs this checkout's hooks. */
function createClone() {
	const remote = mkdtempSync(join(scratch, 'remote-'))
	git(remote, 'init', '-q', '--bare')
	return cloneOf(remote)
}

/** @param {string} remote */
function cloneOf(remote) {
	const dir = mkdtempSync(join(scratch, 'local-'))
	git(dir, 'init', '-q')
	git(dir, 'config', 'core.hooksPath', HOOKS)
	git(dir, 'config', 'user.email', 'guard@example.com')
	git(dir, 'config', 'user.name', 'Guard Test')
	git(dir, 'remote', 'add', 'origin', remote)
	return { dir, remote }
}

/**
 * Commits `content` with the hooks off, as `--no-verify`, `am` or another clone would.
 * @param {string} dir
 * @param {string} content
 * @param {string} [message]
 */
function commitUnchecked(dir, content, message = 'change') {
	writeFileSync(join(dir, 'file.txt'), content)
	git(dir, 'add', 'file.txt')
	git(dir, '-c', `core.hooksPath=${noHooks}`, 'commit', '-q', '-m', message)
}

/**
 * Pushes past the hooks, to seed a remote with history that is already published.
 * @param {string} dir
 * @param {string[]} refspecs
 */
const pushUnchecked = (dir, ...refspecs) =>
	git(dir, '-c', `core.hooksPath=${noHooks}`, 'push', '-q', 'origin', ...refspecs)

/**
 * @param {string} dir
 * @param {string[]} args
 */
const push = (dir, ...args) => run('git', ['push', '-q', 'origin', ...args], dir)

/**
 * @param {{ status: number | null, stderr: string }} result
 * @param {RegExp} [reason]
 */
function assertRefused(result, reason = REFUSED) {
	assert.deepEqual(
		{ failed: result.status !== 0, reason: reason.test(result.stderr) },
		{ failed: true, reason: true },
		result.stderr
	)
}

/** @param {{ status: number | null, stderr: string }} result */
const assertPushed = (result) => assert.equal(result.status, 0, result.stderr)

describe('pre-push, new branch', () => {
	test('refuses a commit whose patch adds the term', () => {
		const { dir } = createClone()
		commitUnchecked(dir, `Built for ${TERM}.\n`)
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('pushes the same commit without the term', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n')
		assertPushed(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses a commit whose message carries the term', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n', `fix: ${TERM} typo`)
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses the term in a binary file', () => {
		const { dir } = createClone()
		commitUnchecked(dir, `\0Built for ${TERM}.\n`)
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses a remote ref name that carries the term', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n')
		assertRefused(push(dir, `HEAD:refs/heads/${TERM}-fix`))
	})
	test('passes a term commit that a remote-tracking ref already reaches', () => {
		const { dir } = createClone()
		commitUnchecked(dir, `Built for ${TERM}.\n`)
		pushUnchecked(dir, 'HEAD:refs/heads/main')
		git(dir, 'fetch', '-q', 'origin')
		writeFileSync(join(dir, 'other.txt'), 'clean\n')
		git(dir, 'add', 'other.txt')
		git(dir, 'commit', '-q', '-m', 'other')
		assertPushed(push(dir, 'HEAD:refs/heads/feature'))
	})
})

describe('pre-push, update', () => {
	/** A clone whose `main` is pushed and fetched, holding `seed`. */
	function createPushedClone(seed = 'clean\n') {
		const clone = createClone()
		commitUnchecked(clone.dir, seed)
		pushUnchecked(clone.dir, 'HEAD:refs/heads/main')
		git(clone.dir, 'fetch', '-q', 'origin')
		return clone
	}

	test('refuses an update that adds the term', () => {
		const { dir } = createPushedClone()
		commitUnchecked(dir, `clean\nBuilt for ${TERM}.\n`)
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('pushes the same update without the term', () => {
		const { dir } = createPushedClone()
		commitUnchecked(dir, 'clean\nmore\n')
		assertPushed(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses a term that a later commit in the same push removes', () => {
		const { dir } = createPushedClone()
		commitUnchecked(dir, `clean\nBuilt for ${TERM}.\n`)
		commitUnchecked(dir, 'clean\n')
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('pushes a commit that only deletes a line holding the term', () => {
		const { dir } = createPushedClone(`clean\nBuilt for ${TERM}.\n`)
		commitUnchecked(dir, 'clean\n')
		assertPushed(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses a merge commit whose own patch adds the term', () => {
		const { dir } = createPushedClone()
		git(dir, 'switch', '-q', '-c', 'side')
		writeFileSync(join(dir, 'side.txt'), 'side\n')
		git(dir, 'add', 'side.txt')
		git(dir, 'commit', '-q', '-m', 'side')
		git(dir, 'switch', '-q', '-')
		git(dir, 'merge', '-q', '--no-ff', '--no-commit', 'side')
		writeFileSync(join(dir, 'merge.txt'), `Built for ${TERM}.\n`)
		git(dir, 'add', 'merge.txt')
		git(dir, '-c', `core.hooksPath=${noHooks}`, 'commit', '-q', '-m', 'merge side')
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('pushes a clean merge commit', () => {
		const { dir } = createPushedClone()
		git(dir, 'switch', '-q', '-c', 'side')
		writeFileSync(join(dir, 'side.txt'), 'side\n')
		git(dir, 'add', 'side.txt')
		git(dir, 'commit', '-q', '-m', 'side')
		git(dir, 'switch', '-q', '-')
		git(dir, 'merge', '-q', '--no-ff', '-m', 'merge side', 'side')
		assertPushed(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses an annotated tag whose message carries the term', () => {
		const { dir } = createPushedClone()
		git(dir, 'tag', '-a', 'v1', '-m', `release for ${TERM}`)
		assertRefused(push(dir, 'refs/tags/v1'))
	})
	test('pushes an annotated tag with a clean message', () => {
		const { dir } = createPushedClone()
		git(dir, 'tag', '-a', 'v1', '-m', 'release')
		assertPushed(push(dir, 'refs/tags/v1'))
	})

	test('refuses a force push whose new commit adds the term', () => {
		const { dir } = createPushedClone()
		commitUnchecked(dir, 'clean\nmore\n')
		assertPushed(push(dir, 'HEAD:refs/heads/main'))
		git(dir, 'reset', '-q', '--hard', 'HEAD~1')
		commitUnchecked(dir, `clean\nBuilt for ${TERM}.\n`)
		assertRefused(push(dir, '--force', 'HEAD:refs/heads/main'))
	})
	test('pushes a clean force push', () => {
		const { dir } = createPushedClone()
		commitUnchecked(dir, 'clean\nmore\n')
		assertPushed(push(dir, 'HEAD:refs/heads/main'))
		git(dir, 'reset', '-q', '--hard', 'HEAD~1')
		commitUnchecked(dir, 'clean\nother\n')
		assertPushed(push(dir, '--force', 'HEAD:refs/heads/main'))
	})
	test('pushes a clean force push over a commit this clone never fetched', () => {
		const { dir, remote } = createPushedClone()
		const second = cloneOf(remote)
		git(second.dir, 'fetch', '-q', 'origin')
		git(second.dir, 'switch', '-q', '-c', 'main', 'origin/main')
		commitUnchecked(second.dir, 'clean\nfrom elsewhere\n')
		pushUnchecked(second.dir, 'HEAD:refs/heads/main')
		commitUnchecked(dir, 'clean\nother\n')
		assertPushed(push(dir, '--force', 'HEAD:refs/heads/main'))
	})
	test('refuses a force push with the term over a commit this clone never fetched', () => {
		const { dir, remote } = createPushedClone()
		const second = cloneOf(remote)
		git(second.dir, 'fetch', '-q', 'origin')
		git(second.dir, 'switch', '-q', '-c', 'main', 'origin/main')
		commitUnchecked(second.dir, 'clean\nfrom elsewhere\n')
		pushUnchecked(second.dir, 'HEAD:refs/heads/main')
		commitUnchecked(dir, `clean\nBuilt for ${TERM}.\n`)
		assertRefused(push(dir, '--force', 'HEAD:refs/heads/main'))
	})

	test('pushes the deletion of a branch', () => {
		const { dir } = createPushedClone()
		assertPushed(push(dir, 'HEAD:refs/heads/feature'))
		assertPushed(push(dir, '--delete', 'feature'))
	})
	test('pushes the deletion of a branch whose name carries the term', () => {
		const { dir, remote } = createPushedClone()
		git(remote, 'branch', `${TERM}-old`, 'main')
		assertPushed(push(dir, '--delete', `${TERM}-old`))
	})
})

describe('pre-push, failing closed', () => {
	test('refuses when the term list is missing', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n')
		const result = run('git', ['push', '-q', 'origin', 'HEAD:refs/heads/main'], dir, {
			UNIC_NDA_DENYLIST: join(scratch, 'missing.txt'),
		})
		assertRefused(result, /cannot read the NDA term list/)
	})
	test('refuses when git log cannot walk the commits', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n')
		const parent = git(dir, 'rev-parse', 'HEAD')
		commitUnchecked(dir, 'clean\nmore\n')
		const object = join(dir, '.git', 'objects', parent.slice(0, 2), parent.slice(2))
		chmodSync(object, 0o644)
		rmSync(object)
		const line = `refs/heads/main ${git(dir, 'rev-parse', 'HEAD')} refs/heads/main ${ZERO}\n`
		assertRefused(run('sh', [join(HOOKS, 'pre-push'), 'origin', 'url'], dir, {}, line), /cannot list the commits/)
	})
	test('refuses when node is not on PATH', { skip: process.platform === 'win32' }, () => {
		const { dir } = createClone()
		const bin = join(scratch, 'bin-without-node')
		mkdirSync(bin, { recursive: true })
		for (const tool of ['git', 'cat', 'dirname', 'readlink']) {
			const path = spawnSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).stdout.trim()
			symlinkSync(path, join(bin, tool))
		}
		const line = `refs/heads/main ${ZERO} refs/heads/main ${ZERO}\n`
		const result = spawnSync('/bin/sh', [join(HOOKS, 'pre-push'), 'origin', 'url'], {
			cwd: dir,
			input: line,
			encoding: 'utf8',
			env: { PATH: bin, UNIC_NDA_DENYLIST: list },
		})
		assertRefused(result, /node is not on PATH/)
	})
})

describe('pre-push, git config and objects', () => {
	test('pushes a commit that only deletes a term line under color.ui=always', () => {
		const { dir } = createClone()
		commitUnchecked(dir, `clean\nBuilt for ${TERM}.\n`)
		pushUnchecked(dir, 'HEAD:refs/heads/main')
		git(dir, 'config', 'color.ui', 'always')
		commitUnchecked(dir, 'clean\n')
		assertPushed(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses a root commit that adds the term under log.showRoot=false', () => {
		const { dir } = createClone()
		git(dir, 'config', 'log.showRoot', 'false')
		commitUnchecked(dir, `Built for ${TERM}.\n`)
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses a term commit that git replace hides behind a clean one', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n')
		const clean = git(dir, 'rev-parse', 'HEAD')
		git(dir, 'switch', '-q', '--orphan', 'dirty')
		commitUnchecked(dir, `Built for ${TERM}.\n`)
		git(dir, 'replace', git(dir, 'rev-parse', 'HEAD'), clean)
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('refuses a lightweight tag on a blob that carries the term', () => {
		const { dir } = createClone()
		writeFileSync(join(dir, 'blob.txt'), `Built for ${TERM}.\n`)
		git(dir, 'tag', 'blob-tag', git(dir, 'hash-object', '-w', 'blob.txt'))
		assertRefused(push(dir, 'refs/tags/blob-tag'))
	})
	test('pushes a lightweight tag on a clean blob', () => {
		const { dir } = createClone()
		writeFileSync(join(dir, 'blob.txt'), 'clean\n')
		git(dir, 'tag', 'blob-tag', git(dir, 'hash-object', '-w', 'blob.txt'))
		assertPushed(push(dir, 'refs/tags/blob-tag'))
	})
	test('refuses an annotated tag with a clean message on a blob that carries the term', () => {
		const { dir } = createClone()
		writeFileSync(join(dir, 'blob.txt'), `Built for ${TERM}.\n`)
		git(dir, 'tag', '-a', '-m', 'release', 'blob-tag', git(dir, 'hash-object', '-w', 'blob.txt'))
		assertRefused(push(dir, 'refs/tags/blob-tag'))
	})
	test('refuses a tag on a tree whose file carries the term', () => {
		const { dir } = createClone()
		writeFileSync(join(dir, 'file.txt'), `Built for ${TERM}.\n`)
		git(dir, 'add', 'file.txt')
		git(dir, 'tag', 'tree-tag', git(dir, 'write-tree'))
		assertRefused(push(dir, 'refs/tags/tree-tag'))
	})
})

describe('pre-push, several refs and remotes', () => {
	test('refuses a push of two refs when only the second carries the term', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n')
		git(dir, 'branch', 'a')
		git(dir, 'switch', '-q', '--orphan', 'b')
		commitUnchecked(dir, `Built for ${TERM}.\n`)
		assertRefused(push(dir, 'a:refs/heads/a', 'b:refs/heads/b'))
	})
	test('pushes two clean refs', () => {
		const { dir } = createClone()
		commitUnchecked(dir, 'clean\n')
		git(dir, 'branch', 'a')
		git(dir, 'switch', '-q', '--orphan', 'b')
		commitUnchecked(dir, 'other\n')
		assertPushed(push(dir, 'a:refs/heads/a', 'b:refs/heads/b'))
	})
	test('refuses a term commit that only another remote already has', () => {
		const { dir } = createClone()
		const second = mkdtempSync(join(scratch, 'second-remote-'))
		git(second, 'init', '-q', '--bare')
		git(dir, 'remote', 'add', 'second', second)
		commitUnchecked(dir, `Built for ${TERM}.\n`)
		git(dir, '-c', `core.hooksPath=${noHooks}`, 'push', '-q', 'second', 'HEAD:refs/heads/main')
		git(dir, 'fetch', '-q', 'second')
		assertRefused(push(dir, 'HEAD:refs/heads/main'))
	})
	test('pushes a new branch to the remote that already has the term commit', () => {
		const { dir } = createClone()
		commitUnchecked(dir, `Built for ${TERM}.\n`)
		pushUnchecked(dir, 'HEAD:refs/heads/main')
		git(dir, 'fetch', '-q', 'origin')
		assertPushed(push(dir, 'HEAD:refs/heads/copy'))
	})
})

describe('pre-push, Archon guard', () => {
	/** A clone under `.archon/workspaces/`, as an Archon worktree is. */
	function createArchonClone() {
		const remote = mkdtempSync(join(scratch, 'remote-'))
		git(remote, 'init', '-q', '--bare')
		const dir = join(mkdtempSync(join(scratch, 'archon-')), '.archon', 'workspaces', 'o', 'r', 'worktrees', 'x')
		mkdirSync(dir, { recursive: true })
		git(dir, 'init', '-q')
		git(dir, 'config', 'core.hooksPath', HOOKS)
		git(dir, 'config', 'user.email', 'guard@example.com')
		git(dir, 'config', 'user.name', 'Guard Test')
		git(dir, 'remote', 'add', 'origin', remote)
		commitUnchecked(dir, 'clean\n')
		return dir
	}

	test('refuses a push of develop from an Archon worktree', () => {
		assertRefused(push(createArchonClone(), 'HEAD:refs/heads/develop'), /This push comes from an Archon worktree/)
	})
	test('pushes a feature branch from an Archon worktree', () => {
		assertPushed(push(createArchonClone(), 'HEAD:refs/heads/feature/x'))
	})
})
