#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * base-branch-resolver.mjs — resolve the upstream base branch for Pre-PR mode.
 *
 * Resolution chain (ADR-0009 — Pre-PR mode is a peer operating mode):
 *   1. git symbolic-ref refs/remotes/origin/HEAD → strip "refs/remotes/origin/" prefix.
 *      If symbolic-ref returns a ref shape that does not start with the prefix
 *      (older git, unusual config), silently fall through to the chain below.
 *   2. git rev-parse --verify origin/develop
 *   3. git rev-parse --verify origin/main
 *   4. git rev-parse --verify origin/master
 *   5. Throw — no resolvable base branch found
 *
 * All git invocations go through an injectable Exec so the function is unit-testable
 * without a real git repository.
 */

import { pathToFileURL } from 'node:url'
import { realExec } from './exec.mjs'

/** @import { Exec } from './exec.mjs' */

const SYMBOLIC_REF_PREFIX = 'refs/remotes/origin/'
const FALLBACK_BRANCHES = ['develop', 'main', 'master']

/**
 * Resolve the base branch for a Pre-PR diff.
 *
 * Tries git symbolic-ref for the canonical tracking branch, then falls back
 * through develop → main → master via rev-parse --verify. Throws when none
 * can be found.
 *
 * @param {Exec} exec - injectable git executor; use realExec in production
 * @returns {string} resolved branch name (e.g. "develop", "main")
 * @throws {Error} when no base branch is resolvable
 */
export function resolveBaseBranch(exec) {
	if (typeof exec !== 'function') {
		throw new Error('resolveBaseBranch: exec must be a function (pass realExec in production)')
	}
	const symref = exec('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'])
	if (symref.ok) {
		const ref = symref.stdout.trim()
		if (ref.startsWith(SYMBOLIC_REF_PREFIX)) {
			return ref.slice(SYMBOLIC_REF_PREFIX.length)
		}
		process.stderr.write(
			`resolve-base-branch: symbolic-ref succeeded but returned an unexpected ref shape (${ref}); falling back to develop→main→master.\n`
		)
	}

	for (const branch of FALLBACK_BRANCHES) {
		const verify = exec('git', ['rev-parse', '--verify', `origin/${branch}`])
		if (verify.ok) return branch
	}

	throw new Error(
		'Cannot resolve base branch: no origin/HEAD, origin/develop, origin/main, or origin/master found. ' +
			'Run `git fetch origin` and retry, or check your remote configuration.'
	)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const branch = resolveBaseBranch(realExec)
		process.stdout.write(`${branch}\n`)
	} catch (err) {
		process.stderr.write(`resolve-base-branch: ${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	}
}
