// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseArgs, parseReviewSpecArgs } from '../scripts/lib/args.mjs'

describe('parseReviewSpecArgs', () => {
	it('parses a single URL from an array, post defaults to false', () => {
		assert.deepEqual(parseReviewSpecArgs(['https://x.atlassian.net/wiki/spaces/X/pages/1']), {
			urls: ['https://x.atlassian.net/wiki/spaces/X/pages/1'],
			post: false,
		})
	})

	it('sets post true when --post is present alongside a URL', () => {
		assert.deepEqual(parseReviewSpecArgs(['https://x.atlassian.net/wiki/spaces/X/pages/1', '--post']), {
			urls: ['https://x.atlassian.net/wiki/spaces/X/pages/1'],
			post: true,
		})
	})

	it('parses a space-separated string the same way as an array', () => {
		assert.deepEqual(parseReviewSpecArgs('https://x.atlassian.net/wiki/spaces/X/pages/1 --post'), {
			urls: ['https://x.atlassian.net/wiki/spaces/X/pages/1'],
			post: true,
		})
	})

	it('ignores non-URL tokens', () => {
		assert.deepEqual(parseReviewSpecArgs(['hello', 'https://x.atlassian.net/wiki/p/1', 'world']), {
			urls: ['https://x.atlassian.net/wiki/p/1'],
			post: false,
		})
	})

	it('returns empty urls and post false for empty input', () => {
		assert.deepEqual(parseReviewSpecArgs(''), { urls: [], post: false })
		assert.deepEqual(parseReviewSpecArgs([]), { urls: [], post: false })
	})

	it('captures multiple valid URLs in order', () => {
		assert.deepEqual(parseReviewSpecArgs(['https://a.example/wiki/p/1', 'https://b.example/wiki/p/2']), {
			urls: ['https://a.example/wiki/p/1', 'https://b.example/wiki/p/2'],
			post: false,
		})
	})

	it('ignores flags other than --post without throwing', () => {
		assert.deepEqual(parseReviewSpecArgs(['--verbose', 'https://x.example/wiki/p/1', '--dry-run']), {
			urls: ['https://x.example/wiki/p/1'],
			post: false,
		})
	})

	it('ignores non-http(s) URL schemes (ftp, file, mailto)', () => {
		assert.deepEqual(
			parseReviewSpecArgs([
				'ftp://files.example.com/spec.txt',
				'file:///etc/passwd',
				'mailto:someone@example.com',
				'https://x.example/wiki/p/1',
			]),
			{
				urls: ['https://x.example/wiki/p/1'],
				post: false,
			}
		)
	})

	it('keeps both http and https URLs', () => {
		assert.deepEqual(parseReviewSpecArgs(['http://a.example/wiki/p/1', 'https://b.example/wiki/p/2']), {
			urls: ['http://a.example/wiki/p/1', 'https://b.example/wiki/p/2'],
			post: false,
		})
	})
})

describe('parseArgs', () => {
	it('parses --key=value inline form', () => {
		assert.deepEqual(parseArgs(['--url=https://x.atlassian.net', '--username=u']), {
			url: 'https://x.atlassian.net',
			username: 'u',
		})
	})

	it('parses --key value space-separated form', () => {
		assert.deepEqual(parseArgs(['--url', 'https://x.atlassian.net', '--username', 'u']), {
			url: 'https://x.atlassian.net',
			username: 'u',
		})
	})

	it('records boolean flags as empty string (presence-only)', () => {
		const result = parseArgs(['--dry-run', '--verbose'], { booleanFlags: new Set(['dry-run', 'verbose']) })
		assert.ok('dry-run' in result)
		assert.ok('verbose' in result)
		assert.equal(result['dry-run'], '')
	})

	it('ignores bare positional args (no leading --)', () => {
		assert.deepEqual(parseArgs(['positional', '--url', 'https://x.example']), { url: 'https://x.example' })
	})

	it('throws when --flag appears at end of args with no value', () => {
		assert.throws(() => parseArgs(['--url']), /--url requires a value/)
	})

	it('throws when --flag is followed immediately by another --flag', () => {
		assert.throws(() => parseArgs(['--url', '--username']), /--url requires a value/)
	})

	it('returns empty object for empty args array', () => {
		assert.deepEqual(parseArgs([]), {})
	})
})
