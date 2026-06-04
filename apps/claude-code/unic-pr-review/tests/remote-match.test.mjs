// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { remotesMatch } from '../scripts/lib/remote-match.mjs'

const CLI = fileURLToPath(new URL('../scripts/lib/remote-match.mjs', import.meta.url))

describe('remotesMatch', () => {
	// ── ADO HTTPS vs SSH equivalence ───────────────────────────────────────────

	it('matches ADO HTTPS against ADO SSH for the same repo', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/myorg/myproject/_git/myrepo', [
				'git@ssh.dev.azure.com:v3/myorg/myproject/myrepo',
			]),
			true
		)
	})

	it('matches ADO SSH against ADO HTTPS for the same repo', () => {
		assert.equal(
			remotesMatch('git@ssh.dev.azure.com:v3/myorg/myproject/myrepo', [
				'https://dev.azure.com/myorg/myproject/_git/myrepo',
			]),
			true
		)
	})

	it('matches ADO HTTPS against legacy visualstudio.com HTTPS for the same repo', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/myorg/myproject/_git/myrepo', [
				'https://myorg.visualstudio.com/myproject/_git/myrepo',
			]),
			true
		)
	})

	// ── .git suffix ─────────────────────────────────────────────────────────────

	it('ignores trailing .git suffix on HTTPS URL', () => {
		assert.equal(remotesMatch('https://github.com/org/repo.git', ['https://github.com/org/repo']), true)
	})

	it('ignores trailing .git suffix on SSH URL', () => {
		assert.equal(remotesMatch('https://github.com/org/repo', ['git@github.com:org/repo.git']), true)
	})

	it('ignores trailing .git suffix on ADO SSH URL', () => {
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', ['git@ssh.dev.azure.com:v3/o/p/r.git']), true)
	})

	it('ignores a trailing slash on a generic HTTPS URL', () => {
		assert.equal(remotesMatch('https://github.com/org/repo/', ['https://github.com/org/repo']), true)
	})

	it('ignores a combined .git suffix and trailing slash (repo.git/)', () => {
		assert.equal(remotesMatch('https://github.com/org/repo.git/', ['https://github.com/org/repo']), true)
	})

	// ── Host casing ─────────────────────────────────────────────────────────────

	it('ignores host casing on HTTPS URL', () => {
		assert.equal(remotesMatch('https://GITHUB.COM/org/repo', ['https://github.com/org/repo']), true)
	})

	it('ignores host casing on ADO HTTPS URL', () => {
		assert.equal(remotesMatch('https://DEV.AZURE.COM/o/p/_git/r', ['https://dev.azure.com/o/p/_git/r']), true)
	})

	// ── Embedded credentials ─────────────────────────────────────────────────────

	it('strips embedded user:token credentials from HTTPS URL', () => {
		assert.equal(remotesMatch('https://user:token@github.com/org/repo', ['https://github.com/org/repo']), true)
	})

	it('strips embedded username (ADO pat-style) from HTTPS URL', () => {
		assert.equal(
			remotesMatch('https://myorg@dev.azure.com/myorg/myproject/_git/myrepo', [
				'https://dev.azure.com/myorg/myproject/_git/myrepo',
			]),
			true
		)
	})

	it('strips credentials from local remote URL', () => {
		assert.equal(remotesMatch('https://github.com/org/repo', ['https://pat:x@github.com/org/repo']), true)
	})

	// ── Different repo does not match ───────────────────────────────────────────

	it('returns false for a different repo on the same host', () => {
		assert.equal(remotesMatch('https://github.com/org/repo-a', ['https://github.com/org/repo-b']), false)
	})

	it('returns false for a different ADO repo', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/org/proj/_git/repo-a', ['https://dev.azure.com/org/proj/_git/repo-b']),
			false
		)
	})

	it('returns false across forms for a different ADO repo (HTTPS vs SSH)', () => {
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/repo-a', ['git@ssh.dev.azure.com:v3/o/p/repo-b']), false)
	})

	it('does not let a generic host collide with an ADO identity token', () => {
		// ADO URLs normalise to an `ado:` token, generic URLs to `<host>/<path>`;
		// the two namespaces must never collide even if a path mimics the token.
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', ['https://evil.com/ado:o/p/r']), false)
	})

	it('does not match an ADO URL with extra trailing path segments', () => {
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', ['https://dev.azure.com/o/p/_git/r/extra']), false)
	})

	it('does not let a malformed remote forge an ado: identity token', () => {
		// An unparseable value is tagged `raw:`, so it cannot equal a real `ado:` token.
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', ['ado:o/p/r']), false)
	})

	it('returns false for same repo name in a different ADO project', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/org/project-a/_git/repo', ['https://dev.azure.com/org/project-b/_git/repo']),
			false
		)
	})

	// ── Multiple local remotes ───────────────────────────────────────────────────

	it('returns true when one of multiple local remotes matches', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/o/p/_git/r', [
				'https://github.com/other/repo',
				'git@ssh.dev.azure.com:v3/o/p/r',
				'https://some.other.host/path',
			]),
			true
		)
	})

	it('returns false when none of multiple local remotes matches', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/o/p/_git/r', [
				'https://dev.azure.com/o/p/_git/other',
				'https://github.com/o/r',
			]),
			false
		)
	})

	// ── Empty local-remote list ──────────────────────────────────────────────────

	it('returns false for an empty local-remote array', () => {
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', []), false)
	})

	it('returns false when localRemoteUrls is not an array', () => {
		// @ts-expect-error — intentional misuse
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', null), false)
	})

	it('returns false when localRemoteUrls contains a null element', () => {
		// @ts-expect-error — intentional misuse
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', [null, 'https://github.com/other/repo']), false)
	})

	it('returns false when adoRemoteUrl is null', () => {
		// @ts-expect-error — intentional misuse
		assert.equal(remotesMatch(null, ['https://dev.azure.com/o/p/_git/r']), false)
	})

	// ── ADO path-component casing ────────────────────────────────────────────────

	it('ignores org/project/repo casing on ADO HTTPS URL', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/MyOrg/MyProject/_git/MyRepo', [
				'https://dev.azure.com/myorg/myproject/_git/myrepo',
			]),
			true
		)
	})

	it('ignores path casing when matching ADO HTTPS against ADO SSH shorthand', () => {
		assert.equal(
			remotesMatch('https://dev.azure.com/MyOrg/MyProject/_git/MyRepo', [
				'git@ssh.dev.azure.com:v3/MYORG/MYPROJECT/MYREPO',
			]),
			true
		)
	})

	// ── Full ssh:// ADO URI form ─────────────────────────────────────────────────

	it('matches ADO full ssh:// URI against ADO HTTPS', () => {
		assert.equal(remotesMatch('https://dev.azure.com/o/p/_git/r', ['ssh://ssh.dev.azure.com/v3/o/p/r']), true)
	})

	// ── URL-parse failure fallback ───────────────────────────────────────────────

	it('returns false for an unparseable ADO URL matched against a valid remote', () => {
		assert.equal(remotesMatch('not-a-url', ['https://github.com/org/repo']), false)
	})

	it('does not throw for an unparseable local remote URL', () => {
		assert.equal(remotesMatch('https://github.com/org/repo', ['not-a-url']), false)
	})

	// ── Generic HTTPS ↔ SSH (non-ADO) ───────────────────────────────────────────

	it('matches GitHub HTTPS against GitHub SSH shorthand', () => {
		assert.equal(remotesMatch('https://github.com/org/repo', ['git@github.com:org/repo']), true)
	})

	it('matches GitLab SSH shorthand against GitLab HTTPS', () => {
		assert.equal(remotesMatch('git@gitlab.com:org/repo', ['https://gitlab.com/org/repo']), true)
	})
})

describe('remote-match CLI', () => {
	// `git remote -v` emits two lines per remote (fetch + push); the CLI dedups them.
	const gitRemoteV = [
		'origin\thttps://dev.azure.com/o/p/_git/r (fetch)',
		'origin\thttps://dev.azure.com/o/p/_git/r (push)',
	].join('\n')

	it('prints "true" when a local remote matches the ADO URL', () => {
		const out = execFileSync(process.execPath, [CLI, 'https://dev.azure.com/o/p/_git/r'], {
			input: gitRemoteV,
			encoding: 'utf8',
		})
		assert.equal(out.trim(), 'true')
	})

	it('prints "false" when no local remote matches', () => {
		const out = execFileSync(process.execPath, [CLI, 'https://dev.azure.com/o/p/_git/other'], {
			input: gitRemoteV,
			encoding: 'utf8',
		})
		assert.equal(out.trim(), 'false')
	})

	it('prints "false" for empty stdin (no remotes)', () => {
		const out = execFileSync(process.execPath, [CLI, 'https://dev.azure.com/o/p/_git/r'], {
			input: '',
			encoding: 'utf8',
		})
		assert.equal(out.trim(), 'false')
	})

	it('exits non-zero with a usage error when the ADO URL arg is missing', () => {
		let threw = false
		try {
			execFileSync(process.execPath, [CLI], { input: gitRemoteV, encoding: 'utf8' })
		} catch (err) {
			threw = true
			assert.equal(/** @type {{ status?: number }} */ (err).status, 1)
		}
		assert.ok(threw, 'Expected the CLI to exit non-zero when no ADO URL is given')
	})
})
