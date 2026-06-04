// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { remotesMatch } from '../scripts/lib/remote-match.mjs'

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

	// ── Generic HTTPS ↔ SSH (non-ADO) ───────────────────────────────────────────

	it('matches GitHub HTTPS against GitHub SSH shorthand', () => {
		assert.equal(remotesMatch('https://github.com/org/repo', ['git@github.com:org/repo']), true)
	})

	it('matches GitLab SSH shorthand against GitLab HTTPS', () => {
		assert.equal(remotesMatch('git@gitlab.com:org/repo', ['https://gitlab.com/org/repo']), true)
	})
})
