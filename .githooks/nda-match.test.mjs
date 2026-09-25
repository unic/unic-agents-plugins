// @ts-check
// Tests for the NDA guards. Every fixture uses a made-up term: a real term in a test publishes it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

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
 * @param {string} content
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
			assertRefused(commit(dir, `fix: ${TERM} typo`), 1, /cannot find nda-match\.mjs/)
		}
	)
	test('the matcher refuses a term when reached through a symlinked directory', () => {
		const link = join(scratch, `linked-hooks-${Date.now()}`)
		symlinkSync(HOOKS, link, 'junction')
		assertRefused(run('node', [join(link, 'nda-match.mjs'), 'pre-commit'], scratch, {}, `Built for ${TERM}.\n`), 1)
	})
	test('commit-msg refuses the term in the message', () => {
		assertRefused(commit(createStagedRepo('clean\n'), `fix: ${TERM} typo`), 1)
	})
})

/**
 * @param {string} command
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 */
const runClaudeHook = (command, cwd, env) =>
	run('node', [CLAUDE_HOOK], cwd, env, JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command } }))

describe('Claude hook', () => {
	// The session's cwd is a clean repository, as in a session that commits in a worktree elsewhere.
	const clone = createStagedRepo('clean\n')

	test('refuses a staged term committed through git -C from another directory', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`git -C ${dir} commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through cd from another directory', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`cd ${dir} && git commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through a quoted git -C path with a space', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`, 'my wt-')
		assertRefused(runClaudeHook(`git -C "${dir}" commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed after cd on an earlier line', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`cd ${dir}\ngit commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through pushd', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`pushd ${dir} && git commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through --work-tree', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`git --git-dir=${join(dir, '.git')} --work-tree=${dir} commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through GIT_DIR', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`GIT_DIR=${join(dir, '.git')} git commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed with a partly quoted -c value', () => {
		assertRefused(
			runClaudeHook(`git -c core.editor='code -w' commit -m "add file"`, createStagedRepo(`Built for ${TERM}.\n`)),
			2
		)
	})
	test('passes a clean commit that reuses a message through commit -C', () => {
		assert.equal(runClaudeHook('git commit -C HEAD', createStagedRepo('clean\n')).status, 0)
	})
	test('passes a clean commit whose message mentions -C', () => {
		assert.equal(runClaudeHook('git commit -m "use ls -C for columns"', createStagedRepo('clean\n')).status, 0)
	})
	test('passes a clean commit whose quoted message mentions cd in parentheses', () => {
		assert.equal(runClaudeHook('git commit -m "docs: wrap it (cd docs first)"', createStagedRepo('clean\n')).status, 0)
	})
	test('passes a clean commit whose quoted message names GIT_DIR and --work-tree', () => {
		assert.equal(
			runClaudeHook(`git commit -m 'docs: set GIT_DIR=foo, pass --work-tree bar'`, createStagedRepo('clean\n')).status,
			0
		)
	})
	test('passes a clean commit whose heredoc message starts a line with cd', () => {
		assert.equal(
			runClaudeHook("git commit -F - <<'EOF'\ndocs: steps\n\ncd docs\nEOF", createStagedRepo('clean\n')).status,
			0
		)
	})
	test('refuses a staged term committed after cd even when the message mentions cd', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		assertRefused(runClaudeHook(`cd ${dir} && git commit -m "docs: (cd docs first)"`, clone), 2)
	})
	test('refuses a commit whose git -C path is a shell variable', () => {
		assertRefused(runClaudeHook('git -C $WORKTREE commit -m "add file"', clone), 2, /cannot read the staged diff/)
	})
	test('refuses a staged term committed after cd that follows a tab-indented <<- heredoc', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		const command = `git commit -F - <<-EOF\n\tdocs: steps\n\tEOF\ncd ${dir}\ngit commit -F - <<EOF\nadd file\nEOF`
		assertRefused(runClaudeHook(command, clone), 2)
	})
	test('refuses a staged term committed after cd when a << heredoc holds a tab-indented closing word', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		const command = `git commit -F - <<EOF\n\tEOF\nx commit -F - <<X\nEOF\ncd ${dir}\ngit commit -m "add file"\nX`
		assertRefused(runClaudeHook(command, clone), 2)
	})
	test('refuses a staged term committed after cd when a << heredoc holds a line that starts with its word', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		const command = `git commit -F - <<EOF\nEOFX\nx commit -F - <<X\nEOF\ncd ${dir}\ngit commit -m "add file"\nX`
		assertRefused(runClaudeHook(command, clone), 2)
	})
	test('refuses a staged term committed after cd when a <<- heredoc holds a space-indented closing word', () => {
		const dir = createStagedRepo(`Built for ${TERM}.\n`)
		const command = `git commit -F - <<-EOF\n  EOF\nx commit -F - <<X\nEOF\ncd ${dir}\ngit commit -m "add file"\nX`
		assertRefused(runClaudeHook(command, clone), 2)
	})
	test('refuses a staged term in a long absolute path', () => {
		assertRefused(runClaudeHook('git commit -m "add file"', createStagedRepo(`${LONG_PATH}\n`)), 2)
	})
	test('refuses a staged term in a short data URI', () => {
		assertRefused(runClaudeHook('git commit -m "add file"', createStagedRepo(`${SHORT_DATA_URI}\n`)), 2)
	})
	test('passes a staged term inside a real font', () => {
		const dir = createStagedRepo(`${FONT_WITH_TERM}\n`)
		assert.equal(runClaudeHook('git commit -m "add file"', dir).status, 0)
	})
	test('refuses the term in the commit message', () => {
		assertRefused(runClaudeHook(`git commit -m "fix: ${TERM} typo"`, createStagedRepo('clean\n')), 2)
	})
	test('refuses when the term list is missing', () => {
		assertRefused(
			runClaudeHook('git commit -m "add file"', createStagedRepo('clean\n'), { UNIC_NDA_DENYLIST: missingList }),
			2,
			/cannot read the NDA term list/
		)
	})
})
