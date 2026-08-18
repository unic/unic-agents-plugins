// @ts-check

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { METHODS_MANIFEST } from '../lib/methods-manifest.mjs'

/**
 * The Boxes hold to the manifest.
 *
 * `test/methods-manifest.test.mjs` closes the loop on the Methods' own text; nothing closed it on the
 * command prose that reads them. That is how the upstream v1.1.0 rename wave shipped green: `to-prd`
 * → `to-spec`, `to-issues` → `to-tickets` and `grill-with-docs` dissolving into `grilling` +
 * `domain-modeling` left four commands naming Methods that no longer exist, and only a reader could
 * have caught it.
 *
 * Every assertion here is a dumb string check on purpose, in the same style as the closure test: a
 * clever parser would have failure modes of its own, and these files are prompts, not code.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

/** Derived with `resolve`, never a path literal — the Windows CI runner's cwd is on `D:`. */
const BUNDLE_ROOT = resolve(PLUGIN_ROOT, 'vendor', 'mattpocock-skills')

/** The four interactive Boxes rewired onto `resolveMethod` in #280. */
const BOXES = /** @type {const} */ (['specs', 'tickets', 'triage', 'improve-architecture'])

/**
 * Every slash-command this Plugin ships. A Box naming a sibling Box is not naming a Method, and
 * without this set every `` `/build` `` in the prose would read as an unresolved Method reference.
 */
const BOX_NAMES = new Set([
	'setup',
	'specs',
	'tickets',
	'triage',
	'build',
	'pr-review',
	'qa',
	'explore',
	'improve-architecture',
	'cleanup',
	'handoff',
])

/**
 * Slash-tokens that are deliberately neither a Method nor a Box.
 *
 * `setup-matt-pocock-skills` is named only to forbid it: the Methods carry a "run it if the label
 * vocabulary is missing" fallback that the DLC replaces with its own config ([ADR-0024]).
 */
const KNOWN_EXTERNAL_TOKENS = new Set(['setup-matt-pocock-skills'])

/**
 * Markdown files the Harness itself owns or names, as opposed to a Method's sub-files.
 *
 * Anything outside this set and outside the manifest's `subFiles` is an unresolved reference — which
 * is what catches a path into a sub-file upstream deleted (`INTERFACE-DESIGN.md`, `LANGUAGE.md`).
 */
const HARNESS_DOCS = new Set([
	'CONTEXT.md',
	'CONTEXT-MAP.md',
	'PRD.md',
	'README.md',
	'SKILL.md',
	'docs/adr/README.md',
	'report.md',
	'arch-review.md',
	'findings.md',
	// The local publishing shape `to-tickets` offers, named only to forbid, and the scratch PR-body
	// file every staging rule denies by name (#289 AC 4).
	'tickets.md',
	'pr-body.md',
	// This repository's own tracker contract (#389), which every Box reads. Both spellings: prose
	// names the full path once per block and the basename thereafter, and this reader sees each.
	'docs/agents/issue-tracker.md',
	'docs/agents/triage-labels.md',
	'issue-tracker.md',
	'triage-labels.md',
])

/** Every backtick-wrapped, slash-prefixed token — `` `/build` ``, `` `/implement` ``. */
const SLASH_TOKEN = /`\/([a-z][a-z0-9-]*)`/g

/** Every backtick-wrapped Markdown filename or path — `` `CONTEXT.md` ``, `` `docs/adr/README.md` ``. */
const MD_TOKEN = /`([A-Za-z][A-Za-z0-9._/-]*\.md)`/g

/** The one-line `wanted` array each Box passes to `resolveMethod`. Kept on one line so this parses. */
const WANTED_ARRAY = /const wanted = \[([^\]\n]*)\]/

const CANONICAL_NAMES = new Set(METHODS_MANIFEST.map((entry) => entry.name))
const ALL_ALIASES = new Set(METHODS_MANIFEST.flatMap((entry) => [...entry.aliases]))

/**
 * @param {string} box
 * @returns {string}
 */
function readBox(box) {
	return readFileSync(join(PLUGIN_ROOT, 'commands', `${box}.md`), 'utf8')
}

/**
 * The Methods a Box declares it reads, parsed out of its `resolveMethod` call.
 * @param {string} box
 * @returns {string[]}
 */
function wantedMethods(box) {
	const match = readBox(box).match(WANTED_ARRAY)
	assert.ok(match, `commands/${box}.md must declare a single-line "const wanted = [...]" for resolveMethod`)
	return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** Method name → the sub-files it declares. */
const SUB_FILES_BY_METHOD = new Map(METHODS_MANIFEST.map((entry) => [entry.name, [...entry.subFiles]]))

for (const box of BOXES) {
	test(`commands/${box}.md names no Method that upstream renamed away`, () => {
		// An alias is a *failure*, not a pass. `resolveAlias` keeps `to-prd` working for a config file
		// written before the rename; command prose has no such excuse, and a Box left naming the old
		// name is exactly the defect #280 exists to fix.
		for (const [, token] of readBox(box).matchAll(SLASH_TOKEN)) {
			if (BOX_NAMES.has(token) || KNOWN_EXTERNAL_TOKENS.has(token)) continue
			assert.ok(
				!ALL_ALIASES.has(token),
				`commands/${box}.md names \`/${token}\`, which is a pre-v1.1.0 alias — use the canonical Method name`
			)
			assert.ok(
				CANONICAL_NAMES.has(token),
				`commands/${box}.md names \`/${token}\`, which is not a Method, a Box, or an audited external reference`
			)
		}
	})

	test(`commands/${box}.md cites only sub-files that exist, on Methods it reads`, () => {
		const reads = new Set(wantedMethods(box))
		const declaredHere = new Map(
			[...SUB_FILES_BY_METHOD].flatMap(([method, files]) => files.map((file) => [file, method]))
		)

		for (const [, token] of readBox(box).matchAll(MD_TOKEN)) {
			if (HARNESS_DOCS.has(token)) continue
			const owner = declaredHere.get(token)
			assert.ok(
				owner,
				`commands/${box}.md cites \`${token}\`, which no Method declares as a sub-file — upstream may have moved or deleted it`
			)
			assert.ok(
				reads.has(owner),
				`commands/${box}.md cites \`${token}\`, a sub-file of "${owner}" — a Method this Box does not resolve`
			)
			const entry = METHODS_MANIFEST.find((e) => e.name === owner)
			const onDisk = join(dirname(resolve(BUNDLE_ROOT, /** @type {string} */ (entry?.upstreamPath))), token)
			assert.ok(existsSync(onDisk), `commands/${box}.md cites \`${token}\`, which is not in the vendored bundle`)
		}
	})

	test(`commands/${box}.md hardcodes no path into a Method's directory`, () => {
		// Every Method path now comes from `resolveMethod`, so that a config-tier or `.local` override
		// is honoured. A literal `.agents/skills/triage/SKILL.md` — which is what `/triage` carried —
		// silently pins the Box to one tier and to a directory this Plugin does not own.
		const contents = readBox(box)
		assert.ok(
			!contents.includes('.agents/skills'),
			`commands/${box}.md points at .agents/skills — read the Method through resolveMethod instead`
		)
		for (const name of CANONICAL_NAMES) {
			assert.ok(
				!contents.includes(`${name}/`),
				`commands/${box}.md hardcodes a path under "${name}/" — resolve the Method and read its returned path`
			)
		}
	})

	test(`commands/${box}.md resolves through the resolver and logs the tier`, () => {
		const contents = readBox(box)
		assert.match(
			contents,
			/methods-resolver\.mjs/,
			`commands/${box}.md must import lib/methods-resolver.mjs to resolve its Methods`
		)
		assert.match(contents, /resolveMethod\(/, `commands/${box}.md must call resolveMethod rather than assuming a path`)
		// The tier line is the whole diagnosability story: a Method resolving from an unexpected tier
		// is otherwise invisible, which is how a stale `.archon/methods.local/` override wins silently.
		assert.match(
			contents,
			/^methods: /m,
			`commands/${box}.md must print a "methods: <name>(<tier>)" line so a surprising tier is visible`
		)
	})

	test(`commands/${box}.md carries no trace of the retired matt_suite probe`, () => {
		const contents = readBox(box)
		assert.ok(!contents.includes('MATT_SUITE'), `commands/${box}.md still reads MATT_SUITE`)
		assert.ok(!contents.includes('matt_suite'), `commands/${box}.md still references skills.matt_suite`)
	})
}

test('every Box resolves exactly the Methods the manifest says it reads', () => {
	// Asserted in both directions. One way alone lets the pair drift: a Box could quietly stop reading
	// a Method while `providedTo` — and the generated README table with it — kept claiming it does.
	for (const box of BOXES) {
		const declared = wantedMethods(box)
		const fromManifest = METHODS_MANIFEST.filter((entry) => entry.providedTo.includes(box)).map((entry) => entry.name)

		assert.deepEqual(
			[...declared].sort(),
			[...fromManifest].sort(),
			`commands/${box}.md resolves [${declared}] but the manifest's providedTo says [${fromManifest}]`
		)
	}
})
