// @ts-check
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { CliError } from './errors.mjs'
import { injectContent } from './inject.mjs'

describe('injectContent — strategy 1: plain-text markers', () => {
	it('replaces content between matching markers', () => {
		const body = '<p>[AUTO_INSERT_START: docs]</p>\n<p>old content</p>\n<p>[AUTO_INSERT_END: docs]</p>'
		const result = injectContent(body, '<p>new content</p>', 'Test Page')
		assert.ok(result.includes('<p>new content</p>'), 'new content present')
		assert.ok(!result.includes('old content'), 'old content removed')
		assert.ok(result.includes('[AUTO_INSERT_START: docs]'), 'start marker preserved')
		assert.ok(result.includes('[AUTO_INSERT_END: docs]'), 'end marker preserved')
	})

	it('preserves content outside the markers', () => {
		const body =
			'<p>before</p>\n<p>[AUTO_INSERT_START: docs]</p>\n<p>old</p>\n<p>[AUTO_INSERT_END: docs]</p>\n<p>after</p>'
		const result = injectContent(body, '<p>new</p>', 'Test')
		assert.ok(result.includes('<p>before</p>'), 'content before marker preserved')
		assert.ok(result.includes('<p>after</p>'), 'content after marker preserved')
	})

	it('handles markers without surrounding <p> tags', () => {
		const body = '[AUTO_INSERT_START: raw]\nold\n[AUTO_INSERT_END: raw]'
		const result = injectContent(body, 'new', 'Test')
		assert.ok(result.includes('new'), 'new content present')
		assert.ok(!result.includes('old'), 'old content removed')
	})

	it('throws CliError on mismatched marker labels', () => {
		const body = '[AUTO_INSERT_START:overview]\n<p>content</p>\n[AUTO_INSERT_END:summary]'
		assert.throws(
			() => injectContent(body, '<p>new</p>', 'Test Page'),
			(err) => err instanceof CliError && /label mismatch/.test(err.message)
		)
	})

	// TC-01: bare markers — no <p> wrapping
	it('TC-01: bare markers preserve both markers, replace content, no dangling tags', () => {
		const body = '<h1>Intro</h1>\n[AUTO_INSERT_START:overview]\n<p>old</p>\n[AUTO_INSERT_END:overview]\n<p>Footer</p>'
		const result = injectContent(body, '<p>new</p>', 'Test Page')
		assert.strictEqual(
			result,
			'<h1>Intro</h1>\n[AUTO_INSERT_START:overview]\n<p>new</p>\n[AUTO_INSERT_END:overview]\n<p>Footer</p>'
		)
	})

	// TC-02: <p>-wrapped markers — full pair consumed
	it('TC-02: <p>-wrapped markers preserve full <p>marker</p> blocks, no dangling tags', () => {
		const body =
			'<h1>Intro</h1>\n<p>[AUTO_INSERT_START:overview]</p>\n<p>old</p>\n<p>[AUTO_INSERT_END:overview]</p>\n<p>Footer</p>'
		const result = injectContent(body, '<p>new</p>', 'Test Page')
		assert.strictEqual(
			result,
			'<h1>Intro</h1>\n<p>[AUTO_INSERT_START:overview]</p>\n<p>new</p>\n<p>[AUTO_INSERT_END:overview]</p>\n<p>Footer</p>'
		)
	})

	// TC-03: <p>-wrapped with internal whitespace
	it('TC-03: whitespace inside <p>-wrapped markers is tolerated', () => {
		const body = '<p>  [AUTO_INSERT_START:overview]  </p>\n<p>old</p>\n<p>  [AUTO_INSERT_END:overview]  </p>'
		const result = injectContent(body, '<p>new</p>', 'Test Page')
		assert.ok(result.includes('[AUTO_INSERT_START:overview]'), 'start marker present')
		assert.ok(result.includes('[AUTO_INSERT_END:overview]'), 'end marker present')
		assert.ok(!result.includes('old'), 'old content removed')
		assert.ok(result.includes('<p>new</p>'), 'new content injected')
		// Full <p>  …  </p> blocks preserved verbatim
		assert.ok(result.includes('<p>  [AUTO_INSERT_START:overview]  </p>'), 'start block verbatim')
		assert.ok(result.includes('<p>  [AUTO_INSERT_END:overview]  </p>'), 'end block verbatim')
	})

	// TC-04: mismatch — START bare, END <p>-wrapped → exit 1
	it('TC-04: START bare + END <p>-wrapped → exit 1 with wrapping mismatch', () => {
		const r = spawnSync(
			process.execPath,
			[
				'--input-type=module',
				'--eval',
				`
import { injectContent } from "${new URL('./inject.mjs', import.meta.url).pathname}";
injectContent("[AUTO_INSERT_START:overview]\\n<p>old</p>\\n<p>[AUTO_INSERT_END:overview]</p>", "<p>new</p>", "P");
`,
			],
			{ encoding: 'utf8' }
		)
		assert.strictEqual(r.status, 1, 'exit 1')
		assert.ok(r.stderr.includes('Marker wrapping mismatch'), 'stderr has wrapping mismatch')
	})

	// TC-05: mismatch — START <p>-wrapped, END bare → exit 1
	it('TC-05: START <p>-wrapped + END bare → exit 1 with wrapping mismatch', () => {
		const r = spawnSync(
			process.execPath,
			[
				'--input-type=module',
				'--eval',
				`
import { injectContent } from "${new URL('./inject.mjs', import.meta.url).pathname}";
injectContent("<p>[AUTO_INSERT_START:overview]</p>\\n<p>old</p>\\n[AUTO_INSERT_END:overview]", "<p>new</p>", "P");
`,
			],
			{ encoding: 'utf8' }
		)
		assert.strictEqual(r.status, 1, 'exit 1')
		assert.ok(r.stderr.includes('Marker wrapping mismatch'), 'stderr has wrapping mismatch')
	})

	// TC-06: START without END → existing error path unchanged
	it('TC-06: START without END → exit 1 with existing error message', () => {
		const r = spawnSync(
			process.execPath,
			[
				'--input-type=module',
				'--eval',
				`
import { injectContent } from "${new URL('./inject.mjs', import.meta.url).pathname}";
injectContent("[AUTO_INSERT_START:overview]\\n<p>content</p>", "<p>new</p>", "P");
`,
			],
			{ encoding: 'utf8' }
		)
		assert.strictEqual(r.status, 1, 'exit 1')
		assert.ok(
			r.stderr.includes('Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END]'),
			'stderr has unpaired error'
		)
	})

	// TC-07: label mismatch → existing error path unchanged
	it('TC-07: label mismatch → exit 1 with label mismatch message', () => {
		const r = spawnSync(
			process.execPath,
			[
				'--input-type=module',
				'--eval',
				`
import { injectContent } from "${new URL('./inject.mjs', import.meta.url).pathname}";
injectContent("[AUTO_INSERT_START:overview]\\n<p>content</p>\\n[AUTO_INSERT_END:summary]", "<p>new</p>", "P");
`,
			],
			{ encoding: 'utf8' }
		)
		assert.strictEqual(r.status, 1, 'exit 1')
		assert.ok(r.stderr.includes('Marker label mismatch'), 'stderr has label mismatch')
		assert.ok(r.stderr.includes('overview'), 'stderr mentions label')
	})
})

// TC-08: no markers → Strategy 3 append
describe('injectContent — strategy 3: replace-all', () => {
	it('replaces full body when replaceAll=true (dryRun=true skips backup)', () => {
		const result = injectContent('<p>existing</p>', '<p>new</p>', 'Test', {
			replaceAll: true,
			dryRun: true,
		})
		assert.strictEqual(result, '<p>new</p>')
	})

	it('replaces full body even when existing body is empty', () => {
		const result = injectContent('', '<p>only</p>', 'Test', { replaceAll: true, dryRun: true })
		assert.strictEqual(result, '<p>only</p>')
	})

	// TC-08: no markers → Strategy 3 append
	it('TC-08: no markers → append content', () => {
		const result = injectContent('<p>existing</p>', '<p>appended</p>', 'Test Page', {
			replaceAll: true,
			dryRun: true,
		})
		assert.strictEqual(result, '<p>appended</p>')
	})
})

// TC-09: Strategy 2 anchor macros — no regression
describe('injectContent — strategy 2: anchor macros', () => {
	const anchorStart =
		'<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">md-start</ac:parameter></ac:structured-macro>'
	const anchorEnd =
		'<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">md-end</ac:parameter></ac:structured-macro>'

	it('replaces content between anchor macros', () => {
		const body = `<p>before</p>${anchorStart}<p>old</p>${anchorEnd}<p>after</p>`
		const result = injectContent(body, '<p>new</p>', 'Test')
		assert.ok(result.includes('<p>new</p>'), 'new content present')
		assert.ok(!result.includes('<p>old</p>'), 'old content removed')
		assert.ok(result.includes('<p>before</p>'), 'before preserved')
		assert.ok(result.includes('<p>after</p>'), 'after preserved')
	})

	it('preserves the anchor macros themselves', () => {
		const body = `${anchorStart}<p>old</p>${anchorEnd}`
		const result = injectContent(body, '<p>new</p>', 'Test')
		assert.ok(result.includes('md-start'), 'start anchor macro preserved')
		assert.ok(result.includes('md-end'), 'end anchor macro preserved')
	})

	// TC-09: Strategy 2 — no regression
	it('TC-09: anchor macros strategy not affected by Strategy 1 changes', () => {
		const body = `<p>header</p>${anchorStart}<p>old content</p>${anchorEnd}<p>footer</p>`
		const result = injectContent(body, '<p>injected</p>', 'TC-09 Page')
		assert.ok(result.includes('<p>injected</p>'), 'new content injected')
		assert.ok(!result.includes('old content'), 'old content removed')
		assert.ok(result.includes('md-start'), 'start anchor preserved')
		assert.ok(result.includes('md-end'), 'end anchor preserved')
		assert.ok(result.includes('<p>header</p>'), 'header preserved')
		assert.ok(result.includes('<p>footer</p>'), 'footer preserved')
	})
})
