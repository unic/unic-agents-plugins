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

test('every fixture is reviewed for cross-reference content — none are vacuously empty for the closure test', () => {
	// Guards against the closure test silently passing on missing or truncated fixtures, for every
	// manifest entry — not just the ones already known to have cross-references.
	const expectedNonEmpty = new Set(['to-spec', 'to-tickets', 'triage', 'improve-codebase-architecture', 'code-review'])

	for (const entry of METHODS_MANIFEST) {
		const tokens = [...readFixture(entry.name).matchAll(SLASH_TOKEN)]
		if (expectedNonEmpty.has(entry.name)) {
			assert.ok(tokens.length > 0, `${entry.name} fixture should contain at least one \`/token\` cross-reference`)
		} else {
			assert.equal(
				tokens.length,
				0,
				`${entry.name} fixture unexpectedly gained cross-references — add it to expectedNonEmpty and verify the closure test covers it`
			)
		}
	}
})

test('providedTo is empty only for Methods whose Box has not shipped yet', () => {
	// #285 generates the documented dependency list from `providedTo`, so an entry left empty by
	// accident understates the docs — the divergence the manifest exists to end. This allowlist is the
	// only sanctioned reason to be empty: the Box arrives in a later slice (#281, #276).
	const boxNotShippedYet = new Set(['implement', 'tdd', 'research'])

	for (const entry of METHODS_MANIFEST) {
		if (boxNotShippedYet.has(entry.name)) continue
		assert.ok(
			entry.providedTo.length > 0,
			`${entry.name}: providedTo is empty — name the Boxes that read it, or add it to boxNotShippedYet with a reason`
		)
	}
})

test('the Methods composed by the current command prose record their Box callers', () => {
	// Sourced from the shipped commands: `commands/specs.md` (`/grill-with-docs` runs `/grilling` +
	// `/domain-modeling`), `commands/triage.md` (same pair declared), and
	// `commands/improve-architecture.md` (`/codebase-design` + `/grilling` + `/domain-modeling`).
	const expected = {
		grilling: ['specs', 'triage', 'improve-architecture'],
		'domain-modeling': ['specs', 'triage', 'improve-architecture'],
		'codebase-design': ['improve-architecture'],
	}

	for (const [name, boxes] of Object.entries(expected)) {
		assert.deepEqual(
			[...(findMethod(name)?.providedTo ?? [])],
			boxes,
			`${name}: providedTo must match the command prose`
		)
	}
})

test('the closure assertion actually fails on an unresolved cross-reference', () => {
	const canonicalNames = new Set(METHODS_MANIFEST.map((entry) => entry.name))
	const allAliases = new Set(METHODS_MANIFEST.flatMap((entry) => [...entry.aliases]))
	const known = new Set()
	const fakeToken = 'definitely-not-a-real-method'

	assert.throws(() => {
		assert.ok(
			canonicalNames.has(fakeToken) || allAliases.has(fakeToken) || known.has(fakeToken),
			`fixture references \`/${fakeToken}\`, which is not a manifest name, a manifest alias, or one of its knownExternalRefs`
		)
	}, /not a manifest name/)
})
