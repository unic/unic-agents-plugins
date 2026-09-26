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
// The checks, in the order they run:
//   1. A command whose own text holds `--no-ver` (every abbreviation git accepts for `--no-verify`)
//      or `hookspath`, in any case, is refused, whatever the verb. Both can switch the git hooks off.
//   2. A command with `send-pack` as a word is refused: git runs no `pre-push` for it. A command with
//      `push` as a word is refused unless `pre-push` of this clone will run: the session's cwd must be
//      in this clone or one of its worktrees, `core.hooksPath` must point at the main work tree's
//      `.githooks`, and that directory must hold `pre-push` and `nda-push.mjs`, with `pre-push`
//      executable where the OS has an executable bit. The refusal names which of these failed.
//   Only a command with `git`, `gh` or `glab` as a word anywhere goes on, and only when the term
//   list holds a term. An empty list turns off the term checks, but not checks 1 and 2.
//   3. A command with `gh` or `glab` as a word is refused when it also holds `cd` or `pushd`, because
//      a relative path after them would resolve somewhere this hook does not look.
//   4. For a `gh` or `glab` command, the text is split on whitespace, quotes, backticks, `=`, `@`,
//      `<`, `(`, `)`, `$`, `;`, `&` and `|`, and each quoted string is also tried whole. Every piece
//      that is an existing file, resolved against the session's cwd with a leading `~/` expanded, is
//      read, except the `gh` or `glab` executable itself. A file over 2 MB is refused, not skipped.
//      Reading more than the command needs costs nothing: the hook refuses only when it finds a term.
//   5. The command text and every file read are scanned for a term.
//
// It fails closed. A payload that is empty or not a JSON object, an exception, or an unreadable term
// list exits 2, the only exit that blocks a `PreToolUse` call. `touch` the list to opt out.
//
//   list:  $UNIC_NDA_DENYLIST, else ~/.config/unic/nda-denylist.txt
//   scope: this repository only. It is wired in .claude/settings.json, so a session in a client's
//          own repository is unaffected, where those names are legitimate.
//
// The matching rule lives in `.githooks/nda-match.mjs`, which the git hooks share.

import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_BYTES = 2_000_000
const SWITCHES_HOOKS_OFF = /--no-ver|hookspath/i
const PUSHES = /\bpush\b/
const SENDS_PACK = /\bsend-pack\b/
const RUNS_GIT_OR_GH = /\b(?:git|gh|glab)\b/
const RUNS_GH = /\b(?:gh|glab)\b/
const CHANGES_DIR = /\b(?:cd|pushd)\b/
const PATH_SEPARATORS = /[\s'"`=@<()$;&|]+/
const QUOTED = /"([^"]*)"|'([^']*)'/g
const GH_EXECUTABLES = new Set(['gh', 'glab', 'gh.exe', 'glab.exe'])
const HOOK_DIR = dirname(fileURLToPath(import.meta.url))

/** @param {string} reason @returns {never} */
function block(reason) {
	process.stderr.write(`Block: ${reason}\n`)
	process.exit(2)
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
const git = (args, cwd) =>
	execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** @param {string} path */
function toRealPath(path) {
	let real
	try {
		real = realpathSync.native(path)
	} catch {
		real = resolve(path)
	}
	return process.platform === 'win32' ? real.toLowerCase() : real
}

/** @param {string} cwd */
const getCommonDir = (cwd) => toRealPath(resolve(cwd, git(['rev-parse', '--git-common-dir'], cwd)))

/**
 * Why this clone's `pre-push` would not run for a push from `cwd`, or null when it will. The cwd
 * must be in the clone this hook belongs to, `core.hooksPath` must be the main work tree's
 * `.githooks`, and that directory must hold the NDA scan, with `pre-push` executable where the OS
 * has an executable bit: git skips a hook that is not, with only a hint.
 * @param {string} cwd
 * @returns {Promise<string | null>}
 */
async function findUnguardedPushReason(cwd) {
	const { findMainWorkTree } = await import('../../.githooks/main-work-tree.mjs')
	let commonDir
	try {
		commonDir = getCommonDir(cwd)
	} catch {
		return `${cwd} is not in a git repository`
	}
	if (commonDir !== getCommonDir(HOOK_DIR)) return `${cwd} is in another repository than the unic-agents-plugins clone`
	const mainTree = findMainWorkTree(git(['worktree', 'list', '--porcelain'], cwd))
	if (!mainTree) return 'this clone has no main work tree with a .githooks'
	const hooksDir = join(mainTree, '.githooks')
	let hooksPath = ''
	try {
		hooksPath = git(['config', '--get', 'core.hooksPath'], cwd)
	} catch {
		// Unset: `git config --get` exits 1.
	}
	const top = git(['rev-parse', '--show-toplevel'], cwd)
	if (!hooksPath || toRealPath(hooksDir) !== toRealPath(isAbsolute(hooksPath) ? hooksPath : join(top, hooksPath))) {
		return `core.hooksPath is ${hooksPath || 'unset'}, not ${hooksDir}`
	}
	const missing = ['pre-push', 'nda-push.mjs'].filter((file) => !existsSync(join(hooksDir, file)))
	if (missing.length > 0) return `${hooksDir} lacks ${missing.join(' and ')}`
	if (process.platform !== 'win32') {
		try {
			accessSync(join(hooksDir, 'pre-push'), constants.X_OK)
		} catch {
			return `${join(hooksDir, 'pre-push')} is not executable, so git skips it`
		}
	}
	return null
}

/**
 * Every piece of the command that may name a file: the split pieces and each quoted string whole.
 * @param {string} command
 */
function getPathCandidates(command) {
	const pieces = command.split(PATH_SEPARATORS)
	for (const match of command.matchAll(QUOTED)) pieces.push(match[1] ?? match[2] ?? '')
	return new Set(pieces.filter(Boolean).map((piece) => piece.replace(/^~(?=[\\/])/, homedir())))
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
	for (const piece of getPathCandidates(command)) {
		const path = resolve(cwd, piece)
		// The executable itself holds no text worth reading, and it is larger than 2 MB.
		if (GH_EXECUTABLES.has(basename(path).toLowerCase())) continue
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
	if (typeof event !== 'object' || event === null || Array.isArray(event)) {
		block('the hook received a payload that is not a JSON object, so it cannot check this command.')
	}

	if (event.tool_name !== 'Bash') return
	/** @type {string} */
	const command = event.tool_input.command
	const cwd = event.cwd || process.cwd()

	if (SWITCHES_HOOKS_OFF.test(command)) {
		block(
			'this command holds --no-verify, an abbreviation of it, or hooksPath, which can switch the NDA git hooks off. ' +
				'To mention either in a commit message, write the message to a file and commit with -F <file>. ' +
				'An authorised use is for the maintainer to run with !.'
		)
	}
	if (SENDS_PACK.test(command)) {
		block('git send-pack runs no pre-push hook, so nothing would scan what it sends. Have the maintainer run it with !.')
	}
	if (PUSHES.test(command)) {
		const reason = await findUnguardedPushReason(cwd)
		if (reason !== null) {
			block(
				`${reason}, so pre-push would not scan this push. ` +
					'Push from the clone or one of its worktrees after pnpm install, or have the maintainer run it with !.'
			)
		}
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
				'See AGENTS.md § The NDA publish guard.'
		)
	}
	if (terms.length === 0) return

	/** @type {Array<[string, string]>} */
	const surfaces = [['the command itself', command]]
	if (RUNS_GH.test(command)) {
		if (CHANGES_DIR.test(command)) {
			block(
				'this gh or glab command also holds cd or pushd. Name every file by its absolute path, or have the maintainer run it with !.'
			)
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
