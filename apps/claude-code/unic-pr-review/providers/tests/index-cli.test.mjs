// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const indexMjs = resolve(__dirname, '../index.mjs')

describe('providers/index.mjs detect CLI', () => {
	it('exits 0 and emits provider JSON for a dev.azure.com URL', () => {
		const out = execFileSync('node', [indexMjs, 'detect', 'https://dev.azure.com/o/p/_git/r/pullrequest/1'], {
			encoding: 'utf8',
		})
		const parsed = JSON.parse(out)
		assert.equal(parsed.name, 'azure_devops')
		assert.ok(parsed.fetcher.includes('ado-fetcher'))
		assert.ok(parsed.writer.includes('ado-writer'))
	})

	it('exits 1 for an unrecognised URL', () => {
		assert.throws(
			() => execFileSync('node', [indexMjs, 'detect', 'https://github.com/foo/bar/pull/1'], { encoding: 'utf8' }),
			(/** @type {any} */ err) => err.status === 1
		)
	})

	it('exits 1 when no URL provided', () => {
		assert.throws(
			() => execFileSync('node', [indexMjs, 'detect'], { encoding: 'utf8' }),
			(/** @type {any} */ err) => err.status === 1
		)
	})

	it('exits 1 for unknown subcommand', () => {
		assert.throws(
			() =>
				execFileSync('node', [indexMjs, 'unknown', 'https://dev.azure.com/o/p/_git/r/pullrequest/1'], {
					encoding: 'utf8',
				}),
			(/** @type {any} */ err) => err.status === 1
		)
	})
})

describe('providers/index.mjs parse-url CLI', () => {
	it('exits 0 and emits parsed PR ref for a dev.azure.com URL', () => {
		const out = execFileSync(
			'node',
			[indexMjs, 'parse-url', 'https://dev.azure.com/myorg/myproj/_git/myrepo/pullrequest/42'],
			{
				encoding: 'utf8',
			}
		)
		const parsed = JSON.parse(out)
		assert.equal(parsed.orgUrl, 'https://dev.azure.com/myorg')
		assert.equal(parsed.project, 'myproj')
		assert.equal(parsed.repo, 'myrepo')
		assert.equal(parsed.prId, 42)
	})

	it('exits 1 for an unrecognised URL', () => {
		assert.throws(
			() => execFileSync('node', [indexMjs, 'parse-url', 'https://github.com/foo/bar/pull/1'], { encoding: 'utf8' }),
			(/** @type {any} */ err) => err.status === 1
		)
	})
})
