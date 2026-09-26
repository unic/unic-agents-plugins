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

import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { findMainWorkTree } from './main-work-tree.mjs'

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

/**
 * @param {string} reason
 * @param {string} hooksDir
 */
function warn(reason, hooksDir) {
	process.stderr.write(
		`prepare: ${reason}.\n` +
			`  Check the NDA git hooks, or set them by hand: git config core.hooksPath "${hooksDir}"\n`
	)
}

/**
 * @param {string} reason
 * @param {string} hooksDir
 */
function fail(reason, hooksDir) {
	warn(reason, hooksDir)
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
	fail(`git rev-parse failed, so the hooks are off (${causeOf(error)})`, join(process.cwd(), '.githooks'))
	process.exit()
}
if (prefix !== '') process.exit(0)

// A bare repository and a `--separate-git-dir` layout have no main work tree with a `.githooks`
// (see main-work-tree.mjs). Both fall back to this work tree's `.githooks`. A linked worktree of a main work tree that has no
// `.githooks` must not: every worktree would run this one's hooks, and lose them when it is removed.
const here = join(process.cwd(), '.githooks')
let hooksDir = here
try {
	const mainTree = findMainWorkTree(git(['worktree', 'list', '--porcelain']))
	const candidate = mainTree ? join(mainTree, '.githooks') : ''
	const isLinked = git(['rev-parse', '--git-dir']) !== git(['rev-parse', '--git-common-dir'])
	if (candidate && existsSync(candidate)) hooksDir = candidate
	else if (candidate && isLinked) {
		fail(
			`${candidate} does not exist, and this is a linked worktree, so the hooks stay off. Check out a branch that carries .githooks in the main work tree, then run pnpm install`,
			candidate
		)
		process.exit()
	} else warn(`found no main work tree with a .githooks, so core.hooksPath points at ${here}`, here)
} catch (error) {
	// A git failure is not a layout, so it gets no fallback.
	fail(`git worktree list failed, so the hooks are off (${causeOf(error)})`, here)
	process.exit()
}

// The main work tree may be on a branch that carries none or only some of the NDA guards, such as
// `main`, or a `develop` from before `commit-msg`. Every worktree then commits with that gap.
const missing = ['pre-commit', 'commit-msg', 'pre-push', 'nda-match.mjs', 'nda-push.mjs', 'main-work-tree.mjs'].filter(
	(file) => !existsSync(join(hooksDir, file))
)
if (missing.length > 0) {
	fail(`${hooksDir} lacks ${missing.join(', ')}, so no worktree of this clone runs the full NDA guards`, hooksDir)
}
// Git skips a hook that is not executable and prints only a hint. Windows has no such bit.
if (process.platform !== 'win32') {
	for (const file of ['pre-commit', 'commit-msg', 'pre-push'].filter((name) => !missing.includes(name))) {
		try {
			accessSync(join(hooksDir, file), constants.X_OK)
		} catch {
			fail(
				`${join(hooksDir, file)} is not executable, so git skips it. Fix it with: chmod +x "${join(hooksDir, file)}"`,
				hooksDir
			)
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
	fail(`core.hooksPath was not updated, and may still hold an earlier value (${causeOf(error)})`, hooksDir)
	process.exit()
}

// With `extensions.worktreeConfig`, a value in `config.worktree` wins over the one just written.
let effective
try {
	effective = git(['config', '--show-origin', '--get', 'core.hooksPath'])
} catch (error) {
	effective = `nothing (${causeOf(error)})`
}
if (!effective.endsWith(`\t${hooksDir}`)) {
	fail(
		`core.hooksPath resolves to ${effective.replace('\t', ' ')}, which wins over ${hooksDir}. For a value in config.worktree, remove it with: git config --worktree --unset core.hooksPath`,
		hooksDir
	)
} else if (previous && previous !== hooksDir) {
	process.stderr.write(`prepare: core.hooksPath was ${previous}, and is now ${hooksDir}.\n`)
}
