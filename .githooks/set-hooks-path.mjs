#!/usr/bin/env node
// @ts-check
// Runs as the root `prepare` script, so `pnpm install` turns on the hooks in `.githooks/`. A clone
// that skips this commits with no NDA guard, and nothing says so.
//
// It points `core.hooksPath` at the main work tree's `.githooks`, as an absolute path. Every linked
// worktree then runs those hooks, including a worktree whose own branch has none, such as a hotfix
// branch cut from `main`. A relative path would make each worktree run its own branch's copy. So
// after moving the clone, run `pnpm install` again.
//
// It does nothing where this directory is not the top of a git work tree: an installed tarball has
// no repository, and a copy inside another repository must not rewrite that repository's hooks.

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'

/** @param {string[]} args */
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** @param {string} reason */
function warn(reason) {
	process.stderr.write(
		`prepare: ${reason}, so the NDA git hooks may be off in this clone.\n` +
			'  Set them by hand: git config core.hooksPath "$(git rev-parse --show-toplevel)/.githooks"\n'
	)
}

let prefix
try {
	prefix = git(['rev-parse', '--show-prefix'])
} catch (error) {
	// No repository at all is the tarball case. Any other failure, such as a `safe.directory`
	// refusal, means a clone whose hooks would silently stay off.
	const stderr = String(/** @type {{ stderr?: unknown }} */ (error).stderr ?? '')
	if (!/not a git repository/i.test(stderr)) warn(`git rev-parse failed (${stderr.trim() || 'git not found'})`)
	process.exit(0)
}
if (prefix !== '') process.exit(0)

try {
	const mainTree = dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir']))
	git(['config', 'core.hooksPath', join(mainTree, '.githooks')])
} catch {
	warn('could not set core.hooksPath')
}
