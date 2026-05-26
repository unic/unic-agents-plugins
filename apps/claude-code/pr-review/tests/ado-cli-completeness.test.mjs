// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findUninventoriedCommands } from '../scripts/ado/cli-completeness.mjs'

describe('findUninventoriedCommands', () => {
	it('returns [] for empty sources', () => {
		const result = findUninventoriedCommands({ sources: [], inventory: [], allowlist: [] })
		assert.deepEqual(result, [])
	})

	it('returns single inline az repos pr show when not in inventory', () => {
		const result = findUninventoriedCommands({
			sources: [{ path: 'agents/x.md', content: 'PR=$(az repos pr show --id 1 --org $O)' }],
			inventory: [],
			allowlist: [],
		})
		assert.deepEqual(result, ['az repos pr show (agents/x.md)'])
	})

	it('returns [] when the command matches an inventory entry', () => {
		const result = findUninventoriedCommands({
			sources: [{ path: 'agents/x.md', content: 'az repos pr show --id 1' }],
			inventory: [{ kind: 'repos', command: ['az', 'repos', 'pr', 'show'], helpKeywordsRequired: [] }],
			allowlist: [],
		})
		assert.deepEqual(result, [])
	})

	it('returns [] when the command matches an allowlist regex', () => {
		const result = findUninventoriedCommands({
			sources: [{ path: 'agents/x.md', content: 'az --version && az extension list' }],
			inventory: [],
			allowlist: [/^az --version$/, /^az extension list$/],
		})
		assert.deepEqual(result, [])
	})

	it('handles multi-line bash with backslash continuations and split --area/--resource flags', () => {
		const block = [
			'RESP=$(az devops invoke \\',
			'  --area git \\',
			'  --resource pullRequestThreads \\',
			'  --route-parameters "repositoryId=$REPO_ID" \\',
			'  --org "$ORG_URL" \\',
			'  --output json)',
		].join('\n')
		const result = findUninventoriedCommands({
			sources: [{ path: 'agents/ado-fetcher.md', content: block }],
			inventory: [],
			allowlist: [],
		})
		assert.deepEqual(result, ['az devops invoke --area git --resource pullRequestThreads (agents/ado-fetcher.md)'])
	})

	it('returns only the uninventoried commands when source mixes allowlisted, inventoried, and uninventoried', () => {
		const content = [
			'az --version',
			'az extension list | grep azure-devops',
			'az repos pr show --id 1',
			'az boards work-item show --id 42',
			'az devops invoke --area git --resource pullRequestStatuses',
		].join('\n')
		const result = findUninventoriedCommands({
			sources: [{ path: 'commands/review-pr.md', content }],
			inventory: [
				{ kind: 'repos', command: ['az', 'repos', 'pr', 'show'], helpKeywordsRequired: [] },
				{ kind: 'boards', command: ['az', 'boards', 'work-item', 'show'], helpKeywordsRequired: [] },
			],
			allowlist: [/^az --version$/, /^az extension list$/],
		})
		assert.deepEqual(result, ['az devops invoke --area git --resource pullRequestStatuses (commands/review-pr.md)'])
	})

	it('ignores markdown inline-code prose references like `az devops invoke`', () => {
		const content = [
			'Use `az devops invoke` to call the API.',
			'Do not call `az devops invoke --resource pullRequestThreads` for GET ops.',
			'Tip: pass `az` flags carefully.',
		].join('\n')
		const result = findUninventoriedCommands({
			sources: [{ path: 'agents/ado-writer.md', content }],
			inventory: [],
			allowlist: [],
		})
		assert.deepEqual(result, [])
	})

	it('ignores `az` mentions in shell comments (# ... az devops login hint and abort)', () => {
		const content = ['az repos pr show --id 1', '# 401/403 — surface the az devops login hint and abort.'].join('\n')
		const result = findUninventoriedCommands({
			sources: [{ path: 'agents/x.md', content }],
			inventory: [{ kind: 'repos', command: ['az', 'repos', 'pr', 'show'], helpKeywordsRequired: [] }],
			allowlist: [],
		})
		assert.deepEqual(result, [])
	})

	it('ignores az references inside JS string literals (single or double quoted)', () => {
		const content = `throw new Error("Try \\\`az devops login\\\` to re-authenticate.")`
		const result = findUninventoriedCommands({
			sources: [{ path: 'scripts/ado/x.mjs', content }],
			inventory: [],
			allowlist: [],
		})
		assert.deepEqual(result, [])
	})

	it('ignores az inside an echoed double-quoted error message even when whitespace precedes it', () => {
		const content =
			'echo "ERROR: az devops invoke unavailable. Re-install: az extension remove --name azure-devops" >&2'
		const result = findUninventoriedCommands({
			sources: [{ path: 'commands/review-pr.md', content }],
			inventory: [],
			allowlist: [],
		})
		assert.deepEqual(result, [])
	})

	it('matches an az devops invoke entry against split --area/--resource flags', () => {
		const block = ['az devops invoke \\', '  --area git \\', '  --resource pullRequestThreads'].join('\n')
		const result = findUninventoriedCommands({
			sources: [{ path: 'a.md', content: block }],
			inventory: [
				{
					kind: 'invoke',
					area: 'git',
					resource: 'pullRequestThreads',
					command: ['az', 'devops', 'invoke'],
					helpKeywordsRequired: [],
				},
			],
			allowlist: [],
		})
		assert.deepEqual(result, [])
	})
})
