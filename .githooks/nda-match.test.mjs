// @ts-check
// Tests for the NDA guards. Every fixture uses a made-up term: a real term in a test publishes it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { findTerm, readTerms } from './nda-match.mjs'

const TERM = 'zorblax'
const HOOKS = dirname(fileURLToPath(import.meta.url))
const CLAUDE_HOOK = join(HOOKS, '..', '.claude', 'hooks', 'block-nda-terms.mjs')
const BASE64 = `QmFzZTY0${TERM}ZGF0YQ0Kc2VlbXMgcmFuZG9tIGVub3VnaA==`
const DATA_URI = `url(data:font/woff2;base64,AAB${TERM}Czz9+/)`

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
	test('passes the term inside a data URI', () => {
		assert.equal(findTerm(DATA_URI, [TERM]), null)
	})
	test('passes the term inside a base64 run', () => {
		assert.equal(findTerm(BASE64, [TERM]), null)
	})
	test('refuses the term in a long URL that holds a digit', () => {
		assert.equal(findTerm(`https://github.com/unic/${TERM}2026/tree/main/src/components`, [TERM]), TERM)
	})
	test('refuses the term in a long path that holds a digit', () => {
		assert.equal(findTerm(`apps/claude-code/${TERM}/src/components/v2/HeaderNavigation`, [TERM]), TERM)
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
	run('git', ['init', '-q'], dir)
	if (viaSymlink) symlinkSync(join(HOOKS, 'pre-commit'), join(dir, '.git', 'hooks', 'pre-commit'))
	else run('git', ['config', 'core.hooksPath', HOOKS], dir)
	run('git', ['config', 'user.email', 'guard@example.com'], dir)
	run('git', ['config', 'user.name', 'Guard Test'], dir)
	writeFileSync(join(dir, 'file.txt'), content)
	run('git', ['add', 'file.txt'], dir)
	return dir
}

const commit = (/** @type {string} */ dir, message = 'add file', env = {}) =>
	run('git', ['commit', '-q', '-m', message], dir, env).status

describe('git hooks', () => {
	test('pre-commit refuses a staged term in prose', () => {
		assert.notEqual(commit(repoWith(`Built for ${TERM}.\n`)), 0)
	})
	test('pre-commit passes a staged term inside a data URI', () => {
		assert.equal(commit(repoWith(`${DATA_URI}\n`)), 0)
	})
	test('pre-commit refuses when the term list is missing', () => {
		assert.notEqual(commit(repoWith('clean\n'), 'add file', { UNIC_NDA_DENYLIST: missingList }), 0)
	})
	test('pre-commit installed as a symlink refuses a staged term', { skip: process.platform === 'win32' }, () => {
		assert.notEqual(commit(repoWith(`Built for ${TERM}.\n`, 'repo-', true)), 0)
	})
	test('commit-msg refuses the term in the message', () => {
		assert.notEqual(commit(repoWith('clean\n'), `fix: ${TERM} typo`), 0)
	})
})

/**
 * @param {string} command
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 */
const claudeHook = (command, cwd, env) =>
	run('node', [CLAUDE_HOOK], cwd, env, JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command } })).status

describe('Claude hook', () => {
	// The session's cwd is a clean repository, as in a session that commits in a worktree elsewhere.
	const clone = repoWith('clean\n')

	test('refuses a staged term committed through git -C from another directory', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assert.equal(claudeHook(`git -C ${dir} commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through cd from another directory', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assert.equal(claudeHook(`cd ${dir} && git commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through a quoted git -C path with a space', () => {
		const dir = repoWith(`Built for ${TERM}.\n`, 'my wt-')
		assert.equal(claudeHook(`git -C "${dir}" commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed after cd on an earlier line', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assert.equal(claudeHook(`cd ${dir}\ngit commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through pushd', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assert.equal(claudeHook(`pushd ${dir} && git commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through --work-tree', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assert.equal(claudeHook(`git --git-dir=${join(dir, '.git')} --work-tree=${dir} commit -m "add file"`, clone), 2)
	})
	test('refuses a staged term committed through GIT_DIR', () => {
		const dir = repoWith(`Built for ${TERM}.\n`)
		assert.equal(claudeHook(`GIT_DIR=${join(dir, '.git')} git commit -m "add file"`, clone), 2)
	})
	test('refuses a commit whose git -C path is a shell variable', () => {
		assert.equal(claudeHook('git -C $WORKTREE commit -m "add file"', clone), 2)
	})
	test('passes a staged term inside a data URI', () => {
		const dir = repoWith(`${DATA_URI}\n`)
		assert.equal(claudeHook('git commit -m "add file"', dir), 0)
	})
	test('refuses the term in the commit message', () => {
		assert.equal(claudeHook(`git commit -m "fix: ${TERM} typo"`, repoWith('clean\n')), 2)
	})
	test('refuses when the term list is missing', () => {
		assert.equal(claudeHook('git commit -m "add file"', repoWith('clean\n'), { UNIC_NDA_DENYLIST: missingList }), 2)
	})
})
