#!/usr/bin/env node
// @ts-check
// Runs as the root `prepare` script, so `pnpm install` turns on the hooks in `.githooks/`. A clone
// that skips this commits with no git-hook NDA guard, and nothing says so. The Claude hook still
// guards agent sessions.
//
// It points `core.hooksPath` at the main work tree's `.githooks`, as an absolute path. Every linked
// worktree then runs the hooks the main work tree has checked out, including a worktree whose own
// branch has none, such as a hotfix branch cut from `main`. A relative path would make each
// worktree run its own branch's copy. So after moving the clone, run `pnpm install` again.
//
// It does nothing where this directory is not the top of a git work tree: an installed tarball has
// no repository, and a copy inside another repository must not rewrite that repository's hooks.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** @param {string[]} args */
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

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

let prefix
try {
	prefix = git(['rev-parse', '--show-prefix'])
} catch (error) {
	// No git, or no repository at all, is the tarball case. Any other failure, such as a
	// `safe.directory` refusal, means a clone whose hooks would silently stay off.
	const { code, stderr } = /** @type {{ code?: string, stderr?: unknown }} */ (error)
	if (code !== 'ENOENT' && !/not a git repository/i.test(String(stderr))) {
		warn(`git rev-parse failed, so the hooks are off (${causeOf(error)})`, join(process.cwd(), '.githooks'))
	}
	process.exit(0)
}
if (prefix !== '') process.exit(0)

// The first entry of `git worktree list` is normally the main work tree. A bare repository has
// none, and with `--separate-git-dir` git lists the git directory there instead. Both then fall
// back to this work tree's `.githooks`.
const here = join(process.cwd(), '.githooks')
let hooksDir = here
try {
	const [first = ''] = git(['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/)
	const mainTree = first.match(/^worktree (.+)$/m)?.[1]
	const candidate = mainTree && !/^bare$/m.test(first) ? join(mainTree, '.githooks') : ''
	if (candidate && existsSync(candidate)) hooksDir = candidate
	else warn(`found no main work tree with a .githooks, so core.hooksPath points at ${here}`, here)
} catch (error) {
	warn(`git worktree list failed, so core.hooksPath points at ${here} (${causeOf(error)})`, here)
}

// The main work tree may be on a branch that carries none or only some of the commit guards, such as
// `main`, or a `develop` from before `commit-msg`. Every worktree then commits with that gap.
const missing = ['pre-commit', 'commit-msg', 'nda-match.mjs'].filter((file) => !existsSync(join(hooksDir, file)))
if (missing.length > 0) {
	warn(
		`${hooksDir} lacks ${missing.join(', ')}, so no worktree of this clone runs the full NDA commit guards`,
		hooksDir
	)
}

let previous = ''
try {
	previous = git(['config', '--get', 'core.hooksPath'])
} catch {
	// Unset: `git config --get` exits 1, and there is nothing to report.
}

try {
	git(['config', 'core.hooksPath', hooksDir])
	if (previous && previous !== hooksDir) {
		process.stderr.write(`prepare: core.hooksPath was ${previous}, and is now ${hooksDir}.\n`)
	}
} catch (error) {
	warn(`core.hooksPath was not updated, and may still hold an earlier value (${causeOf(error)})`, hooksDir)
}
