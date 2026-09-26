#!/usr/bin/env node
// @ts-check
// The NDA scan of `.githooks/pre-push`: it refuses a push when anything the push sends carries an
// NDA term. The commit hooks run inside git, but a commit made with `--no-verify`, by `am`,
// `cherry-pick` or `merge`, or in another clone, never met them. So this is the git guard that
// matters, and the commit hooks are an early warning.
//
// For each ref line git passes on stdin, "<local ref> <local sha> <remote ref> <remote sha>", it reads:
//   - both ref names, so a branch or tag named with a term is refused;
//   - every annotated tag object on the way from the ref to what it points at, which holds each
//     tag message, and a blob or a tree at the end of it;
//   - every commit the push sends: the whole commit object, headers and message, and the added lines
//     of its patch. A merge commit's patch is read against its first parent.
//
// The commits a push sends are those reachable from the local sha and from neither the remote sha nor
// any `refs/remotes/<remote>/*` ref. A remote-tracking ref behind the remote makes it scan more. One
// that holds a commit the remote does not have makes it scan less: a ref set by hand, one left over
// after a leaked commit was deleted from the remote, or one fetched from another URL than the push
// goes to. AGENTS.md names that gap. A remote sha that is not a local commit, as after a
// force push over commits never fetched, is left out rather than failing the listing.
//
// It skips a line that deletes a ref. Deleted lines of a patch do not count, as in `pre-commit`.
//
// CLI: `node nda-push.mjs <remote>` with git's ref lines on stdin. It exits 1 on a match, and when the
// term list cannot be read or git cannot list or show the commits. The matching rule is the one in
// `./nda-match.mjs`.

import { execFileSync } from 'node:child_process'

import { DIFF_FLAGS, dropDeletedLines, findTerm, getListPath, readTerms, redact } from './nda-match.mjs'

const ZERO = /^0+$/
// ponytail: whole output in memory. A push past this size is refused, stream `git log` if one ever is.
const MAX_BUFFER = 512 * 1024 * 1024

// `--no-replace-objects`: after `git replace`, git would show the replacement while the push sends
// the original.
/**
 * @param {string[]} args
 * @param {string} [input]
 */
const git = (args, input) =>
	execFileSync('git', ['--no-replace-objects', '-c', 'core.quotePath=false', ...args], {
		encoding: 'utf8',
		input,
		maxBuffer: MAX_BUFFER,
		stdio: ['pipe', 'pipe', 'pipe'],
	})

/**
 * The text of an object a ref points at that is not a commit: a blob's content, or every path and
 * blob of a tree.
 * @param {string} sha
 * @param {string} type
 */
function readObject(sha, type) {
	if (type !== 'tree') return git(['cat-file', '-p', sha])
	const listing = git(['ls-tree', '-r', sha])
	const blobs = listing
		.split('\n')
		.filter((line) => line.split(/\s/)[1] === 'blob')
		.map((line) => line.split(/\s/)[2])
	return `${listing}\n${blobs.length > 0 ? git(['cat-file', '--batch'], `${blobs.join('\n')}\n`) : ''}`
}

/** @param {string} sha */
function hasObject(sha) {
	try {
		git(['cat-file', '-e', `${sha}^{commit}`])
		return true
	} catch {
		return false
	}
}

/**
 * The `git rev-list` arguments for the commits one ref line sends.
 * @param {string} localSha
 * @param {string} remoteSha
 * @param {string} remote
 */
function getPushedRange(localSha, remoteSha, remote) {
	const range = [localSha, '--not', `--remotes=${remote}`]
	if (!ZERO.test(remoteSha) && hasObject(remoteSha)) range.push(remoteSha)
	return range
}

/**
 * Each text one ref line publishes, with where it comes from.
 * @param {string} line
 * @param {string} remote
 * @returns {Array<[string, string]>}
 */
function readPushedTexts(line, remote) {
	const [localRef = '', localSha = '', remoteRef = '', remoteSha = ''] = line.trim().split(/\s+/)
	if (!localSha || ZERO.test(localSha)) return []
	/** @type {Array<[string, string]>} */
	const texts = [['one of the ref names', `${localRef} ${remoteRef}`]]
	// Peel one tag at a time: a tag can point at another tag, which the push also sends, and at a
	// blob or a tree, which `git log` would list as nothing.
	let sha = localSha
	let type = git(['cat-file', '-t', sha]).trim()
	while (type === 'tag') {
		const tag = git(['cat-file', 'tag', sha])
		texts.push([`a tag object that ${remoteRef} sends`, tag])
		sha = /^object ([0-9a-f]+)$/m.exec(tag)?.[1] ?? ''
		type = git(['cat-file', '-t', sha]).trim()
	}
	if (type !== 'commit') {
		texts.push([`the ${type} ${remoteRef} points at`, readObject(sha, type)])
		return texts
	}
	const range = getPushedRange(sha, remoteSha, remote)
	// Each commit object whole: every header, such as author, committer and `mergetag`, and the whole
	// message, NUL bytes and all. `git log --format` would drop headers, stop at a NUL and re-encode
	// the message under `i18n.logOutputEncoding`.
	const shas = git(['rev-list', ...range])
	if (shas.trim()) texts.push([`a commit object pushed to ${remoteRef}`, git(['cat-file', '--batch'], shas)])
	// One text for every patch.
	// `--root` shows a root commit's patch even with `log.showRoot=false`.
	const patches = git(['log', '--format=', '-p', '--root', '--diff-merges=first-parent', ...DIFF_FLAGS, ...range])
	texts.push([`the patch of a commit pushed to ${remoteRef}`, dropDeletedLines(patches)])
	return texts
}

/**
 * @param {string} message
 * @returns {never}
 */
function refuse(message) {
	process.stderr.write(`pre-push: ${message}\n`)
	process.exit(1)
}

async function main() {
	const remote = process.argv[2] ?? ''
	const path = getListPath()
	let terms
	try {
		terms = readTerms(path)
	} catch {
		refuse(
			`cannot read the NDA term list at ${path}, so this push is refused.\n` +
				"  Create it with one term per line, or 'touch' it to opt out deliberately.\n" +
				'  See AGENTS.md, "The NDA publish guard".'
		)
	}

	let input = ''
	for await (const chunk of process.stdin) input += chunk

	for (const line of input.split(/\r?\n/).filter((text) => text.trim())) {
		let texts
		try {
			texts = readPushedTexts(line, remote)
		} catch (error) {
			const { stderr, message } = /** @type {{ stderr?: unknown, message?: unknown }} */ (error)
			refuse(`cannot list the commits this push sends, so it is refused (${String(stderr || message).trim()}).`)
		}
		for (const [where, text] of texts) {
			const term = findTerm(text, terms)
			if (term === null) continue
			// Redact the term: the transcript of a refusal must not republish it.
			refuse(
				`refusing this push to ${remote}.\n` +
					`  ${where[0]?.toUpperCase()}${where.slice(1)} carries the NDA term ${redact(term)}, and this repository is public.\n` +
					'  Rewrite the commit, the tag or the ref name, then push again.'
			)
		}
	}
}

main()
