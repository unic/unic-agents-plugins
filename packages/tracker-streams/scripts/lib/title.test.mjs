#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shortenTitle } from './title.mjs'

describe('shortenTitle', () => {
	it('strips a type(scope) prefix', () => {
		assert.equal(shortenTitle('feat(repo): publish a generated streams page'), 'publish a generated streams page')
	})

	it('strips a bare type prefix', () => {
		assert.equal(shortenTitle('stream: de-dogfood follow-ups'), 'de-dogfood follow-ups')
	})

	it('strips a breaking-change marker', () => {
		assert.equal(shortenTitle('refactor(unic-archon-dlc)!: drop the legacy resolver'), 'drop the legacy resolver')
	})

	it('leaves a title with no prefix unchanged', () => {
		assert.equal(shortenTitle('publish a generated streams page'), 'publish a generated streams page')
	})

	it('leaves a capitalised sentence with a colon unchanged', () => {
		assert.equal(shortenTitle('Blocked: the resolver never returns'), 'Blocked: the resolver never returns')
	})

	it('strips only the first prefix segment', () => {
		assert.equal(shortenTitle('fix(repo): docs: correct the table'), 'docs: correct the table')
	})

	it('returns the original title when the prefix is all there is', () => {
		assert.equal(shortenTitle('chore: '), 'chore:')
	})

	it('trims surrounding whitespace', () => {
		assert.equal(shortenTitle('  docs: tidy the map  '), 'tidy the map')
	})
})
