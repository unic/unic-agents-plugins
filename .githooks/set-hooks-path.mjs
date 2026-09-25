#!/usr/bin/env node
// @ts-check
// Runs as the root `prepare` script, so `pnpm install` turns on the hooks in `.githooks/` for this
// clone and every worktree of it. A clone that skips this commits with no NDA guard, and nothing
// says so.
//
// It does nothing where this directory is not the top of a git work tree: an installed tarball has
// no repository, and a copy inside another repository must not rewrite that repository's hooks.

import { execFileSync } from 'node:child_process'

/** @param {string[]} args */
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

let prefix
try {
	prefix = git(['rev-parse', '--show-prefix']).trim()
} catch {
	process.exit(0)
}
if (prefix !== '') process.exit(0)

try {
	git(['config', 'core.hooksPath', '.githooks'])
} catch {
	process.stderr.write(
		'prepare: could not set core.hooksPath to .githooks, so the NDA git hooks are off in this clone.\n' +
			'  Run it by hand: git config core.hooksPath .githooks\n'
	)
}
