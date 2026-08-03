// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { findMethod, METHODS_MANIFEST, resolveAlias } from '../lib/methods-manifest.mjs'

/** Every backtick-wrapped, slash-prefixed token in a `SKILL.md` — `` `/grilling` ``, `` `/tmp` ``. */
const SLASH_TOKEN = /`\/([a-z][a-z0-9-]*)`/g

/**
 * Read a Method's pinned v1.1.0 fixture. These are point-in-time snapshots of an external repo, so
 * the closure test below stays deterministic and offline; issue #284 replaces them with the real
 * vendored bundle.
 * @param {string} name
 * @returns {string}
 */
function readFixture(name) {
	return readFileSync(new URL(`./fixtures/methods/${name}/SKILL.md`, import.meta.url), 'utf8')
}

test('every manifest entry has the required shape', () => {
	assert.ok(METHODS_MANIFEST.length > 0, 'manifest must not be empty')
	for (const entry of METHODS_MANIFEST) {
		assert.ok(entry.name.length > 0, 'name must be non-empty')
		assert.ok(entry.upstreamPath.endsWith('/SKILL.md'), `${entry.name}: upstreamPath must point at a SKILL.md`)
		assert.ok(Array.isArray(entry.aliases), `${entry.name}: aliases must be an array`)
		assert.ok(Array.isArray(entry.providedTo), `${entry.name}: providedTo must be an array`)
		assert.ok(Array.isArray(entry.knownExternalRefs), `${entry.name}: knownExternalRefs must be an array`)
	}
})

test('no two entries share a name, and no alias is ambiguous', () => {
	const names = METHODS_MANIFEST.map((entry) => entry.name)
	assert.equal(new Set(names).size, names.length, 'canonical names must be unique')

	const seenAliases = new Set()
	for (const entry of METHODS_MANIFEST) {
		for (const alias of entry.aliases) {
			assert.ok(!names.includes(alias), `alias "${alias}" collides with a canonical Method name`)
			assert.ok(!seenAliases.has(alias), `alias "${alias}" is claimed by more than one Method`)
			seenAliases.add(alias)
		}
	}
})

test('resolveAlias maps to-prd to to-spec', () => {
	assert.equal(resolveAlias('to-prd'), 'to-spec')
})

test('resolveAlias maps to-issues to to-tickets', () => {
	assert.equal(resolveAlias('to-issues'), 'to-tickets')
})

test('resolveAlias maps review to code-review', () => {
	assert.equal(resolveAlias('review'), 'code-review')
})

test('resolveAlias passes through canonical and unknown names unchanged', () => {
	assert.equal(resolveAlias('tdd'), 'tdd')
	assert.equal(resolveAlias('no-such-method'), 'no-such-method')
})

test('resolveAlias is case-sensitive — a near-miss must not resolve', () => {
	assert.equal(resolveAlias('To-PRD'), 'To-PRD')
	assert.equal(findMethod('To-PRD'), undefined)
})

test('findMethod resolves by canonical name and by alias', () => {
	assert.equal(findMethod('to-spec')?.name, 'to-spec')
	assert.equal(findMethod('to-prd')?.name, 'to-spec')
	assert.equal(findMethod('no-such-method'), undefined)
})

test('every cross-reference in the v1.1.0 skills resolves to the manifest', () => {
	const canonicalNames = new Set(METHODS_MANIFEST.map((entry) => entry.name))
	const allAliases = new Set(METHODS_MANIFEST.flatMap((entry) => [...entry.aliases]))

	for (const entry of METHODS_MANIFEST) {
		const known = new Set(entry.knownExternalRefs)
		for (const [, token] of readFixture(entry.name).matchAll(SLASH_TOKEN)) {
			assert.ok(
				canonicalNames.has(token) || allAliases.has(token) || known.has(token),
				`${entry.name} references \`/${token}\`, which is not a manifest name, a manifest alias, or one of its knownExternalRefs`
			)
		}
	}
})

test('the closure check actually reads content — the referencing fixtures are not empty', () => {
	// Guards against the closure test silently passing on missing or truncated fixtures.
	for (const name of ['to-spec', 'to-tickets', 'triage', 'improve-codebase-architecture', 'code-review']) {
		const tokens = [...readFixture(name).matchAll(SLASH_TOKEN)]
		assert.ok(tokens.length > 0, `${name} fixture should contain at least one \`/token\` cross-reference`)
	}
})
