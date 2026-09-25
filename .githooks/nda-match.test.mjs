// @ts-check
// Tests for the NDA guards. Every fixture uses a made-up term: a real term in a test publishes it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { findTerm, readTerms } from './nda-match.mjs'

const TERM = 'zorblax'
const HOOKS = dirname(fileURLToPath(import.meta.url))
const CLAUDE_HOOK = join(HOOKS, '..', '.claude', 'hooks', 'block-nda-terms.mjs')
const BASE64 = `QmFzZTY0${TERM}ZGF0YQ0Kc2VlbXMgcmFuZG9tIGVub3VnaCB0byBwYXNzIHRoZSBlaWdodHkgY2hhcmFjdGVyIGJhcg==`
// A real font from an Archify diagram, with the term spliced into its payload.
const ARCHIFY_HTML = join(
	HOOKS,
	'..',
	'apps',
	'claude-code',
	'unic-archon-dlc',
	'docs',
	'architecture',
	'20260925-unic-dlc-architecture.html'
)
const FONT = /data:font\/[^,\s]*;base64,[A-Za-z0-9+/=]+/.exec(readFileSync(ARCHIFY_HTML, 'utf8'))?.[0] ?? ''
const DATA_URI = `url(${FONT.slice(0, 1000)}${TERM}${FONT.slice(1000)})`
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
		assert.equal(findTerm(DATA_URI, [TERM]), null)
	})
	test('passes the term inside a base64 run', () => {
		assert.equal(findTerm(BASE64, [TERM]), null)
	})
	test('refuses the term in a long URL that holds a digit', () => {
		assert.equal(findTerm(`https://github.com/unic/${TERM}2026/tree/main/src/components`, [TERM]), TERM)
	})
	test('finds a font in the Archify diagram to test with', () => {
		assert.ok(FONT.length > 1000)
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
	test('refuses the term in compact code that holds a digit and a plus', () => {
		assert.equal(findTerm(`total=${TERM}CountForTheCurrentQuarter2+otherCountValue`, [TERM]), TERM)
	})
	test('refuses the term in a query string that holds a digit and a plus', () => {
		assert.equal(findTerm(`https://x.io/r?next=${TERM}/2026/tree/main/src/components/header+nav`, [TERM]), TERM)
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
function repoWith(content, prefix = 'repo-', viaSymlink = false) {
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
 * A refusal must name its reason: an unreadable diff or a missing module also exits non-zero.
 * @param {{ status: number | null, stderr: string }} result
 * @param {RegExp} [reason]
 */
function assertRefused(result, reason = REFUSED) {
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, reason)
}

describe('git hooks', () => {
	test('pre-commit refuses a staged term in prose', () => {
		assertRefused(commit(repoWith(`Built for ${TERM}.\n`)))
	})
	test('pre-commit refuses a staged term in a long absolute path', () => {
		assertRefused(commit(repoWith(`${LONG_PATH}\n`)))
	})
	test('pre-commit refuses a staged term in a short data URI', () => {
		assertRefused(commit(repoWith(`${SHORT_DATA_URI}\n`)))
	})
	test('pre-commit passes a staged term inside a real font', () => {
		assert.equal(commit(repoWith(`${DATA_URI}\n`)).status, 0)
	})
	test('pre-commit refuses when the term list is missing', () => {
		assertRefused(
			commit(repoWith('clean\n'), 'add file', { UNIC_NDA_DENYLIST: missingList }),
			/cannot read the NDA term list/
		)
	})
	test('pre-commit installed as a symlink refuses a staged term', { skip: process.platform === 'win32' }, () => {
		assertRefused(commit(repoWith(`Built for ${TERM}.\n`, 'repo-', true)))
	})
	test('commit-msg refuses the term in the message', () => {
		assertRefused(commit(repoWith('clean\n'), `fix: ${TERM} typo`))
	})
})

/**
 * @param {string} command
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 */
const claudeHook = (command, cwd, env) =>
	run('node', [CLAUDE_HOOK], cwd, env, JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command } }))

describe('Claude hook', () => {
	// The session's cwd is a clean repository, as in a session that commits in a worktree elsewhere.
	const clone = repoWith('clean\n')

	test('refuses a staged term committed through git -C from another directory', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assertRefused(claudeHook(`git -C ${dir} commit -m "add file"`, clone))
	})
	test('refuses a staged term committed through cd from another directory', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assertRefused(claudeHook(`cd ${dir} && git commit -m "add file"`, clone))
	})
	test('refuses a staged term committed through a quoted git -C path with a space', () => {
		const dir = repoWith(`Built for ${TERM}.\n`, 'my wt-')
		assertRefused(claudeHook(`git -C "${dir}" commit -m "add file"`, clone))
	})
	test('refuses a staged term committed after cd on an earlier line', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assertRefused(claudeHook(`cd ${dir}\ngit commit -m "add file"`, clone))
	})
	test('refuses a staged term committed through pushd', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assertRefused(claudeHook(`pushd ${dir} && git commit -m "add file"`, clone))
	})
	test('refuses a staged term committed through --work-tree', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assertRefused(claudeHook(`git --git-dir=${join(dir, '.git')} --work-tree=${dir} commit -m "add file"`, clone))
	})
	test('refuses a staged term committed through GIT_DIR', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assertRefused(claudeHook(`GIT_DIR=${join(dir, '.git')} git commit -m "add file"`, clone))
	})
	test('refuses a staged term committed with a partly quoted -c value', () => {
		assertRefused(claudeHook(`git -c core.editor='code -w' commit -m "add file"`, repoWith(`Built for ${TERM}.\n`)))
	})
	test('passes a clean commit that reuses a message through commit -C', () => {
		assert.equal(claudeHook('git commit -C HEAD', repoWith('clean\n')).status, 0)
	})
	test('passes a clean commit whose message mentions -C', () => {
		assert.equal(claudeHook('git commit -m "use ls -C for columns"', repoWith('clean\n')).status, 0)
	})
	test('passes a clean commit whose quoted message mentions cd in parentheses', () => {
		assert.equal(claudeHook('git commit -m "docs: wrap it (cd docs first)"', repoWith('clean\n')).status, 0)
	})
	test('passes a clean commit whose quoted message names GIT_DIR and --work-tree', () => {
		assert.equal(
			claudeHook(`git commit -m 'docs: set GIT_DIR=foo, pass --work-tree bar'`, repoWith('clean\n')).status,
			0
		)
	})
	test('passes a clean commit whose heredoc message starts a line with cd', () => {
		assert.equal(claudeHook("git commit -F - <<'EOF'\ndocs: steps\n\ncd docs\nEOF", repoWith('clean\n')).status, 0)
	})
	test('refuses a staged term committed after cd even when the message mentions cd', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assertRefused(claudeHook(`cd ${dir} && git commit -m "docs: (cd docs first)"`, clone))
	})
	test('refuses a commit whose git -C path is a shell variable', () => {
		assertRefused(claudeHook('git -C $WORKTREE commit -m "add file"', clone), /cannot read the staged diff/)
	})
	test('refuses a staged term committed after cd that follows a tab-indented <<- heredoc', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		const command = `git commit -F - <<-EOF\n\tdocs: steps\n\tEOF\ncd ${dir}\ngit commit -F - <<EOF\nadd file\nEOF`
		assertRefused(claudeHook(command, clone))
	})
	test('refuses a staged term in a long absolute path', () => {
		assertRefused(claudeHook('git commit -m "add file"', repoWith(`${LONG_PATH}\n`)))
	})
	test('refuses a staged term in a short data URI', () => {
		assertRefused(claudeHook('git commit -m "add file"', repoWith(`${SHORT_DATA_URI}\n`)))
	})
	test('passes a staged term inside a real font', () => {
		const dir = repoWith(`${DATA_URI}\n`)
		assert.equal(claudeHook('git commit -m "add file"', dir).status, 0)
	})
	test('refuses the term in the commit message', () => {
		assertRefused(claudeHook(`git commit -m "fix: ${TERM} typo"`, repoWith('clean\n')))
	})
	test('refuses when the term list is missing', () => {
		assertRefused(
			claudeHook('git commit -m "add file"', repoWith('clean\n'), { UNIC_NDA_DENYLIST: missingList }),
			/cannot read the NDA term list/
		)
	})
})
