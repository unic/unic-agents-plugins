// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseArgs } from '../scripts/lib/args.mjs'

describe('parseArgs', () => {
	it('parses --key=value form', () => {
		assert.deepEqual(parseArgs(['--url=https://x.atlassian.net']), { url: 'https://x.atlassian.net' })
	})

	it('parses --key value form', () => {
		assert.deepEqual(parseArgs(['--url', 'https://x.atlassian.net']), { url: 'https://x.atlassian.net' })
	})

	it('accepts an empty value with --key= form', () => {
		assert.deepEqual(parseArgs(['--url=']), { url: '' })
	})

	it('preserves additional = signs in --key=value form', () => {
		assert.deepEqual(parseArgs(['--token=a=b=c']), { token: 'a=b=c' })
	})

	it('parses multiple flags in mixed forms', () => {
		assert.deepEqual(parseArgs(['--url=https://x', '--user', 'me', '--token=t']), {
			url: 'https://x',
			user: 'me',
			token: 't',
		})
	})

	it('ignores bare positional arguments', () => {
		assert.deepEqual(parseArgs(['positional', '--url', 'https://x']), { url: 'https://x' })
	})

	it('throws when a flag has no value (last arg)', () => {
		assert.throws(() => parseArgs(['--url']), /--url requires a value/)
	})

	it('throws when a flag is followed by another flag instead of a value', () => {
		assert.throws(() => parseArgs(['--url', '--token', 't']), /--url requires a value/)
	})
})
