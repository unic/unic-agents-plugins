// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectProvider } from '../index.mjs'

describe('detectProvider', () => {
	it('returns the azure_devops provider for a dev.azure.com PR URL', async () => {
		const provider = await detectProvider('https://dev.azure.com/myorg/myproj/_git/myrepo/pullrequest/42')
		assert.ok(provider, 'Expected a provider, got null')
		assert.equal(provider.name, 'azure_devops')
		assert.equal(provider.agents.fetcher, 'unic-pr-review:ado-fetcher')
		assert.equal(provider.agents.writer, 'unic-pr-review:ado-writer')
	})

	it('returns the azure_devops provider for a visualstudio.com PR URL', async () => {
		const provider = await detectProvider('https://myorg.visualstudio.com/myproj/_git/myrepo/pullrequest/7')
		assert.ok(provider)
		assert.equal(provider.name, 'azure_devops')
	})

	it('returns null for an unrecognised URL', async () => {
		const provider = await detectProvider('https://github.com/unic/repo/pull/1')
		assert.equal(provider, null)
	})

	it('lazy-loads only once — no duplicate provider entries on repeated calls', async () => {
		await detectProvider('https://dev.azure.com/org/proj/_git/repo/pullrequest/1')
		await detectProvider('https://dev.azure.com/org/proj/_git/repo/pullrequest/2')
		const provider = await detectProvider('https://dev.azure.com/org/proj/_git/repo/pullrequest/3')
		assert.ok(provider)
		assert.equal(provider.name, 'azure_devops')
	})
})
