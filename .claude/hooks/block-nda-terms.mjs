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
// Fails closed: no readable list means no publishing. `touch` the file to opt out.

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const MAX_BYTES = 2_000_000
const PUBLISHES = /(?:^|[|;&(]\s*|\s)(?:gh|glab)\s|(?:^|[|;&(]\s*|\s)git\s+(?:push|commit|tag)\b/
const COMMITS = /(?:^|[|;&(]\s*|\s)git\s+commit\b/

const listPath = process.env.UNIC_NDA_DENYLIST ?? join(homedir(), '.config', 'unic', 'nda-denylist.txt')

/** @param {string} term */
const redact = (term) => term.slice(0, 2) + '*'.repeat(Math.max(1, term.length - 2))

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

/** @param {string} cwd */
function stagedDiff(cwd) {
	try {
		return execFileSync('git', ['diff', '--cached', '-U0'], {
			cwd: cwd || process.cwd(),
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
		terms = readFileSync(listPath, 'utf8')
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'))
	} catch {
		block(
			`cannot read the NDA term list at ${listPath}, so publishing is refused. ` +
				'Create it with one term per line, or touch it to opt out deliberately. ' +
				'See AGENTS.md § The NDA publish guard.',
		)
		return
	}
	if (terms.length === 0) return

	/** @type {Array<[string, string]>} */
	const surfaces = [['the command itself', command]]
	if (COMMITS.test(command)) {
		const diff = stagedDiff(event?.cwd ?? '')
		if (diff === null) block('cannot read the staged diff, so this commit is refused.')
		else surfaces.push(['the staged diff', diff])
	}
	surfaces.push(...readNamedFiles(command))

	for (const [where, text] of surfaces) {
		const haystack = text.toLowerCase()
		for (const term of terms) {
			if (haystack.includes(term.toLowerCase())) {
				block(
					`${where} carries the NDA term ${redact(term)}, and this command publishes ` +
						'outside this machine. Remove it. This repository is public.',
				)
			}
		}
	}
}

main()
