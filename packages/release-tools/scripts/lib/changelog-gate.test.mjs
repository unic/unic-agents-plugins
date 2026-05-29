#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateBumpGate, GUARDED, isBumpRequired } from './changelog-gate.mjs'

describe('isBumpRequired', () => {
	it('returns false for empty list', () => {
		assert.equal(isBumpRequired([], GUARDED), false)
	})

	it('triggers on commands/*.md', () => {
		assert.equal(isBumpRequired(['commands/review-pr.md'], GUARDED), true)
	})

	it('triggers on scripts/*.mjs', () => {
		assert.equal(isBumpRequired(['scripts/verify.mjs'], GUARDED), true)
	})

	it('triggers on .claude-plugin/plugin.json', () => {
		assert.equal(isBumpRequired(['.claude-plugin/plugin.json'], GUARDED), true)
	})

	it('triggers on .claude-plugin/marketplace.json', () => {
		assert.equal(isBumpRequired(['.claude-plugin/marketplace.json'], GUARDED), true)
	})

	it('triggers on CLAUDE.md', () => {
		assert.equal(isBumpRequired(['CLAUDE.md'], GUARDED), true)
	})

	it('triggers on README.md', () => {
		assert.equal(isBumpRequired(['README.md'], GUARDED), true)
	})

	it('does not trigger on tests/*.test.mjs', () => {
		assert.equal(isBumpRequired(['tests/foo.test.mjs'], GUARDED), false)
	})

	it('does not trigger on docs/adr/*.md', () => {
		assert.equal(isBumpRequired(['docs/adr/0001-something.md'], GUARDED), false)
	})

	it('does not trigger on package.json', () => {
		assert.equal(isBumpRequired(['package.json'], GUARDED), false)
	})

	it('does not trigger on arbitrary md outside commands/', () => {
		assert.equal(isBumpRequired(['some-dir/notes.md'], GUARDED), false)
	})
})

describe('evaluateBumpGate', () => {
	const baseChangelog = ['## [1.1.0] — 2026-05-01', '', '### Added', '- real bullet entry'].join('\n')

	it('returns ok with no-guarded-change when no guarded files changed', () => {
		const v = evaluateBumpGate({
			changedFiles: ['tests/foo.test.mjs'],
			guardedPatterns: GUARDED,
			headVersion: '1.0.0',
			baseVersion: '1.0.0',
			changelog: '',
		})
		assert.equal(v.ok, true)
		assert.equal(v.code, 'no-guarded-change')
	})

	it('returns version-unchanged when guarded file changed but version same', () => {
		const v = evaluateBumpGate({
			changedFiles: ['commands/review-pr.md'],
			guardedPatterns: GUARDED,
			headVersion: '1.0.0',
			baseVersion: '1.0.0',
			changelog: '',
		})
		assert.equal(v.ok, false)
		assert.equal(v.code, 'version-unchanged')
		assert.ok(v.message.includes('version in plugin.json was not bumped'))
		assert.ok(v.message.includes('pnpm bump'))
	})

	it('returns no-changelog-entry when bumped but no section exists', () => {
		const v = evaluateBumpGate({
			changedFiles: ['commands/review-pr.md'],
			guardedPatterns: GUARDED,
			headVersion: '1.1.0',
			baseVersion: '1.0.0',
			changelog: '## [1.0.0] — 2026-01-01\n- old entry',
		})
		assert.equal(v.ok, false)
		assert.equal(v.code, 'no-changelog-entry')
		assert.ok(v.message.includes('no entry for version 1.1.0'))
	})

	it('returns no-real-entries when section exists but only (none) bullets', () => {
		const cl = '## [1.1.0] — 2026-05-01\n\n### Added\n- (none)'
		const v = evaluateBumpGate({
			changedFiles: ['commands/review-pr.md'],
			guardedPatterns: GUARDED,
			headVersion: '1.1.0',
			baseVersion: '1.0.0',
			changelog: cl,
		})
		assert.equal(v.ok, false)
		assert.equal(v.code, 'no-real-entries')
		assert.ok(v.message.includes('only "(none)" placeholders'))
	})

	it('returns ok when bumped and real changelog bullet exists', () => {
		const v = evaluateBumpGate({
			changedFiles: ['commands/review-pr.md'],
			guardedPatterns: GUARDED,
			headVersion: '1.1.0',
			baseVersion: '1.0.0',
			changelog: baseChangelog,
		})
		assert.equal(v.ok, true)
		assert.equal(v.code, 'ok')
		assert.ok(v.message.includes('1.0.0 → 1.1.0'))
	})

	it('treats empty baseVersion as newly introduced plugin (version check passes)', () => {
		const cl = '## [1.0.0] — 2026-05-29\n\n### Added\n- initial release'
		const v = evaluateBumpGate({
			changedFiles: ['commands/setup.md'],
			guardedPatterns: GUARDED,
			headVersion: '1.0.0',
			baseVersion: '',
			changelog: cl,
		})
		assert.equal(v.ok, true)
		assert.equal(v.code, 'ok')
	})
})
