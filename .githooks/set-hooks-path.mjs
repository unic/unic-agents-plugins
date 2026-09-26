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
// `includeIf` in the git config whose condition starts to hold.
//
// With `extensions.worktreeConfig`, each worktree can hold its own value, so it reads the value back
// in every worktree of the clone, not only this one.
//
// Each message puts its reason before any path. At a terminal pnpm may cut a line at the terminal
// width, and a long path first would push the reason out of sight.

import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

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

// A path set by hand is no remedy. With the main work tree on `main`, it holds only `pre-push`.
/** @param {string} reason */
function fail(reason) {
	warn(reason)
	process.stderr.write(
		'  The NDA git hooks stay off until pnpm install passes. Fix the cause above. If the main work tree is on a branch without .githooks, check out one that carries it there, then run pnpm install there.\n'
	)
	process.exitCode = 1
}

// No `.git` here or above is the tarball case. Look on disk rather than read git's error: a clone
// whose git is missing from PATH fails the same way as no repository, and the message is localised.
/** @param {string} dir @returns {boolean} */
const isInRepository = (dir) => existsSync(join(dir, '.git')) || (dirname(dir) !== dir && isInRepository(dirname(dir)))
if (!isInRepository(process.cwd())) process.exit(0)

let prefix
try {
	prefix = git(['rev-parse', '--show-prefix'])
} catch (error) {
	fail(`git rev-parse failed, so the hooks are off (${causeOf(error)})`)
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
	porcelain = git(['worktree', 'list', '--porcelain'])
	const mainTree = findMainWorkTree(porcelain)
	const candidate = mainTree ? join(mainTree, '.githooks') : ''
	const isLinked = git(['rev-parse', '--git-dir']) !== git(['rev-parse', '--git-common-dir'])
	if (candidate && existsSync(candidate)) hooksDir = candidate
	else if (candidate && isLinked) {
		fail(`the hooks stay off, because this is a linked worktree and its main work tree has no ${candidate}`)
		process.exit()
	} else warn(`found no main work tree with a .githooks, so core.hooksPath points at ${here}`)
} catch (error) {
	// A git failure is not a layout, so it gets no fallback.
	fail(`git worktree list failed, so the hooks are off (${causeOf(error)})`)
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
	fail(`core.hooksPath was not updated, and may still hold an earlier value (${causeOf(error)})`)
	process.exit()
}

/**
 * The value git uses, with the file it comes from, here or in the worktree that `where` names as
 * `-C <path>`. A value in `config.worktree` wins over the one just written.
 * @param {string[]} where
 */
function readEffective(where) {
	try {
		return git([...where, 'config', '--show-origin', '--get', 'core.hooksPath'])
	} catch (error) {
		return `nothing (${causeOf(error)})`
	}
}

const effective = readEffective([])
if (!effective.endsWith(`\t${hooksDir}`)) {
	fail(
		`another value wins over the one just written, so the hooks are off here. core.hooksPath resolves to ${effective.replace('\t', ' ')}, not ${hooksDir}. For a value in config.worktree, remove it with: git config --worktree --unset core.hooksPath`
	)
} else if (previous && previous !== hooksDir) {
	process.stderr.write(`prepare: core.hooksPath was ${previous}, and is now ${hooksDir}.\n`)
}

// Every other worktree reads the shared value too, unless its own `config.worktree` overrides it.
// A stale worktree must not break every install, so skip one that git marks prunable or whose
// directory is gone.
const top = git(['rev-parse', '--show-toplevel'])
for (const { path, isBare, isPrunable } of listWorktrees(porcelain)) {
	if (isBare || !path || path === top) continue
	if (isPrunable || !existsSync(path)) {
		warn(
			`skipped the core.hooksPath check in a stale worktree, which git marks prunable or whose directory is gone: ${path}`
		)
		continue
	}
	const value = readEffective(['-C', path])
	if (!value.endsWith(`\t${hooksDir}`)) {
		fail(
			`the hooks are off in another worktree of this clone, because core.hooksPath resolves there to ${value.replace('\t', ' ')}, not ${hooksDir}. The worktree is ${path}. For a value in config.worktree, remove it with: git -C "${path}" config --worktree --unset core.hooksPath`
		)
	}
}
