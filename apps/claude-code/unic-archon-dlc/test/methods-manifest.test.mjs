// @ts-check

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { findMethod, METHODS_BUNDLE, METHODS_MANIFEST, resolveAlias } from '../lib/methods-manifest.mjs'

/** Every backtick-wrapped, slash-prefixed token in a `SKILL.md` — `` `/grilling` ``, `` `/tmp` ``. */
const SLASH_TOKEN = /`\/([a-z][a-z0-9-]*)`/g

/**
 * The vendored bundle. Derived from `resolve`, never a path literal: the Windows CI runner's cwd is
 * on `D:`, so a hand-counted separator would fail there and nowhere else.
 */
const BUNDLE_ROOT = resolve(import.meta.dirname, '..', 'vendor', 'mattpocock-skills')

/**
 * Read every Markdown file a Method ships — `SKILL.md` plus its sub-files — from the vendored bundle
 * at `METHODS_BUNDLE.tag`, resolved through the entry's own `upstreamPath`.
 *
 * Reading the real bundle rather than a pinned test copy is the point: with two copies of the same
 * upstream text, a bundle bumped to a later tag would keep passing against stale fixtures, which is
 * the exact drift this closure test exists to catch.
 *
 * @param {import('../lib/methods-manifest.mjs').MethodEntry} entry
 * @returns {string}
 */
function readMethodDocs(entry) {
	const methodDir = dirname(resolve(BUNDLE_ROOT, entry.upstreamPath))
	return readdirSync(methodDir)
		.filter((file) => file.endsWith('.md'))
		.map((file) => readFileSync(join(methodDir, file), 'utf8'))
		.join('\n')
}

test('every manifest entry has the required shape', () => {
	assert.ok(METHODS_MANIFEST.length > 0, 'manifest must not be empty')
	for (const entry of METHODS_MANIFEST) {
		assert.ok(entry.name.length > 0, 'name must be non-empty')
		assert.ok(entry.upstreamPath.endsWith('/SKILL.md'), `${entry.name}: upstreamPath must point at a SKILL.md`)
		assert.ok(Array.isArray(entry.subFiles), `${entry.name}: subFiles must be an array`)
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
		for (const [, token] of readMethodDocs(entry).matchAll(SLASH_TOKEN)) {
			assert.ok(
				canonicalNames.has(token) || allAliases.has(token) || known.has(token),
				`${entry.name} references \`/${token}\`, which is not a manifest name, a manifest alias, or one of its knownExternalRefs`
			)
		}
	}
})

test('every Method is reviewed for cross-reference content — none are vacuously empty for the closure test', () => {
	// Guards against the closure test silently passing on a missing or truncated vendored file, for
	// every manifest entry — not just the ones already known to have cross-references.
	const expectedNonEmpty = new Set(['to-spec', 'to-tickets', 'triage', 'improve-codebase-architecture', 'code-review'])

	for (const entry of METHODS_MANIFEST) {
		const tokens = [...readMethodDocs(entry).matchAll(SLASH_TOKEN)]
		if (expectedNonEmpty.has(entry.name)) {
			assert.ok(tokens.length > 0, `${entry.name} should contain at least one \`/token\` cross-reference`)
		} else {
			assert.equal(
				tokens.length,
				0,
				`${entry.name} unexpectedly gained cross-references — add it to expectedNonEmpty and verify the closure test covers it`
			)
		}
	}
})

test('the closure scan covers a Method sub-file, not just its SKILL.md', () => {
	// `improve-codebase-architecture/HTML-REPORT.md` cites `/codebase-design` and `triage/AGENT-BRIEF.md`
	// cites `/triage`; scanning only `SKILL.md` would leave both unchecked.
	const docs = readMethodDocs(/** @type {import('../lib/methods-manifest.mjs').MethodEntry} */ (findMethod('triage')))

	assert.match(docs, /Agent Brief/i, 'AGENT-BRIEF.md should be part of the scanned text')
})

test('every manifest entry declares exactly the Markdown files vendored for it', () => {
	// `verifyBundle` checks the declared files exist; this checks the declaration itself is complete.
	// Without it a re-vendor could ADD an upstream sub-file that nothing records — the bundle would
	// ship a file no manifest entry knows about, and `installMethods` would copy it silently.
	for (const entry of METHODS_MANIFEST) {
		const methodDir = dirname(resolve(BUNDLE_ROOT, entry.upstreamPath))
		const onDisk = readdirSync(methodDir)
			.filter((file) => file.endsWith('.md'))
			.sort()
		const declared = [basename(entry.upstreamPath), ...entry.subFiles].sort()

		assert.deepEqual(
			onDisk,
			declared,
			`${entry.name}: the vendored directory and its \`subFiles\` disagree — reconcile the manifest with what was vendored at ${METHODS_BUNDLE.tag}`
		)
	}
})

test('the vendor README quotes the same tag and commit as METHODS_BUNDLE', () => {
	// D2: the constant is the source of truth and the README is its human mirror. Without this, a
	// re-vendor can bump one and leave the other asserting a version that is no longer on disk.
	const readme = readFileSync(join(BUNDLE_ROOT, 'README.md'), 'utf8')

	assert.ok(readme.includes(METHODS_BUNDLE.tag), `README must quote the bundled tag ${METHODS_BUNDLE.tag}`)
	assert.ok(readme.includes(METHODS_BUNDLE.commit), `README must quote the bundled commit ${METHODS_BUNDLE.commit}`)
	assert.ok(readme.includes(METHODS_BUNDLE.repo), `README must name the source repo ${METHODS_BUNDLE.repo}`)
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
			`a Method references \`/${fakeToken}\`, which is not a manifest name, a manifest alias, or one of its knownExternalRefs`
		)
	}, /not a manifest name/)
})
