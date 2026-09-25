#!/usr/bin/env node
// @ts-check
// Refuses a command that would publish an NDA-protected term to this public repository.
//
// It reads the term list from a file OUTSIDE every repository, so the list itself never
// becomes the leak. This script names no term and is safe to commit.
//
//   list:  $UNIC_NDA_DENYLIST, else ~/.config/unic/nda-denylist.txt
//   scope: this repository only — it is wired in .claude/settings.json, so a session in a
//          client's own repository is unaffected, where those names are legitimate.
//
// It inspects three surfaces, because two of them carry no term in the command string:
//   1. the command itself
//   2. every existing file the command names  (`gh issue create --body-file <path>`)
//   3. the staged diff, for a commit          (`git commit -m "<clean message>"`)
//
// It reads the staged diff of every repository the command can commit in: the session's cwd, each
// `git -C <path>` and each `cd <path>`. Reading the cwd alone let `git -C <worktree> commit` from
// the clone through with an empty diff (#566).
//
// The matching rule lives in `.githooks/nda-match.mjs`, which the git hooks share.
//
// Fails closed: no readable list means no publishing. `touch` the file to opt out.

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

import { findTerm, listPath, readTerms, redact } from '../../.githooks/nda-match.mjs'

const MAX_BYTES = 2_000_000
const START = String.raw`(?:^|[|;&(]\s*|\s)`
// `git -C <worktree> push` is how this repository's own Archon flow publishes
// (.claude/commands/archon-pr-review.md), so the verb is never the first token. Skip git's global
// options — the ones that take a value and the ones that do not — before reading it.
// A value may be quoted and hold spaces: `git -C "/x/my wt" commit`.
const OPTION_VALUE = String.raw`(?:"[^"]*"|'[^']*'|\S+)`
const GIT_OPTIONS = String.raw`(?:\s+(?:-[cC]\s+${OPTION_VALUE}|--(?:git-dir|work-tree|namespace|exec-path)(?:=|\s+)${OPTION_VALUE}|--[\w-]+|-\w))*`
/** @param {string} verbs */
const gitVerb = (verbs) => new RegExp(`${START}git${GIT_OPTIONS}\\s+(?:${verbs})\\b`)
const PUBLISHES = new RegExp(`${START}(?:gh|glab)\\s|${gitVerb('push|commit|tag').source}`)
const COMMITS = gitVerb('commit')

/** @param {string} reason */
function block(reason) {
	process.stderr.write(`Block: ${reason}\n`)
	process.exit(2)
}

/** @param {string} command */
function readNamedFiles(command) {
	/** @type {Array<[string, string]>} */
	const found = []
	for (const raw of command.match(/[^\s'"]+/g) ?? []) {
		const path = raw.replace(/^[('"]+|[)'"]+$/g, '')
		try {
			if (!statSync(path).isFile() || statSync(path).size > MAX_BYTES) continue
			found.push([path, readFileSync(path, 'utf8')])
		} catch {
			// not a readable path; the token was a flag or an argument
		}
	}
	return found
}

// A path argument: double-quoted, single-quoted, or bare.
const PATH_ARG = String.raw`(?:"([^"]*)"|'([^']*)'|([^\s'";&|()]+))`
const CHANGES_DIR = new RegExp(String.raw`(?:^|[\n|;&(])\s*(?:cd|pushd)\s+${PATH_ARG}`, 'g')
const NAMES_DIR = new RegExp(
	String.raw`(?:\s-C\s*|\s--(?:work-tree|git-dir)(?:=|\s+)|\bGIT_(?:DIR|WORK_TREE)=)${PATH_ARG}`,
	'g',
)

/**
 * The session's cwd, then every directory the command moves to or points git at, resolved against
 * it. A git dir counts as its work tree. A path this misses, or cannot read, is the gap: keep the
 * list of forms in step with AGENTS.md.
 * @param {string} command
 * @param {string} cwd
 */
function commitDirs(command, cwd) {
	const dirs = new Set([cwd])
	for (const match of [...command.matchAll(CHANGES_DIR), ...command.matchAll(NAMES_DIR)]) {
		const path = (match[1] ?? match[2] ?? match[3]).replace(/^~(?=\/|$)/, homedir())
		dirs.add(resolve(cwd, path).replace(/[\\/]\.git$/, ''))
	}
	return [...dirs]
}

/** @param {string} cwd */
function stagedDiff(cwd) {
	try {
		return execFileSync('git', ['diff', '--cached', '-U0'], {
			cwd,
			encoding: 'utf8',
			maxBuffer: MAX_BYTES,
		})
	} catch {
		return null
	}
}

async function main() {
	let buf = ''
	for await (const chunk of process.stdin) buf += chunk
	if (!buf.trim()) return

	let event
	try {
		event = JSON.parse(buf)
	} catch {
		return
	}

	if (event?.tool_name !== 'Bash') return
	const command = event?.tool_input?.command ?? ''
	if (!PUBLISHES.test(command)) return

	let terms
	try {
		terms = readTerms(listPath())
	} catch {
		block(
			`cannot read the NDA term list at ${listPath()}, so publishing is refused. ` +
				'Create it with one term per line, or touch it to opt out deliberately. ' +
				'See AGENTS.md § The NDA publish guard.',
		)
		return
	}
	if (terms.length === 0) return

	/** @type {Array<[string, string]>} */
	const surfaces = [['the command itself', command]]
	if (COMMITS.test(command)) {
		for (const dir of commitDirs(command, event?.cwd || process.cwd())) {
			const diff = stagedDiff(dir)
			if (diff === null) block(`cannot read the staged diff in ${dir}, so this commit is refused.`)
			else surfaces.push([`the staged diff in ${dir}`, diff])
		}
	}
	surfaces.push(...readNamedFiles(command))

	for (const [where, text] of surfaces) {
		const term = findTerm(text, terms)
		if (term !== null) {
			block(
				`${where} carries the NDA term ${redact(term)}, and this command publishes ` +
					'outside this machine. Remove it. This repository is public.',
			)
		}
	}
}

main()
