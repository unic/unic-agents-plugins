#!/usr/bin/env node
// @ts-check
// Refuses a Bash command that would publish an NDA-protected term to this public repository.
//
// It guards what git never sees: the text of `gh` and `glab` commands and the files they name. Git
// guards what git writes and sends. `pre-commit` and `commit-msg` read the real staged content and
// message, and `pre-push` reads every commit a push sends. So for git this hook checks only that
// those hooks will run. It reads no staged diff and parses no commit directory. See
// docs/adr/0036-split-nda-guards-by-what-each-sees.md.
//
// The checks, in order:
//   1. A command whose own text holds `--no-verify` or `hookspath`, in any case, is refused, whatever
//      the verb. Both switch the git hooks off.
//   2. A command with `push` as a word is refused unless the session's cwd is in a repository whose
//      `core.hooksPath` points at the `.githooks` of that repository's main work tree.
//   3. A command with `git`, `gh` or `glab` as a word anywhere has its text scanned for a term.
//   4. A command with `gh` or `glab` as a word is refused when it also holds `cd` or `pushd`, because
//      a relative path after them would resolve somewhere this hook does not look.
//   5. For such a command, the text is split on whitespace, quotes, `=`, `@`, `<`, `(`, `)` and `$`,
//      and every piece that is an existing file, resolved against the session's cwd, is scanned.
//      A file over 2 MB is refused, not skipped. Reading more than the command needs costs nothing:
//      the hook refuses only when it finds a term.
//
// It fails closed. An empty or malformed payload, an exception, or an unreadable term list exits 2,
// the only exit that blocks a `PreToolUse` call. `touch` the list to opt out.
//
//   list:  $UNIC_NDA_DENYLIST, else ~/.config/unic/nda-denylist.txt
//   scope: this repository only. It is wired in .claude/settings.json, so a session in a client's
//          own repository is unaffected, where those names are legitimate.
//
// The matching rule lives in `.githooks/nda-match.mjs`, which the git hooks share.

import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

const MAX_BYTES = 2_000_000
const SWITCHES_HOOKS_OFF = /--no-verify|hookspath/i
const PUSHES = /\bpush\b/
const RUNS_GIT_OR_GH = /\b(?:git|gh|glab)\b/
const RUNS_GH = /\b(?:gh|glab)\b/
const CHANGES_DIR = /\b(?:cd|pushd)\b/
const PATH_SEPARATORS = /[\s'"=@<()$]+/

/** @param {string} reason @returns {never} */
function block(reason) {
	process.stderr.write(`Block: ${reason}\n`)
	process.exit(2)
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** @param {string} path */
function toRealPath(path) {
	try {
		return realpathSync.native(path)
	} catch {
		return resolve(path)
	}
}

/**
 * Does `cwd` sit in a repository whose `core.hooksPath` is its main work tree's `.githooks`?
 * @param {string} cwd
 */
async function isPushGuarded(cwd) {
	const { findMainWorkTree } = await import('../../.githooks/main-work-tree.mjs')
	try {
		const top = git(['rev-parse', '--show-toplevel'], cwd)
		const hooksPath = git(['config', '--get', 'core.hooksPath'], cwd)
		const mainTree = findMainWorkTree(git(['worktree', 'list', '--porcelain'], cwd))
		if (!mainTree) return false
		const expected = toRealPath(join(mainTree, '.githooks'))
		const actual = toRealPath(isAbsolute(hooksPath) ? hooksPath : join(top, hooksPath))
		return process.platform === 'win32' ? expected.toLowerCase() === actual.toLowerCase() : expected === actual
	} catch {
		// Not a repository, or no `core.hooksPath`: git exits non-zero for both.
		return false
	}
}

/**
 * Every existing file a piece of the command names, resolved against the session's cwd.
 * @param {string} command
 * @param {string} cwd
 * @returns {Array<[string, string]>}
 */
function readNamedFiles(command, cwd) {
	/** @type {Array<[string, string]>} */
	const found = []
	for (const piece of new Set(command.split(PATH_SEPARATORS).filter(Boolean))) {
		const path = resolve(cwd, piece)
		let stats
		try {
			stats = statSync(path)
		} catch {
			// Not a path: the piece was a flag or an argument.
			continue
		}
		if (!stats.isFile()) continue
		if (stats.size > MAX_BYTES) block(`${path} is larger than 2 MB, so this hook cannot scan it and refuses the command.`)
		found.push([path, readFileSync(path, 'utf8')])
	}
	return found
}

async function main() {
	let buf = ''
	for await (const chunk of process.stdin) buf += chunk
	if (!buf.trim()) block('the hook received an empty payload, so it cannot check this command.')

	let event
	try {
		event = JSON.parse(buf)
	} catch {
		block('the hook received a payload that is not JSON, so it cannot check this command.')
	}

	if (event.tool_name !== 'Bash') return
	/** @type {string} */
	const command = event.tool_input.command
	const cwd = event.cwd || process.cwd()

	if (SWITCHES_HOOKS_OFF.test(command)) {
		block(
			'this command holds --no-verify or hooksPath, which switch the NDA git hooks off. ' +
				'To mention either in a commit message, write the message to a file and commit with -F <file>. ' +
				'An authorised use is for the maintainer to run with !.',
		)
	}
	if (PUSHES.test(command) && !(await isPushGuarded(cwd))) {
		block(
			`${cwd} is not in a repository whose core.hooksPath points at its main work tree's .githooks, ` +
				'so pre-push would not scan this push. Push from the unic-agents-plugins clone or one of its ' +
				'worktrees after pnpm install, or have the maintainer run it with !.',
		)
	}
	if (!RUNS_GIT_OR_GH.test(command)) return

	const { findTerm, getListPath, readTerms, redact } = await import('../../.githooks/nda-match.mjs')
	let terms = []
	try {
		terms = readTerms(getListPath())
	} catch {
		block(
			`cannot read the NDA term list at ${getListPath()}, so publishing is refused. ` +
				'Create it with one term per line, or touch it to opt out deliberately. ' +
				'See AGENTS.md § The NDA publish guard.',
		)
	}
	if (terms.length === 0) return

	/** @type {Array<[string, string]>} */
	const surfaces = [['the command itself', command]]
	if (RUNS_GH.test(command)) {
		if (CHANGES_DIR.test(command)) {
			block('this gh or glab command also holds cd or pushd. Name every file by its absolute path, or have the maintainer run it with !.')
		}
		surfaces.push(...readNamedFiles(command, cwd))
	}

	for (const [where, text] of surfaces) {
		const term = findTerm(text, terms)
		if (term !== null) {
			block(`${where} carries the NDA term ${redact(term)}, and this repository is public. Remove it.`)
		}
	}
}

main().catch((/** @type {unknown} */ error) => {
	const { name, message } = /** @type {{ name?: unknown, message?: unknown }} */ (error ?? {})
	block(`the NDA hook failed with ${String(name ?? 'an error')}: ${String(message ?? error)}. The command is refused.`)
})
