// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AGENT_DOC_BANNER, prependBanner, SKILLS_BLOCK_BANNER } from '../lib/dogfood-banner.mjs'

test('AGENT_DOC_BANNER contains AUTO-GENERATED signal', () => {
	assert.ok(AGENT_DOC_BANNER.includes('AUTO-GENERATED'), 'AGENT_DOC_BANNER must say AUTO-GENERATED')
})

test('AGENT_DOC_BANNER references the source module', () => {
	assert.ok(AGENT_DOC_BANNER.includes('agent-docs-writer.mjs'), 'AGENT_DOC_BANNER must name the source module')
})

test('AGENT_DOC_BANNER contains the regenerate hint', () => {
	assert.ok(
		AGENT_DOC_BANNER.includes('/unic-archon-dlc-setup') || AGENT_DOC_BANNER.includes('setup'),
		'AGENT_DOC_BANNER must mention how to regenerate'
	)
})

test('SKILLS_BLOCK_BANNER contains AUTO-GENERATED signal', () => {
	assert.ok(SKILLS_BLOCK_BANNER.includes('AUTO-GENERATED'), 'SKILLS_BLOCK_BANNER must say AUTO-GENERATED')
})

test('SKILLS_BLOCK_BANNER contains the regenerate hint', () => {
	assert.ok(SKILLS_BLOCK_BANNER.includes('setup'), 'SKILLS_BLOCK_BANNER must mention regeneration via setup')
})

test('prependBanner joins banner + blank line + body', () => {
	const result = prependBanner('<!-- banner -->', '# Title\n\nBody.')
	assert.ok(result.startsWith('<!-- banner -->'), 'should start with banner')
	assert.ok(result.includes('\n\n'), 'should have blank line separator')
	assert.ok(result.includes('# Title'), 'should include body')
})

test('prependBanner works when body already ends with newline', () => {
	const result = prependBanner('<!-- banner -->', '# Title\n')
	assert.ok(result.startsWith('<!-- banner -->'), 'should start with banner')
	assert.ok(result.includes('# Title'), 'should include body')
	// Exactly one blank-line between banner and body
	assert.match(result, /<!-- banner -->\n\n# Title/)
})

test('prependBanner with empty body returns just the banner', () => {
	const result = prependBanner('<!-- banner -->', '')
	assert.equal(result.trim(), '<!-- banner -->', 'empty body should return just the banner')
})
