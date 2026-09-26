#!/usr/bin/env node
// @ts-check
// Runs as the root `prepare` script, so `pnpm install` turns on the hooks in `.githooks/`. A clone
// that skips this commits and pushes with no git-hook NDA guard, and nothing says so. The Claude hook
// then refuses an agent session's push, but it scans no commit.
//
// It points `core.hooksPath` at the main work tree's `.githooks`, as an absolute path. Every linked
// worktree then runs the hooks the main work tree has checked out, including a worktree whose own
// branch has none, such as a hotfix branch cut from `main`. A relative path would make each
// worktree run its own branch's copy. So after moving the clone, run `pnpm install` again.
//
// It does nothing where this directory is not the top of a git work tree: an installed tarball has
// no repository, and a copy inside another repository must not rewrite that repository's hooks.
//
// It exits 1 wherever it leaves the hooks off, so `pnpm install` fails and shows why. At a terminal
// pnpm replaces the output of a script that exits 0 with "Done", so a warning alone reaches nobody.
// The fallbacks for a bare or `--separate-git-dir` layout still set the hooks, so they only warn. It
// cannot report what happens while it does not run: an install with `--ignore-scripts`, a moved
// clone, or an install on a branch whose `package.json` has no `prepare` script, such as `main`.
// Nor can it see a change after it ran: a later branch switch in the main work tree, or an
// `includeIf` in the git config whose condition starts to hold. It also only warns, and exits 0,
// when it skips a stale worktree, because it cannot see where a worktree moved by hand now lives.
//
// With `extensions.worktreeConfig`, each worktree can hold its own value, so it reads the value back
// in every worktree of the clone, not only this one.
//
// Each message says "because" and its reason before any path. At a terminal pnpm may cut a line
// at its width, and a long path first would push the reason out of sight.

import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync, readdirSync, readFileSync, realpathSync, writeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { findMainWorkTree, listWorktrees } from './main-work-tree.mjs'

// Git exports GIT_DIR to hooks in linked worktrees. Inherited, it would point every call below at
// another repository, and the write at the end would change that repository's hooks. GIT_CONFIG
// would redirect the write to another file, and the `-c` variables would override what it reads back.
const { GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR, GIT_CONFIG, GIT_CONFIG_PARAMETERS, GIT_CONFIG_COUNT, ...env } =
	process.env

/** @param {string[]} args */
const git = (args) =>
	execFileSync('git', args, { encoding: 'utf8', env, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** @param {unknown} error */
function causeOf(error) {
	const { stderr, message } = /** @type {{ stderr?: unknown, message?: unknown }} */ (error)
	return String(stderr ?? '').trim() || String(message ?? error)
}

/** @param {string} reason */
const warn = (reason) => process.stderr.write(`prepare: ${reason}.\n`)

/** @param {string} reason */
function fail(reason) {
	warn(reason)
	process.exitCode = 1
}

// Print the remedy once, however many failures came before it. A path set by hand is no remedy: with
// the main work tree on `main`, it holds only `pre-push`. The write is synchronous, because an
// exit handler cannot wait for a stream.
process.on('exit', (code) => {
	if (code === 0) return
	writeSync(
		2,
		'  Some or all of the NDA git hooks may be off until the cause above is fixed. Then run pnpm install again. If the main work tree is on a branch without the full .githooks, check out a branch that carries it in the main work tree, then run pnpm install there.\n'
	)
})

// No `.git` here or above is the tarball case. Look on disk rather than read git's error: a clone
// whose git is missing from PATH fails the same way as no repository, and the message is localised.
/** @param {string} dir @returns {boolean} */
const isInRepository = (dir) => existsSync(join(dir, '.git')) || (dirname(dir) !== dir && isInRepository(dirname(dir)))
if (!isInRepository(process.cwd())) process.exit(0)

let prefix
try {
	prefix = git(['rev-parse', '--show-prefix'])
} catch (error) {
	fail(`the hooks are off, because git rev-parse failed (${causeOf(error)})`)
	process.exit()
}
if (prefix !== '') process.exit(0)

// A bare repository and a `--separate-git-dir` layout have no main work tree with a `.githooks`
// (see main-work-tree.mjs). Both fall back to this work tree's `.githooks`. A linked worktree of a main work tree that has no
// `.githooks` must not: every worktree would run this one's hooks, and lose them when it is removed.
const here = join(process.cwd(), '.githooks')
let hooksDir = here
let porcelain
try {
	// `-z` reads a path that holds a newline, but needs git 2.36. Older git rejects it, so fall back to
	// the plain form. A failure of the plain form still reaches the catch below and fails closed.
	try {
		porcelain = git(['worktree', 'list', '--porcelain', '-z'])
	} catch {
		porcelain = git(['worktree', 'list', '--porcelain'])
	}
	const mainTree = findMainWorkTree(porcelain)
	const candidate = mainTree ? join(mainTree, '.githooks') : ''
	const isLinked = git(['rev-parse', '--git-dir']) !== git(['rev-parse', '--git-common-dir'])
	if (candidate && existsSync(candidate)) hooksDir = candidate
	else if (candidate && isLinked) {
		fail(
			`the hooks stay off, because this is a linked worktree and its main work tree has no .githooks. prepare looked for ${candidate}`
		)
		process.exit()
	} else
		warn(
			`core.hooksPath points at this work tree's .githooks, because git found no main work tree with a .githooks. It is ${here}`
		)
} catch (error) {
	// A git failure is not a layout, so it gets no fallback.
	fail(`the hooks are off, because git worktree list failed (${causeOf(error)})`)
	process.exit()
}

// The main work tree may be on a branch that carries none or only some of the NDA guards, such as
// `main`, or a `develop` from before `commit-msg`. Every worktree then commits with that gap.
const missing = ['pre-commit', 'commit-msg', 'pre-push', 'nda-match.mjs', 'nda-push.mjs', 'main-work-tree.mjs'].filter(
	(file) => !existsSync(join(hooksDir, file))
)
if (missing.length > 0) {
	fail(
		`no worktree of this clone runs the full NDA guards, because the hooks directory lacks ${missing.join(', ')}. It is ${hooksDir}`
	)
}
// Git skips a hook that is not executable and prints only a hint. Windows has no such bit.
if (process.platform !== 'win32') {
	for (const file of ['pre-commit', 'commit-msg', 'pre-push'].filter((name) => !missing.includes(name))) {
		try {
			accessSync(join(hooksDir, file), constants.X_OK)
		} catch {
			fail(`git skips ${file}, because it is not executable. Fix it with: chmod +x "${join(hooksDir, file)}"`)
		}
	}
}

let previous = ''
try {
	previous = git(['config', '--get', 'core.hooksPath'])
} catch {
	// Unset: `git config --get` exits 1, and there is nothing to report.
}

try {
	git(['config', 'core.hooksPath', hooksDir])
} catch (error) {
	fail(`core.hooksPath may still hold an earlier value, because git could not update it (${causeOf(error)})`)
	process.exit()
}

/**
 * Read the value git uses, here or in the worktree that `where` names as `-C <path>`. A value in
 * `config.worktree` wins over the one just written.
 * @param {string[]} where
 * @returns {string} git's `<origin>\t<value>` line, or `nothing` when no value is set
 * @throws when git itself fails, for example when it cannot read that worktree's config
 */
function readEffective(where) {
	try {
		return git([...where, 'config', '--show-origin', '--get', 'core.hooksPath'])
	} catch (error) {
		// `git config --get` exits 1 with no message when the key is unset. Anything else is a failure.
		const { status, stderr } = /** @type {{ status?: unknown, stderr?: unknown }} */ (error)
		if (status === 1 && String(stderr ?? '').trim() === '') return 'nothing'
		throw error
	}
}

let effective
try {
	effective = readEffective([])
} catch (error) {
	fail(`the hooks may be off here, because git could not read the config back (${causeOf(error)})`)
	process.exit()
}
if (!effective.endsWith(`\t${hooksDir}`)) {
	fail(
		`the hooks are off here, because another value wins over the one just written. core.hooksPath resolves to ${effective.replace('\t', ' ')}, not ${hooksDir}. For a value in config.worktree, remove it with: git config --worktree --unset core.hooksPath`
	)
} else if (previous && previous !== hooksDir) {
	warn(
		`core.hooksPath changed, because pnpm install set it to this clone's .githooks. It was ${previous}, and is now ${hooksDir}`
	)
}

// Every other worktree reads the shared value too, unless its own `config.worktree` overrides it.
// A stale worktree must not break every install, so skip one that git marks prunable or whose
// directory is gone. Such a worktree may still be in use: git marks a worktree moved by hand, or one
// whose directory it cannot read, as prunable, and lists a locked one moved by hand as locked. It
// still commits with its own `config.worktree`. prepare cannot see the new path, so the warning
// gives the remedy. Skip also an entry whose old path now holds another repository: `-C` would read
// and change that repository instead.
let top
let commonDir
try {
	top = git(['rev-parse', '--show-toplevel'])
	commonDir = resolveReal(git(['rev-parse', '--git-common-dir']), process.cwd())
} catch (error) {
	fail(`the other worktrees went unchecked, because git rev-parse failed (${causeOf(error)})`)
	process.exit()
}
for (const { path, isBare, isPrunable, isLocked } of listWorktrees(porcelain)) {
	if (isBare || !path || path === top) continue
	if (isPrunable || !existsSync(path)) {
		const prune = isLocked ? `run git worktree unlock "${path}", then git worktree prune` : 'run git worktree prune'
		warn(
			`skipped the core.hooksPath check in one worktree that git cannot reach, because git marks it prunable or its directory is gone. It may still be in use, for example after a move by hand or under a parent directory git cannot read, and then its hooks may be off. If it still exists, make it reachable, or run git worktree repair <new path>, then pnpm install. Only when it is gone, ${prune}. Its old path is ${path}`
		)
		continue
	}
	let value
	try {
		if (resolveReal(git(['-C', path, 'rev-parse', '--git-common-dir']), path) !== commonDir) {
			warn(
				`skipped the core.hooksPath check in one worktree entry, because its old path now holds another git repository. git worktree prune does not clear such an entry, so remove its admin directory by hand: ${findAdminEntry(path)}. Its old path is ${path}`
			)
			continue
		}
		value = readEffective(['-C', path])
	} catch (error) {
		fail(
			`the hooks may be off in another worktree of this clone, because git could not read its config (${causeOf(error)}). The worktree is ${path}`
		)
		continue
	}
	if (!value.endsWith(`\t${hooksDir}`)) {
		fail(
			`the hooks are off in another worktree of this clone, because core.hooksPath resolves there to ${value.replace('\t', ' ')}, not ${hooksDir}. The worktree is ${path}. For a value in config.worktree, remove it with: git -C "${path}" config --worktree --unset core.hooksPath`
		)
	}
}

/**
 * Resolve a path git printed, which may be relative to `base`, to one spelling per directory.
 * @param {string} path
 * @param {string} base
 */
function resolveReal(path, base) {
	const absolute = resolve(base, path)
	try {
		return realpathSync.native(absolute)
	} catch {
		// A path that cannot be resolved further still compares by its absolute spelling.
		return absolute
	}
}

/**
 * The admin directory under `<common dir>/worktrees` whose `gitdir` file names `path`, or a
 * placeholder when none does or the directory cannot be read. A relative `gitdir`, which git writes
 * with `worktree.useRelativePaths`, is relative to its own admin directory. An entry whose `gitdir`
 * cannot be read is passed over, so a leftover entry never turns this warning into a failure.
 * @param {string} path
 */
function findAdminEntry(path) {
	const admin = join(commonDir, 'worktrees')
	const target = resolveReal(join(path, '.git'), path)
	let names = []
	try {
		names = readdirSync(admin)
	} catch {
		// No readable admin directory: the placeholder below still tells the reader where to look.
	}
	for (const name of names) {
		try {
			const gitdir = readFileSync(join(admin, name, 'gitdir'), 'utf8').trim()
			if (resolveReal(gitdir, join(admin, name)) === target) return join(admin, name)
		} catch {
			// A `gitdir` that is missing, a directory or unreadable names no path. Try the next entry.
		}
	}
	return join(admin, '<name>')
}
