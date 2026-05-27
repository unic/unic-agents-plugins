// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	createNotice,
	formatNoticesAsPrePrPreamble,
	formatNoticesAsSummaryBlock,
	formatTrailer,
	mergeNotices,
} from '../scripts/ado/notices.mjs'

describe('createNotice', () => {
	it('returns a Notice with the canonical shape', () => {
		const n = createNotice('info', 'doc-context', 'hello')
		assert.deepEqual(n, { severity: 'info', kind: 'doc-context', message: 'hello' })
	})

	it('accepts the thread-fetch kind (Fetcher emits this on 5xx/network)', () => {
		const n = createNotice(
			'warning',
			'thread-fetch',
			'Threads endpoint degraded — proceeding without prior-review context.'
		)
		assert.equal(n.kind, 'thread-fetch')
		assert.equal(n.severity, 'warning')
	})
})

describe('mergeNotices', () => {
	it('returns [] when no sources are passed', () => {
		assert.deepEqual(mergeNotices(), [])
	})

	it('returns [] when all sources are empty', () => {
		assert.deepEqual(mergeNotices([], []), [])
	})

	it('preserves order across sources', () => {
		const a = [createNotice('warning', 'work-items', 'a')]
		const b = [createNotice('warning', 'diff-range', 'b')]
		assert.deepEqual(mergeNotices(a, b), [
			{ severity: 'warning', kind: 'work-items', message: 'a' },
			{ severity: 'warning', kind: 'diff-range', message: 'b' },
		])
	})

	it('dedupes by kind across sources — first wins', () => {
		const a = [createNotice('warning', 'work-items', 'first')]
		const b = [createNotice('warning', 'work-items', 'second')]
		assert.deepEqual(mergeNotices(a, b), [{ severity: 'warning', kind: 'work-items', message: 'first' }])
	})
})

describe('formatNoticesAsSummaryBlock', () => {
	it('returns empty string for empty input', () => {
		assert.equal(formatNoticesAsSummaryBlock([]), '')
	})

	it('renders heading + per-severity emoji lines', () => {
		const notices = [
			createNotice('info', 'doc-context', 'No work items linked.'),
			createNotice('warning', 'diff-range', 'Incremental diff unavailable.'),
		]
		const out = formatNoticesAsSummaryBlock(notices)
		assert.ok(out.startsWith('## Notices'))
		assert.ok(out.includes('ℹ️ No work items linked.'))
		assert.ok(out.includes('⚠ Incremental diff unavailable.'))
	})
})

describe('formatNoticesAsPrePrPreamble', () => {
	it('returns empty string for empty input', () => {
		assert.equal(formatNoticesAsPrePrPreamble([]), '')
	})

	it('omits the heading and renders one per-severity line per Notice', () => {
		const notices = [createNotice('warning', 'default-branch', 'Default branch fallback.')]
		assert.equal(formatNoticesAsPrePrPreamble(notices), '⚠ Default branch fallback.')
	})
})

describe('formatTrailer', () => {
	it('first-review with findings and one info notice', () => {
		const out = formatTrailer({
			mode: 'first-review',
			findings: { critical: 1, important: 2, minor: 0 },
			notices: [createNotice('info', 'doc-context', 'x')],
			prUrl: 'https://example.com/pr/1',
		})
		assert.equal(
			out,
			'✅ Review posted: 3 findings (1 critical, 2 important) · 0 warning notices · 1 info notice → https://example.com/pr/1'
		)
	})

	it('singular "finding" when only one', () => {
		const out = formatTrailer({
			mode: 'first-review',
			findings: { critical: 0, important: 1, minor: 0 },
			notices: [],
			prUrl: 'https://example.com/pr/2',
		})
		assert.ok(out.startsWith('✅ Review posted: 1 finding ('))
	})

	it('pre-pr mode omits info-notice count and PR URL', () => {
		const out = formatTrailer({
			mode: 'pre-pr',
			findings: { critical: 0, important: 0, minor: 3 },
			notices: [createNotice('warning', 'default-branch', 'fb')],
		})
		assert.equal(out, '✅ Pre-PR review complete: 3 findings (0 critical, 0 important) · 1 warning notice')
	})

	it('aborted mode prints reason + kind', () => {
		const out = formatTrailer({ mode: 'aborted', abortKind: 'auth', abortReason: 'token expired' })
		assert.equal(out, '❌ Review aborted: auth — token expired')
	})

	it('aborted mode with missing fields produces a still-readable line', () => {
		assert.equal(formatTrailer({ mode: 'aborted' }), '❌ Review aborted: unknown')
	})

	it('aborted with no abortReason omits separator', () => {
		assert.equal(formatTrailer({ mode: 'aborted', abortKind: 'auth' }), '❌ Review aborted: auth')
	})

	it('re-review mode produces same trailer format as first-review', () => {
		const out = formatTrailer({
			mode: 're-review',
			findings: { critical: 1, important: 0, minor: 0 },
			notices: [],
			prUrl: 'https://dev.azure.com/org/proj/_git/repo/pullrequest/42',
		})
		assert.ok(out.startsWith('✅ Review posted:'))
		assert.ok(out.includes('https://dev.azure.com'))
	})
})

describe('mergeNotices', () => {
	it('mergeNotices tolerates null and undefined sources', () => {
		const n = createNotice('info', 'doc-context', 'test')
		// @ts-expect-error — intentional test of runtime tolerance for null/undefined
		const result = mergeNotices(null, [n], undefined)
		assert.equal(result.length, 1)
		assert.equal(result[0].kind, 'doc-context')
	})
})
