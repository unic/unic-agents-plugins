// @ts-check

/**
 * The Method manifest — one entry per Matt Pocock skill this Plugin's Boxes compose.
 *
 * Vocabulary (CONTEXT.md): the **Harness** hosts **Methods**; a **Box** reads a Method by name.
 * Before this module, a Method name appeared as a hardcoded string in `commands/setup.md`,
 * `commands/specs.md` and `commands/tickets.md` at once, with nothing tying the three together —
 * so the upstream v1.1.0 rename wave broke them silently. This file is the one place a Method name
 * exists as data; the closure test in `test/methods-manifest.test.mjs` turns the next upstream
 * rename or content relocation into a test failure instead of a production no-op.
 *
 * Paths are pinned to upstream tag `v1.1.0`, and {@link METHODS_BUNDLE} below records the exact
 * commit those paths were vendored from. The files themselves live in
 * `vendor/mattpocock-skills/skills/`, keyed by `upstreamPath`.
 */

/**
 * Provenance of the vendored Method bundle.
 *
 * A frozen code constant rather than a `provenance.json` inside the bundle: `/setup` needs the tag
 * and the licence hash programmatically, a constant typechecks and has no parse-failure branch, and
 * keeping it here forces a re-vendor to touch the same file that defines the closure — which is
 * where an upstream path change has to be reconciled anyway. `vendor/mattpocock-skills/README.md`
 * is the human mirror; a test asserts it quotes the same `tag` and `commit`.
 *
 * @type {Readonly<{ repo: string, tag: string, commit: string, licence: string, licenceSha256: string }>}
 */
export const METHODS_BUNDLE = Object.freeze({
	repo: 'mattpocock/skills',
	tag: 'v1.1.0',
	commit: 'd574778f94cf620fcc8ce741584093bc650a61d3',
	licence: 'MIT',
	licenceSha256: '0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5',
})

/**
 * @typedef {Object} MethodEntry
 * @property {string} name - canonical Method name; also the on-disk directory under `.archon/methods/`
 * @property {string} upstreamPath - path within `mattpocock/skills` at tag v1.1.0
 * @property {readonly string[]} subFiles - the Method's other files, as names relative to the
 *   directory holding its `SKILL.md`. Declared rather than discovered: `verifyBundle` checks them,
 *   so a re-vendor that drops one fails instead of installing a Method the Boxes read half of
 * @property {readonly string[]} aliases - pre-v1.1.0 names that must keep resolving to `name`
 * @property {readonly string[]} providedTo - Boxes that read this Method directly; empty means
 *   transitive-only (pulled in by another Method's own composition, no direct Box caller yet)
 * @property {readonly string[]} knownExternalRefs - slash-tokens this Method's `SKILL.md` mentions
 *   that are deliberately outside the manifest, so the closure test can tell "expected external"
 *   from "unresolved reference"
 */

/**
 * Every composed Method, in main-line-then-transitive order.
 *
 * `providedTo: []` is meaningful, not an oversight: those Methods have no Box caller **yet** — their
 * Boxes arrive with the rewiring slices (`implement` and `tdd` in #281, `research` in #276). Note the
 * distinction: `grilling`, `domain-modeling` and `codebase-design` are named as declared dependencies
 * in the current command prose (`commands/specs.md`, `commands/triage.md`,
 * `commands/improve-architecture.md`), so they carry real Boxes today even though a Method also
 * composes them transitively. `providedTo` records direct Box callers, and #285 generates the
 * documented dependency list from it — an entry left empty here understates the docs.
 *
 * `knownExternalRefs` entries are audited, not guessed:
 *   - `setup-matt-pocock-skills` is intentionally **not** a Method. Bundling it would double-install
 *     a setup skill that this Plugin's own `/setup` replaces (AGENTS.md: "Consequently
 *     `setup-matt-pocock-skills` is **not** a Plugin dependency").
 *   - `tmp` is the OS temp directory in prose, not a skill reference. It is allowlisted per-entry
 *     rather than special-cased in the closure test's regex, so that test stays a dumb, auditable
 *     string check.
 *
 * @type {readonly MethodEntry[]}
 */
export const METHODS_MANIFEST = /** @type {readonly MethodEntry[]} */ (
	Object.freeze([
		Object.freeze({
			name: 'to-spec',
			upstreamPath: 'skills/engineering/to-spec/SKILL.md',
			subFiles: Object.freeze([]),
			aliases: Object.freeze(['to-prd']),
			providedTo: Object.freeze(['specs']),
			knownExternalRefs: Object.freeze(['setup-matt-pocock-skills']),
		}),
		Object.freeze({
			name: 'to-tickets',
			upstreamPath: 'skills/engineering/to-tickets/SKILL.md',
			subFiles: Object.freeze([]),
			aliases: Object.freeze(['to-issues']),
			providedTo: Object.freeze(['tickets']),
			knownExternalRefs: Object.freeze(['setup-matt-pocock-skills']),
		}),
		Object.freeze({
			name: 'triage',
			upstreamPath: 'skills/engineering/triage/SKILL.md',
			subFiles: Object.freeze(['AGENT-BRIEF.md', 'OUT-OF-SCOPE.md']),
			aliases: Object.freeze([]),
			providedTo: Object.freeze(['triage']),
			knownExternalRefs: Object.freeze(['setup-matt-pocock-skills']),
		}),
		Object.freeze({
			name: 'code-review',
			upstreamPath: 'skills/engineering/code-review/SKILL.md',
			subFiles: Object.freeze([]),
			aliases: Object.freeze(['review']),
			providedTo: Object.freeze(['pr-review']),
			knownExternalRefs: Object.freeze(['setup-matt-pocock-skills']),
		}),
		Object.freeze({
			name: 'improve-codebase-architecture',
			upstreamPath: 'skills/engineering/improve-codebase-architecture/SKILL.md',
			subFiles: Object.freeze(['HTML-REPORT.md']),
			aliases: Object.freeze([]),
			providedTo: Object.freeze(['improve-architecture']),
			knownExternalRefs: Object.freeze(['tmp']),
		}),
		Object.freeze({
			name: 'implement',
			upstreamPath: 'skills/engineering/implement/SKILL.md',
			subFiles: Object.freeze([]),
			aliases: Object.freeze([]),
			providedTo: Object.freeze([]),
			knownExternalRefs: Object.freeze([]),
		}),
		Object.freeze({
			name: 'tdd',
			upstreamPath: 'skills/engineering/tdd/SKILL.md',
			subFiles: Object.freeze(['mocking.md', 'tests.md']),
			aliases: Object.freeze([]),
			providedTo: Object.freeze([]),
			knownExternalRefs: Object.freeze([]),
		}),
		Object.freeze({
			name: 'research',
			upstreamPath: 'skills/engineering/research/SKILL.md',
			subFiles: Object.freeze([]),
			aliases: Object.freeze([]),
			providedTo: Object.freeze([]),
			knownExternalRefs: Object.freeze([]),
		}),
		Object.freeze({
			name: 'grilling',
			upstreamPath: 'skills/productivity/grilling/SKILL.md',
			subFiles: Object.freeze([]),
			aliases: Object.freeze([]),
			providedTo: Object.freeze(['specs', 'triage', 'improve-architecture']),
			knownExternalRefs: Object.freeze([]),
		}),
		Object.freeze({
			name: 'domain-modeling',
			upstreamPath: 'skills/engineering/domain-modeling/SKILL.md',
			subFiles: Object.freeze(['ADR-FORMAT.md', 'CONTEXT-FORMAT.md']),
			aliases: Object.freeze([]),
			providedTo: Object.freeze(['specs', 'triage', 'improve-architecture']),
			knownExternalRefs: Object.freeze([]),
		}),
		Object.freeze({
			name: 'codebase-design',
			upstreamPath: 'skills/engineering/codebase-design/SKILL.md',
			subFiles: Object.freeze(['DEEPENING.md', 'DESIGN-IT-TWICE.md']),
			aliases: Object.freeze([]),
			providedTo: Object.freeze(['improve-architecture']),
			knownExternalRefs: Object.freeze([]),
		}),
	])
)

/**
 * Map a possibly-legacy Method name to its canonical manifest name.
 *
 * Exact, case-sensitive match only — a fuzzy match here would resolve a typo to a real Method and
 * hide exactly the class of failure this manifest exists to surface. An unknown name is returned
 * unchanged; callers decide whether that is an error (see `findMethod`).
 *
 * @param {string} name
 * @returns {string}
 */
export function resolveAlias(name) {
	for (const entry of METHODS_MANIFEST) {
		if (entry.name === name) return entry.name
		if (entry.aliases.includes(name)) return entry.name
	}
	return name
}

/**
 * Look up a Method entry by canonical name or legacy alias.
 * @param {string} name
 * @returns {MethodEntry | undefined}
 */
export function findMethod(name) {
	const canonical = resolveAlias(name)
	return METHODS_MANIFEST.find((entry) => entry.name === canonical)
}
