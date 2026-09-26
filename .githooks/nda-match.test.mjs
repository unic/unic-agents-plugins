// @ts-check
// Tests for the NDA guards. Every fixture uses a made-up term: a real term in a test publishes it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTerm, readTerms } from './nda-match.mjs'

const TERM = 'zorblax'
const HOOKS = dirname(fileURLToPath(import.meta.url))
const CLAUDE_HOOK = join(HOOKS, '..', '.claude', 'hooks', 'block-nda-terms.mjs')
const BASE64 = `QmFzZTY0${TERM}ZGF0YQ0Kc2VlbXMgcmFuZG9tIGVub3VnaCB0byBwYXNzIHRoZSBlaWdodHkgY2hhcmFjdGVyIGJhcg==`
// A real font from an Archify diagram, with the term spliced into its payload. Any diagram will do,
// so a renamed or regenerated one does not break this suite.
const ARCHIFY_DIR = join(HOOKS, '..', 'apps', 'claude-code', 'unic-archon-dlc', 'docs', 'architecture')
const ARCHIFY_HTML = join(ARCHIFY_DIR, readdirSync(ARCHIFY_DIR).find((name) => name.endsWith('.html')) ?? '')
const FONT = /data:font\/[^,\s]*;base64,[A-Za-z0-9+/=]+/.exec(readFileSync(ARCHIFY_HTML, 'utf8'))?.[0] ?? ''
const FONT_WITH_TERM = `url(${FONT.slice(0, 1000)}${TERM}${FONT.slice(1000)})`
const LONG_PATH = `/Users/someone/Sites/UNIC/${TERM}/apps/claudecode/plugins/src/lib/deep/nested/dir2/more/file.md`
const SHORT_DATA_URI = `data:text/plain;base64,${TERM}`
const REFUSED = /carries the NDA term/

const scratch = mkdtempSync(join(tmpdir(), 'nda-guard-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const list = join(scratch, 'denylist.txt')
writeFileSync(list, `# synthetic\r\n${TERM}\r\n`)
const missingList = join(scratch, 'missing.txt')

/** @param {string} text */
const toUtf16le = (text) => Buffer.from(text, 'utf16le')
/** @param {string} text */
const toUtf16be = (text) => Buffer.from(text, 'utf16le').swap16()

/**
 * Hides every `.txt` diff behind a textconv filter that prints nothing.
 * @param {string} dir
 */
function hideBehindTextconv(dir) {
	git(dir, 'config', 'diff.hide.textconv', 'true')
	writeFileSync(join(dir, '.git', 'info', 'attributes'), '*.txt diff=hide\n')
}

describe('findTerm', () => {
	test('refuses the term as a word in prose', () => {
		assert.equal(findTerm(`Built for ${TERM} last week.`, [TERM]), TERM)
	})
	test('refuses the term at the start of a camelCase identifier', () => {
		assert.equal(findTerm(`const ${TERM}Client = 1`, [TERM]), TERM)
	})
	test('refuses the term at the end of a camelCase identifier', () => {
		assert.equal(findTerm('myZorblax()', [TERM]), TERM)
	})
	test('refuses the term in an upper-case run before a capital', () => {
		assert.equal(findTerm('ZORBLAXSite', [TERM]), TERM)
	})
	test('refuses the term joined by an underscore', () => {
		assert.equal(findTerm(`${TERM}_repo`, [TERM]), TERM)
	})
	test('refuses the term next to a digit', () => {
		assert.equal(findTerm(`${TERM}2026`, [TERM]), TERM)
	})
	test('passes the term inside a longer lowercase word', () => {
		assert.equal(findTerm(`a${TERM}ish`, [TERM]), null)
	})
	test('passes the term inside a real font', () => {
		assert.equal(findTerm(FONT_WITH_TERM, [TERM]), null)
	})
	test('passes the term inside a base64 run', () => {
		assert.equal(findTerm(BASE64, [TERM]), null)
	})
	test('refuses the term in a long URL that holds a digit', () => {
		assert.equal(findTerm(`https://github.com/unic/${TERM}2026/tree/main/src/components`, [TERM]), TERM)
	})
	test('refuses the term in a long path on a staged line that starts with a plus', () => {
		assert.equal(
			findTerm(`\n++apps/claude/${TERM}/src/components/v2/HeaderNavigation/deep/nested/dir/more/stuff/x`, [TERM]),
			TERM
		)
	})
	test('refuses the term in a data URI payload of 79 characters', () => {
		assert.equal(findTerm(`data:font/woff2;base64,${'A'.repeat(35)}/${TERM}/${'A'.repeat(35)}`, [TERM]), TERM)
	})
	test('passes the term in a data URI payload of 80 characters with no digit, plus or padding', () => {
		assert.equal(findTerm(`data:font/woff2;base64,${'A'.repeat(36)}/${TERM}/${'A'.repeat(35)}`, [TERM]), null)
	})
	test('passes the term inside a base64 run that holds a plus after a digit', () => {
		assert.equal(findTerm(`${'Ab1+'.repeat(10)}${TERM}Q${'Ab1+'.repeat(10)}`, [TERM]), null)
	})
	test('refuses the term in a long form-encoded run with no digit', () => {
		const body = `body=Built+for+${TERM}+last+week+and+the+team+shipped+the+new+header+navigation+to+production`
		assert.equal(findTerm(body, [TERM]), TERM)
	})
	test('refuses the term in a SvelteKit route on a staged line', () => {
		const route = `+apps/web/src/routes/customers/${TERM}/dashboard/settings/v2/billing/invoices/details/+page.svelte`
		assert.equal(findTerm(route, [TERM]), TERM)
	})
	test('reads 40,000 hex characters in under 100 ms', () => {
		const start = performance.now()
		findTerm('0123456789abcdef'.repeat(2500), [TERM])
		const ms = performance.now() - start
		assert.ok(ms < 100, `${ms} ms`)
	})
	test('refuses the term in the media type of a data URI', () => {
		assert.equal(findTerm(`data:text/${TERM};base64,${'A'.repeat(90)}`, [TERM]), TERM)
	})
	test('refuses the term in a long absolute path with no dot, hyphen or underscore before the file name', () => {
		assert.equal(findTerm(LONG_PATH, [TERM]), TERM)
	})
	test('refuses the term in a data URI too short to be real data', () => {
		assert.equal(findTerm(SHORT_DATA_URI, [TERM]), TERM)
	})
	test('passes the term inside a sha512 integrity hash', () => {
		assert.equal(findTerm(`sha512-${'Ab1'.repeat(26)}${TERM}Q==`, [TERM]), null)
	})
	test('refuses the term in a long path that holds a digit', () => {
		assert.equal(findTerm(`apps/claude-code/${TERM}/src/components/v2/HeaderNavigation`, [TERM]), TERM)
	})
	test('refuses the term in compact code under 80 characters that holds a digit and a plus', () => {
		assert.equal(findTerm(`total=${TERM}CountForTheCurrentQuarter2+otherCountValue`, [TERM]), TERM)
	})
	test('refuses the term in a query string under 80 characters that holds a digit and a plus', () => {
		assert.equal(findTerm(`https://x.io/r?next=${TERM}/2026/tree/main/src/components/header+nav`, [TERM]), TERM)
	})
	test('passes the term joined to a letter outside the BMP', () => {
		assert.equal(findTerm(`${TERM}\u{1D41A}`, [TERM]), null)
	})
	test('passes the term after a letter outside the BMP', () => {
		assert.equal(findTerm(`\u{1D41A}${TERM}`, [TERM]), null)
	})
	test('refuses the term after a character that lower-casing lengthens', () => {
		assert.equal(findTerm(`\u0130 ${TERM}.`, [TERM]), TERM)
	})
	test('refuses an overlapping match that ends on a boundary', () => {
		assert.equal(findTerm('aAa', ['aa']), 'aa')
	})
})

describe('readTerms', () => {
	test('reads a CRLF list without the carriage return', () => {
		assert.deepEqual(readTerms(list), [TERM])
	})
})

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 * @param {string} [input]
 */
const run = (cmd, args, cwd, env = {}, input) =>
	spawnSync(cmd, args, { cwd, input, encoding: 'utf8', env: { ...process.env, UNIC_NDA_DENYLIST: list, ...env } })

/**
 * A fresh repository with the git hooks of this checkout and one staged file.
 * @param {string | Buffer} content
 * @param {string} [prefix]
 * @param {boolean} [viaSymlink] install pre-commit as a symlink in `.git/hooks`, not `core.hooksPath`
 */
function createStagedRepo(content, prefix = 'repo-', viaSymlink = false) {
	const dir = mkdtempSync(join(scratch, prefix))
	git(dir, 'init', '-q')
	if (viaSymlink) symlinkSync(join(HOOKS, 'pre-commit'), join(dir, '.git', 'hooks', 'pre-commit'))
	else git(dir, 'config', 'core.hooksPath', HOOKS)
	git(dir, 'config', 'user.email', 'guard@example.com')
	git(dir, 'config', 'user.name', 'Guard Test')
	writeFileSync(join(dir, 'file.txt'), content)
	git(dir, 'add', 'file.txt')
	return dir
}

/**
 * A setup step that fails would make a refusal test pass for the wrong reason, so it throws.
 * @param {string} dir
 * @param {string[]} args
 */
function git(dir, ...args) {
	const result = run('git', args, dir)
	assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`)
}

const commit = (/** @type {string} */ dir, message = 'add file', env = {}) =>
	run('git', ['commit', '-q', '-m', message], dir, env)

/**
 * A refusal must name its reason, and exit with the status its caller acts on: git stops a commit on
 * any non-zero hook exit, which it reports as 1, and Claude Code blocks a tool call only on 2. An
 * unreadable diff or a missing module also exits non-zero.
 * @param {{ status: number | null, stderr: string }} result
 * @param {number} status
 * @param {RegExp} [reason]
 */
function assertRefused(result, status, reason = REFUSED) {
	assert.deepEqual(
		{ status: result.status, reason: reason.test(result.stderr) },
		{ status, reason: true },
		result.stderr
	)
}

describe('git hooks', () => {
	test('pre-commit refuses a staged term in prose', () => {
		assertRefused(commit(createStagedRepo(`Built for ${TERM}.\n`)), 1)
	})
	test('pre-commit refuses a staged term in a long absolute path', () => {
		assertRefused(commit(createStagedRepo(`${LONG_PATH}\n`)), 1)
	})
	test('pre-commit refuses a staged term in a short data URI', () => {
		assertRefused(commit(createStagedRepo(`${SHORT_DATA_URI}\n`)), 1)
	})
	test('pre-commit passes a staged term inside a real font', () => {
		assert.equal(commit(createStagedRepo(`${FONT_WITH_TERM}\n`)).status, 0)
	})
	test('pre-commit refuses when the term list is missing', () => {
		assertRefused(
			commit(createStagedRepo('clean\n'), 'add file', { UNIC_NDA_DENYLIST: missingList }),
			1,
			/cannot read the NDA term list/
		)
	})
	test('pre-commit installed as a symlink refuses a staged term', { skip: process.platform === 'win32' }, () => {
		assertRefused(commit(createStagedRepo(`Built for ${TERM}.\n`, 'repo-', true)), 1)
	})
	test('pre-commit refuses readably when nda-match.mjs is in neither the hooks nor the work tree', () => {
		const hooks = mkdtempSync(join(scratch, 'hooks-'))
		for (const name of ['pre-commit', 'commit-msg']) copyFileSync(join(HOOKS, name), join(hooks, name))
		const dir = createStagedRepo('clean\n')
		git(dir, 'config', 'core.hooksPath', hooks)
		assertRefused(commit(dir), 1, /cannot find nda-match\.mjs/)
	})
	test(
		'commit-msg linked alone in .git/hooks skips a personal pre-commit there',
		{ skip: process.platform === 'win32' },
		() => {
			const dir = createStagedRepo('clean\n')
			git(dir, 'config', '--unset', 'core.hooksPath')
			symlinkSync(join(HOOKS, 'commit-msg'), join(dir, '.git', 'hooks', 'commit-msg'))
			writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n', { mode: 0o755 })
			assertRefused(commit(dir, `fix: ${TERM} typo`), 1, /commit-msg: cannot find pre-commit /)
		}
	)
	test('importing the matcher does not throw when argv[1] names no file', () => {
		const matcher = pathToFileURL(join(HOOKS, 'nda-match.mjs')).href
		const code = `process.argv[1] = ${JSON.stringify(join(scratch, 'missing.mjs'))}; await import(${JSON.stringify(matcher)})`
		const { status, stderr } = run('node', ['--input-type=module', '-e', code], scratch)
		assert.equal(status, 0, stderr)
	})
	test('the matcher refuses a term when reached through a symlinked directory', () => {
		const link = join(scratch, `linked-hooks-${Date.now()}`)
		symlinkSync(HOOKS, link, 'junction')
		assertRefused(run('node', [join(link, 'nda-match.mjs'), 'nda-match'], scratch, {}, `Built for ${TERM}.\n`), 1)
	})
	test('commit-msg refuses the term in the message', () => {
		assertRefused(commit(createStagedRepo('clean\n'), `fix: ${TERM} typo`), 1)
	})
	test('pre-commit refuses a staged term in a binary file', () => {
		assertRefused(commit(createStagedRepo(`\0Built for ${TERM}.\n`)), 1)
	})
	test('pre-commit refuses a staged term in a file with a -diff attribute', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		writeFileSync(join(dir, '.gitattributes'), 'file.txt -diff\n')
		git(dir, 'add', '.gitattributes')
		assertRefused(commit(dir), 1)
	})
	test('pre-commit refuses a staged term behind diff.external', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		git(dir, 'config', 'diff.external', 'true')
		assertRefused(commit(dir), 1)
	})
	test('pre-commit passes a commit that only deletes a line holding the term', () => {
		const dir = createCommittedRepo(`Built for ${TERM}.\nclean\n`)
		writeFileSync(join(dir, 'file.txt'), 'clean\n')
		git(dir, 'add', 'file.txt')
		assert.equal(commit(dir, 'remove line').status, 0)
	})
	test('pre-commit refuses a commit that adds a line holding the term', () => {
		const dir = createCommittedRepo('clean\n')
		writeFileSync(join(dir, 'file.txt'), `clean\nBuilt for ${TERM}.\n`)
		git(dir, 'add', 'file.txt')
		assertRefused(commit(dir, 'add line'), 1)
	})
	test('pre-commit refuses a staged term joined to NUL bytes on both sides', () => {
		assertRefused(commit(createStagedRepo(`aaa\0${TERM}\0bbb\n`)), 1)
	})
	test('pre-commit passes a deleted line under color.ui=always', () => {
		const dir = createCommittedRepo(`Built for ${TERM}.\nclean\n`)
		git(dir, 'config', 'color.ui', 'always')
		writeFileSync(join(dir, 'file.txt'), 'clean\n')
		git(dir, 'add', 'file.txt')
		assert.equal(commit(dir, 'remove line').status, 0)
	})
	test('pre-commit passes the deletion of a content line that starts with two hyphens', () => {
		const dir = createCommittedRepo(`-- ${TERM}\nclean\n`)
		writeFileSync(join(dir, 'file.txt'), 'clean\n')
		git(dir, 'add', 'file.txt')
		assert.equal(commit(dir, 'remove line').status, 0)
	})
	test('pre-commit passes the deletion of a file whose name carries the term', () => {
		const dir = createCommittedRepo('clean\n', `${TERM}.txt`)
		git(dir, 'rm', '-q', `${TERM}.txt`)
		assert.equal(commit(dir, 'remove file').status, 0)
	})
	test('pre-commit passes the rename of a file whose name carries the term', () => {
		const dir = createCommittedRepo('clean\n', `${TERM}.txt`)
		git(dir, 'mv', `${TERM}.txt`, 'clean.txt')
		assert.equal(commit(dir, 'rename file').status, 0)
	})
	test('pre-commit refuses the rename of a file to a name that carries the term', () => {
		const dir = createCommittedRepo('clean\n')
		git(dir, 'mv', 'file.txt', `${TERM}.txt`)
		assertRefused(commit(dir, 'rename file'), 1)
	})
	test('pre-commit passes an edit below a line that already holds the term', () => {
		const dir = createCommittedRepo(`Built for ${TERM}.\n a\n b\n`)
		writeFileSync(join(dir, 'file.txt'), `Built for ${TERM}.\n a\n c\n`)
		git(dir, 'add', 'file.txt')
		assert.equal(commit(dir, 'edit line').status, 0)
	})
	test('pre-commit refuses a staged term in a UTF-16LE file', () => {
		assertRefused(commit(createStagedRepo(toUtf16le(`Built for ${TERM}.\n`))), 1)
	})
	test('pre-commit refuses a staged term in a UTF-16BE file', () => {
		assertRefused(commit(createStagedRepo(toUtf16be(`Built for ${TERM}.\n`))), 1)
	})
	test('pre-commit refuses a staged term behind a textconv filter', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		hideBehindTextconv(dir)
		assertRefused(commit(dir), 1)
	})
	test('pre-commit refuses an empty new file whose path holds the term before " b/"', () => {
		const dir = createStagedRepo('clean\n')
		mkdirSync(join(dir, `${TERM} b`))
		writeFileSync(join(dir, `${TERM} b`, 'x'), '')
		git(dir, 'add', '.')
		assertRefused(commit(dir), 1)
	})
})

/**
 * A repository whose first commit holds `content`, made before the hooks were set, as if it came
 * from history that is already published. The hooks of this checkout run from then on.
 * @param {string} content
 * @param {string} [name]
 */
function createCommittedRepo(content, name = 'file.txt') {
	const dir = createStagedRepo(content, 'seed-')
	if (name !== 'file.txt') {
		git(dir, 'mv', 'file.txt', name)
	}
	git(dir, 'config', 'core.hooksPath', mkdtempSync(join(scratch, 'no-hooks-')))
	git(dir, 'commit', '-q', '-m', 'seed')
	git(dir, 'config', 'core.hooksPath', HOOKS)
	return dir
}

/**
 * @param {string} command
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 * @param {string} [hook]
 */
const runClaudeHook = (command, cwd, env, hook = CLAUDE_HOOK) =>
	run('node', [hook], cwd, env, JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command } }))

/**
 * A copy of this clone's guard files in a fresh repository whose `core.hooksPath` is its own
 * `.githooks`, as `pnpm install` leaves a clone, with one commit so that a linked worktree can be
 * added. Its own copy of the Claude hook proves a push from it, or from its worktrees, is guarded.
 * @param {{ without?: string }} [options]
 */
function createGuardedRepo({ without = '' } = {}) {
	const dir = mkdtempSync(join(scratch, 'guarded-'))
	git(dir, 'init', '-q')
	mkdirSync(join(dir, '.githooks'))
	mkdirSync(join(dir, '.claude', 'hooks'), { recursive: true })
	for (const file of ['pre-push', 'nda-push.mjs', 'nda-match.mjs', 'main-work-tree.mjs'].filter((f) => f !== without)) {
		copyFileSync(join(HOOKS, file), join(dir, '.githooks', file))
	}
	copyFileSync(CLAUDE_HOOK, join(dir, '.claude', 'hooks', 'block-nda-terms.mjs'))
	git(dir, 'config', 'core.hooksPath', join(dir, '.githooks'))
	git(
		dir,
		'-c',
		'user.name=Guard Test',
		'-c',
		'user.email=guard@example.com',
		'commit',
		'-q',
		'--allow-empty',
		'-m',
		'init'
	)
	return { dir, hook: join(dir, '.claude', 'hooks', 'block-nda-terms.mjs') }
}

const PUSH_REFUSED = /pre-push would not scan this push\. Push from the clone or one of its worktrees.*run it with !/

describe('Claude hook', () => {
	const guarded = createGuardedRepo()
	const worktree = join(scratch, 'guarded-worktree')
	git(guarded.dir, 'worktree', 'add', '-q', '-b', 'wt', worktree)
	const unrelated = createGuardedRepo()
	const withoutScan = createGuardedRepo({ without: 'nda-push.mjs' })
	const other = createStagedRepo('clean\n', 'other-')
	git(other, 'config', 'core.hooksPath', mkdtempSync(join(scratch, 'elsewhere-')))
	const outside = mkdtempSync(join(scratch, 'outside-'))

	const clean = join(scratch, 'clean.md')
	writeFileSync(clean, 'clean\n')
	const dirty = join(scratch, 'dirty.md')
	writeFileSync(dirty, `Built for ${TERM}.\n`)
	const spaced = join(mkdtempSync(join(scratch, 'with space-')), 'body.md')
	writeFileSync(spaced, `Built for ${TERM}.\n`)
	const home = mkdtempSync(join(scratch, 'home-'))
	writeFileSync(join(home, 'draft.md'), `Built for ${TERM}.\n`)
	const mentionsNoVerify = join(scratch, 'mentions-no-verify.md')
	writeFileSync(mentionsNoVerify, 'Never commit with --no-verify.\n')
	const large = join(scratch, 'large.md')
	writeFileSync(large, 'clean\n'.repeat(400_000))
	// A gh executable larger than 2 MB, so the result does not depend on the machine's own gh.
	const fakeGh = join(mkdtempSync(join(scratch, 'bin-')), 'gh')
	writeFileSync(fakeGh, 'clean\n'.repeat(400_000))

	test('passes a cat heredoc that writes a draft quoting git -C with a missing path', () => {
		const command = `cat > ${join(scratch, 'draft.md')} <<'EOF'\nRun git -C /nonexistent/wt commit -m "x".\nEOF`
		assert.equal(runClaudeHook(command, guarded.dir).status, 0)
	})
	test('passes a commit over a staged term, which pre-commit guards instead', () => {
		assert.equal(runClaudeHook('git commit -m "add file"', createStagedRepo(`Built for ${TERM}.\n`)).status, 0)
	})

	test('refuses --no-verify and names -F <file> and !', () => {
		assertRefused(runClaudeHook('git commit --no-verify -m "add file"', outside), 2, /-F <file>.*run with !/)
	})
	test('refuses --NO-VERIFY in upper case after any verb', () => {
		assertRefused(runClaudeHook('echo --NO-VERIFY', outside), 2, /--no-verify, an abbreviation of it, or hooksPath/)
	})
	test('refuses --no-verif, an abbreviation git accepts, on a push', () => {
		assertRefused(runClaudeHook('git push --no-verif origin x', outside), 2, /an abbreviation of it/)
	})
	test('refuses --no-veri, an abbreviation git accepts, on a commit', () => {
		assertRefused(runClaudeHook('git commit --no-veri -m "x"', outside), 2, /an abbreviation of it/)
	})
	test('refuses core.hooksPath set through -c', () => {
		assertRefused(runClaudeHook('git -c core.hooksPath=/dev/null commit -m "x"', outside), 2, /or hooksPath/)
	})
	test('refuses core.hooksPath set through GIT_CONFIG_KEY_0', () => {
		const command = 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/x git commit -m "x"'
		assertRefused(runClaudeHook(command, outside), 2, /or hooksPath/)
	})
	test('passes a gh command whose body file mentions --no-verify', () => {
		assert.equal(runClaudeHook(`gh issue create --body-file ${mentionsNoVerify}`, outside).status, 0)
	})

	test('passes a push from the clone whose hooks path is its own .githooks', () => {
		assert.equal(runClaudeHook('git push -u origin feature/x', guarded.dir, {}, guarded.hook).status, 0)
	})
	test('passes a push from a linked worktree of that clone', () => {
		assert.equal(runClaudeHook('git push -u origin wt', worktree, {}, guarded.hook).status, 0)
	})
	test('refuses a push from outside any repository, and offers the clone and !', () => {
		assertRefused(runClaudeHook('git push origin x', outside, {}, guarded.hook), 2, PUSH_REFUSED)
	})
	test('refuses a push from a repository whose hooks path is elsewhere', () => {
		assertRefused(runClaudeHook('git push origin x', other, {}, guarded.hook), 2, PUSH_REFUSED)
	})
	test('refuses a push from an unrelated repository with its own guarded .githooks', () => {
		assertRefused(runClaudeHook('git push origin x', unrelated.dir, {}, guarded.hook), 2, PUSH_REFUSED)
	})
	test('refuses a push from the clone when its .githooks lacks nda-push.mjs', () => {
		assertRefused(runClaudeHook('git push origin x', withoutScan.dir, {}, withoutScan.hook), 2, PUSH_REFUSED)
	})

	test('refuses the term in a gh command run through sh -c', () => {
		assertRefused(runClaudeHook(`sh -c 'gh issue create --title "${TERM}"'`, outside), 2)
	})
	test('refuses the term in a gh command run by its absolute path', () => {
		assertRefused(runClaudeHook(`${fakeGh} issue create --title "${TERM}"`, outside), 2)
	})
	test('passes a clean gh command run by the absolute path of an executable over 2 MB', () => {
		assert.equal(runClaudeHook(`${fakeGh} issue list`, outside).status, 0)
	})
	test('refuses the term in a gh command run through a backslash', () => {
		assertRefused(runClaudeHook(`\\gh issue create --title "${TERM}"`, outside), 2)
	})
	test('refuses the term in a git branch name', () => {
		assertRefused(runClaudeHook(`git switch -c ${TERM}-fix`, outside), 2)
	})
	test('passes the term in a command that runs neither git, gh nor glab', () => {
		assert.equal(runClaudeHook(`echo ${TERM}`, outside).status, 0)
	})

	test('refuses the term in a file named by --body-file=', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file=${dirty}`, outside), 2)
	})
	test('refuses the term in a file named by -F body=@', () => {
		assertRefused(runClaudeHook(`gh api repos/o/r/issues -F body=@${dirty}`, outside), 2)
	})
	test('refuses the term in a file named by --file=', () => {
		assertRefused(runClaudeHook(`glab snippet create --file=${dirty}`, outside), 2)
	})
	test('refuses the term in a file read through $(<file)', () => {
		assertRefused(runClaudeHook(`gh issue comment 1 --body "$(<${dirty})"`, outside), 2)
	})
	test('refuses the term in a file redirected with no space after <', () => {
		assertRefused(runClaudeHook(`gh api graphql -F query=- <${dirty}`, outside), 2)
	})
	test('refuses the term in a file named by a path relative to the session cwd', () => {
		assertRefused(runClaudeHook('gh issue create --body-file dirty.md', scratch), 2)
	})
	test('refuses the term in a file named by a path under ~/', () => {
		assertRefused(
			runClaudeHook('gh issue create --body-file ~/draft.md', outside, { HOME: home, USERPROFILE: home }),
			2
		)
	})
	test('refuses the term in a file named by a quoted path with a space', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file "${spaced}"`, outside), 2)
	})
	test('refuses the term in a file named before a semicolon', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file ${dirty}; echo done`, outside), 2)
	})
	test('refuses the term in a file named right before &&', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file ${dirty}&&echo done`, outside), 2)
	})
	test('refuses the term in a file read through backticks', () => {
		assertRefused(runClaudeHook(`gh issue create --body \`cat ${dirty}\``, outside), 2)
	})
	test('passes a clean file named by --body-file=', () => {
		assert.equal(runClaudeHook(`gh issue create --body-file=${clean}`, outside).status, 0)
	})
	test('refuses a named file larger than 2 MB', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file ${large}`, outside), 2, /larger than 2 MB/)
	})
	test('refuses a gh command that also runs cd', () => {
		assertRefused(runClaudeHook(`cd ${scratch} && gh issue create --body-file clean.md`, outside), 2, /absolute path/)
	})
	test('refuses a gh command that also runs pushd', () => {
		assertRefused(
			runClaudeHook(`pushd ${scratch} && gh issue create --body-file clean.md`, outside),
			2,
			/absolute path/
		)
	})

	test('refuses an empty payload', () => {
		assertRefused(run('node', [CLAUDE_HOOK], outside, {}, ''), 2, /empty payload/)
	})
	test('refuses a payload that is not JSON', () => {
		assertRefused(run('node', [CLAUDE_HOOK], outside, {}, 'not json'), 2, /not JSON/)
	})
	test('refuses a JSON string payload', () => {
		assertRefused(run('node', [CLAUDE_HOOK], outside, {}, '"hello"'), 2, /not a JSON object/)
	})
	test('refuses a JSON array payload', () => {
		assertRefused(run('node', [CLAUDE_HOOK], outside, {}, '[]'), 2, /not a JSON object/)
	})
	test('passes a valid payload for another tool', () => {
		const payload = JSON.stringify({ tool_name: 'Read', cwd: outside, tool_input: { file_path: dirty } })
		assert.equal(run('node', [CLAUDE_HOOK], outside, {}, payload).status, 0)
	})
	test('refuses and names the exception when the hook throws', () => {
		const payload = JSON.stringify({ tool_name: 'Bash', cwd: outside, tool_input: null })
		assertRefused(run('node', [CLAUDE_HOOK], outside, {}, payload), 2, /failed with TypeError/)
	})
	test('refuses when the term list is missing', () => {
		assertRefused(
			runClaudeHook('gh issue list', outside, { UNIC_NDA_DENYLIST: missingList }),
			2,
			/cannot read the NDA term list/
		)
	})
})

describe('Claude hook, round 2', () => {
	const outside = mkdtempSync(join(scratch, 'outside-r2-'))
	const other = createStagedRepo('clean\n', 'other-r2-')
	git(other, 'config', 'core.hooksPath', mkdtempSync(join(scratch, 'elsewhere-r2-')))
	const emptyList = join(scratch, 'empty-list.txt')
	writeFileSync(emptyList, '')
	const clean = join(scratch, 'clean-r2.md')
	writeFileSync(clean, 'clean\n')
	const dirty = join(scratch, 'dirty-r2.md')
	writeFileSync(dirty, `Built for ${TERM}.\n`)
	const dirtyLe = join(scratch, 'dirty-le.md')
	writeFileSync(dirtyLe, toUtf16le(`Built for ${TERM}.\n`))
	const dirtyBe = join(scratch, 'dirty-be.md')
	writeFileSync(dirtyBe, toUtf16be(`Built for ${TERM}.\n`))

	test('refuses the term in a UTF-16LE file named by --body-file', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file ${dirtyLe}`, outside), 2)
	})
	test('refuses the term in a UTF-16BE file named by --body-file', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file ${dirtyBe}`, outside), 2)
	})
	test('refuses the term in a dirty file named after a clean one', () => {
		assertRefused(runClaudeHook(`gh issue create --body-file ${clean} --template ${dirty}`, outside), 2)
	})
	test('resolves a relative file against the payload cwd, not the process cwd', () => {
		const payload = JSON.stringify({
			tool_name: 'Bash',
			cwd: scratch,
			tool_input: { command: 'gh issue create --body-file dirty-r2.md' },
		})
		assertRefused(run('node', [CLAUDE_HOOK], outside, {}, payload), 2)
	})

	test('refuses git -C . push from a repository whose hooks path is elsewhere', () => {
		assertRefused(runClaudeHook('git -C . push origin x', other), 2, PUSH_REFUSED)
	})
	test('refuses a push inside sh -c from a repository whose hooks path is elsewhere', () => {
		assertRefused(runClaudeHook(`sh -c 'git push origin x'`, other), 2, PUSH_REFUSED)
	})
	test('refuses git send-pack even from a guarded clone', () => {
		const guarded = createGuardedRepo()
		assertRefused(
			runClaudeHook('git send-pack ../remote main', guarded.dir, {}, guarded.hook),
			2,
			/send-pack runs no pre-push hook.*!/
		)
	})
	test('refuses a push from a clone whose pre-push is not executable', { skip: process.platform === 'win32' }, () => {
		const guarded = createGuardedRepo()
		chmodSync(join(guarded.dir, '.githooks', 'pre-push'), 0o644)
		assertRefused(
			runClaudeHook('git push origin x', guarded.dir, {}, guarded.hook),
			2,
			/is not executable, so git skips it/
		)
	})
	test('refuses a push from a clone whose hooks path points away from its .githooks, and says so', () => {
		const guarded = createGuardedRepo()
		git(guarded.dir, 'config', 'core.hooksPath', mkdtempSync(join(scratch, 'away-')))
		assertRefused(
			runClaudeHook('git push origin x', guarded.dir, {}, guarded.hook),
			2,
			/core\.hooksPath is .*so pre-push would not scan/
		)
	})
	test('refuses a push from a clone whose .githooks lacks pre-push', () => {
		const guarded = createGuardedRepo({ without: 'pre-push' })
		assertRefused(runClaudeHook('git push origin x', guarded.dir, {}, guarded.hook), 2, /lacks pre-push/)
	})

	test('refuses --no-verify with an empty term list', () => {
		assertRefused(
			runClaudeHook('git commit --no-verify -m x', outside, { UNIC_NDA_DENYLIST: emptyList }),
			2,
			/--no-verify/
		)
	})
	test('refuses hooksPath with an empty term list', () => {
		assertRefused(
			runClaudeHook('git config core.hooksPath /x', outside, { UNIC_NDA_DENYLIST: emptyList }),
			2,
			/hooksPath/
		)
	})
	test('refuses an unguarded push with an empty term list', () => {
		assertRefused(runClaudeHook('git push origin x', outside, { UNIC_NDA_DENYLIST: emptyList }), 2, PUSH_REFUSED)
	})
})

describe('Claude hook entry in .claude/settings.json', () => {
	const settings = JSON.parse(readFileSync(join(HOOKS, '..', '.claude', 'settings.json'), 'utf8'))
	/** @type {string} */
	const entry = settings.hooks.PreToolUse.flatMap(
		(/** @type {{ hooks: Array<{ command: string }> }} */ group) => group.hooks
	)
		.map((/** @type {{ command: string }} */ hook) => hook.command)
		.find((/** @type {string} */ command) => command.includes('block-nda-terms.mjs'))
	const projectDir = join(HOOKS, '..')
	const outside = mkdtempSync(join(scratch, 'subdir-'))

	test('blocks from a directory other than the project root', () => {
		const result = run('sh', ['-c', entry], outside, { CLAUDE_PROJECT_DIR: projectDir }, 'not json')
		assertRefused(result, 2, /not JSON/)
	})
	test('blocks when node is not on PATH', { skip: process.platform === 'win32' }, () => {
		const result = spawnSync('/bin/sh', ['-c', entry], {
			cwd: outside,
			input: '{}',
			encoding: 'utf8',
			env: { PATH: mkdtempSync(join(scratch, 'no-node-')), CLAUDE_PROJECT_DIR: projectDir },
		})
		assert.equal(result.status, 2, result.stderr)
	})
})

describe('round 3', () => {
	const outside = mkdtempSync(join(scratch, 'outside-r3-'))
	const accentedList = join(scratch, 'accented-list.txt')
	writeFileSync(accentedList, 'vörpleminx\n')

	test('pre-commit refuses a non-ASCII term in a path under core.quotePath=true', () => {
		const dir = createStagedRepo('clean\n')
		git(dir, 'config', 'core.quotePath', 'true')
		writeFileSync(join(dir, 'vörpleminx.txt'), 'clean\n')
		git(dir, 'add', '.')
		assertRefused(commit(dir, 'add file', { UNIC_NDA_DENYLIST: accentedList }), 1)
	})
	test('pre-commit refuses readably when git cannot produce the staged diff', () => {
		const result = run('node', [join(HOOKS, 'nda-match.mjs'), 'pre-commit'], outside)
		assert.deepEqual(
			{
				status: result.status,
				reason: /cannot read the staged diff/.test(result.stderr),
				lines: result.stderr.trim().split('\n').length,
			},
			{ status: 1, reason: true, lines: 1 },
			result.stderr
		)
	})

	test('refuses the term in an unquoted gh file path that holds @', () => {
		const file = join(mkdtempSync(join(scratch, 'notes-')), 'auto-format@0.5.5.md')
		writeFileSync(file, `Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`gh release edit auto-format@0.5.5 --notes-file ${file}`, outside), 2)
	})
	test('refuses the term in an unquoted gh file path that holds =', () => {
		const file = join(mkdtempSync(join(scratch, 'eq-')), 'a=b.md')
		writeFileSync(file, `Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`gh issue create --body-file=${file}`, outside), 2)
	})
	test('passes --no-verbose', () => {
		assert.equal(runClaudeHook('git commit --no-verbose -m "x"', outside).status, 0)
	})
	test('refuses --no-veri', () => {
		assertRefused(runClaudeHook('git push --no-veri origin x', outside), 2, /an abbreviation of it/)
	})

	test('passes a push from the main work tree with a relative core.hooksPath', () => {
		const guarded = createGuardedRepo()
		git(guarded.dir, 'config', 'core.hooksPath', '.githooks')
		// The process runs elsewhere, so the path must resolve against the repository, not the process.
		const payload = JSON.stringify({
			tool_name: 'Bash',
			cwd: guarded.dir,
			tool_input: { command: 'git push origin x' },
		})
		assert.equal(run('node', [guarded.hook], outside, {}, payload).status, 0)
	})
	test('refuses a push from a linked worktree with a relative core.hooksPath', () => {
		const guarded = createGuardedRepo()
		git(guarded.dir, 'config', 'core.hooksPath', '.githooks')
		const linked = join(scratch, `relative-worktree-${Date.now()}`)
		git(guarded.dir, 'worktree', 'add', '-q', '-b', 'rel', linked)
		assertRefused(runClaudeHook('git push origin x', linked, {}, guarded.hook), 2, /core\.hooksPath is \.githooks/)
	})
})
