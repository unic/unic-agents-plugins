// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { parse as parseYaml } from 'yaml'
import {
	DEFAULT_PRD_TEMPLATE,
	defaultConfig,
	isLegacyConfig,
	loadConfig,
	MANDATORY_PATHS,
	mergeConfig,
	migrateLegacy,
	resolveArchonRemote,
	toYaml,
	validateConfig,
} from '../lib/config-schema.mjs'
import { PRIORITY_LABELS, STATE_LABELS, TYPE_LABELS } from '../lib/labels-config.mjs'
import { DEFAULT_PRD_HEADINGS } from '../lib/prd-writer.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-schema-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

/** The exact dogfood config this repo ships today (flat ADR-0001 JSON). */
const DOGFOOD_JSON = {
	model_profile: 'balanced',
	tdd_mode: true,
	nyquist_validation: true,
	slopsquatting_gate: true,
	tracker: 'github',
	pr_strategy: 'merge',
	branching: 'gitflow',
	e2e_command: null,
	repo_layout: 'multi-context',
	labels: {
		state: {
			'needs-triage': 'needs-triage',
			'needs-info': 'needs-info',
			'needs-specs': 'needs-specs',
			'ready-for-agent': 'ready-for-agent',
			'ready-for-human': 'ready-for-human',
			resolved: 'resolved',
			closed: 'closed',
			rejected: 'rejected',
		},
		type: {
			feature: 'feature',
			bug: 'bug',
			spike: 'spike',
			'tech-debt': 'tech-debt',
			docs: 'docs',
			release: 'release',
		},
		priority: { p0: 'p0', p1: 'p1', p2: 'p2', p3: 'p3' },
	},
}

/**
 * A legacy flat config written before the `docs` type role existed — deliberately short of exactly
 * one shipped role, unlike DOGFOOD_JSON. Once `defaultConfig()` stopped seeding an identity map
 * there is nothing left to backfill the gap silently, and that is the point: this must read as
 * `partial` so `/setup` collects the missing role.
 */
const LEGACY_MISSING_ROLE_JSON = {
	...DOGFOOD_JSON,
	labels: {
		...DOGFOOD_JSON.labels,
		type: { feature: 'feature', bug: 'bug', spike: 'spike', 'tech-debt': 'tech-debt', release: 'release' },
	},
}

/** The seventeen entries `/setup` writes when the operator keeps every Label string it offers. */
function identityLabels() {
	const identity = (/** @type {readonly string[]} */ keys) => Object.fromEntries(keys.map((k) => [k, k]))
	return { state: identity(STATE_LABELS), type: identity(TYPE_LABELS), priority: identity(PRIORITY_LABELS) }
}

/** A config whose only remaining gap is whatever the caller leaves out. */
function answeredConfig(/** @type {Record<string, unknown>} */ overrides = {}) {
	return mergeConfig(defaultConfig(), {
		tracker: { type: 'github' },
		project: { branching: 'gitflow', pr_strategy: 'merge' },
		classification: { labels: identityLabels() },
		...overrides,
	})
}

test('loadConfig parses JSON by extension', () => {
	const path = join(tempDir(), 'unic-dlc.config.json')
	writeFileSync(path, JSON.stringify(DOGFOOD_JSON))
	const result = loadConfig(path)
	assert.ok(!('error' in result))
	if ('error' in result) return
	assert.equal(result.config.tracker, 'github')
})

test('loadConfig parses YAML by extension', () => {
	const path = join(tempDir(), 'unic-dlc.config.yaml')
	writeFileSync(path, 'tracker:\n  type: github\nproject:\n  branching: gitflow\n')
	const result = loadConfig(path)
	assert.ok(!('error' in result))
	if ('error' in result) return
	assert.deepEqual(result.config.tracker, { type: 'github' })
})

test('loadConfig returns structured error for a missing file', () => {
	const result = loadConfig(join(tempDir(), 'nope.yaml'))
	assert.ok('error' in result && result.error === true)
})

test('loadConfig returns structured error for malformed content (setup relies on this to fail fast)', () => {
	const jsonPath = join(tempDir(), 'unic-dlc.config.json')
	writeFileSync(jsonPath, '{ not: valid json,,, ')
	const jsonResult = loadConfig(jsonPath)
	assert.ok('error' in jsonResult && jsonResult.error === true, 'malformed JSON should error')

	const yamlPath = join(tempDir(), 'unic-dlc.config.yaml')
	writeFileSync(yamlPath, 'project:\n  name: "unterminated\n\tbad: indent')
	const yamlResult = loadConfig(yamlPath)
	assert.ok('error' in yamlResult && yamlResult.error === true, 'malformed YAML should error')
})

test('validateConfig flags each missing mandatory path', () => {
	// One path, since #389 moved the tracker contract into `docs/agents/`. `project.branching` is the
	// only thing left that a Box cannot read anywhere else — it decides the base branch.
	const result = validateConfig(defaultConfig())
	assert.ok('error' in result && result.error === true)
	if (!('error' in result)) return
	assert.deepEqual(result.missing.sort(), ['project.branching'])
})

test('validateConfig ignores a config that still carries the keys #389 retired', () => {
	// A Consumer installed before #389 has `tracker`, `classification.labels` and
	// `project.pr_strategy` on disk. Nothing reads them now; rejecting them would break a working
	// install to no end, so they are accepted and ignored — including a hand-mangled shape.
	const stale = mergeConfig(answeredConfig(), {
		tracker: { type: null },
		classification: { labels: 'not-an-object' },
		project: { pr_strategy: null },
	})
	assert.ok(!('error' in validateConfig(stale)), 'a retired key must not be a fault')
	assert.ok(!('error' in toYaml(stale)), 'and it must still write')
})

test('validateConfig passes once mandatory paths are filled', () => {
	const result = validateConfig(answeredConfig())
	assert.ok(!('error' in result), 'expected a valid config')
})

test('mergeConfig precedence: defaults < existing < answers', () => {
	const existing = { model_profile: 'fast', build: { tdd_mode: false } }
	const answers = { model_profile: 'max' }
	const merged = mergeConfig(existing, answers)
	assert.equal(merged.model_profile, 'max') // answer wins over existing
	assert.equal(/** @type {any} */ (merged.build).tdd_mode, false) // existing wins over default
	assert.equal(/** @type {any} */ (merged.build).nyquist_validation, true) // default fills the gap
})

test('mergeConfig deep-merges nested objects rather than replacing them', () => {
	const merged = mergeConfig({ tracker: { type: 'ado' } }, {})
	const tracker = /** @type {any} */ (merged.tracker)
	assert.equal(tracker.type, 'ado')
	assert.deepEqual(tracker.access, { mcp: null, cli: null }) // default sub-keys retained
})

test('mergeConfig is idempotent', () => {
	const once = mergeConfig(migrateLegacy(DOGFOOD_JSON))
	const twice = mergeConfig(once)
	assert.deepEqual(twice, once)
})

test('isLegacyConfig detects flat vs rich', () => {
	assert.equal(isLegacyConfig(DOGFOOD_JSON), true)
	assert.equal(isLegacyConfig({ tracker: { type: 'github' } }), false)
})

test('migrateLegacy maps flat JSON into the rich shape without data loss', () => {
	const config = mergeConfig(migrateLegacy(DOGFOOD_JSON))
	const tracker = /** @type {any} */ (config.tracker)
	const project = /** @type {any} */ (config.project)
	const build = /** @type {any} */ (config.build)

	assert.equal(tracker.type, 'github')
	assert.equal(tracker.access.cli, 'gh')
	assert.equal(project.branching, 'gitflow')
	assert.equal(project.pr_strategy, 'merge')
	assert.equal(project.repo_layout, 'multi-context')
	assert.equal(build.tdd_mode, true)
	assert.equal(build.e2e_command, null)
	assert.equal(config.model_profile, 'balanced')
})

test('migrateLegacy preserves hand-added label types such as `release`', () => {
	const config = mergeConfig(migrateLegacy(DOGFOOD_JSON))
	const labels = /** @type {any} */ (config.classification).labels
	assert.equal(labels.type.release, 'release')
	assert.equal(Object.keys(labels.type).length, 6)
	assert.equal(Object.keys(labels.state).length, 8)
})

test('defaultConfig emits no classification key at all', () => {
	const config = defaultConfig()
	assert.ok(!('classification' in config), 'defaultConfig must not seed classification.labels')
	assert.ok(!('classification' in mergeConfig()), 'and a default merge must not reintroduce it')
	assert.ok(
		!MANDATORY_PATHS.includes('classification.labels'),
		'and it is not mandatory either — docs/agents/triage-labels.md carries the roles (#389)'
	)
})

test('a legacy config short of one role still writes — the roles left this file', () => {
	// Before #389 this config read as `partial` so `/setup` would collect the missing role. The role
	// vocabulary now lives in `docs/agents/triage-labels.md`, so the gap is no longer this file's
	// business: the config validates, and a hand-added role still survives the migration.
	const config = mergeConfig(migrateLegacy(LEGACY_MISSING_ROLE_JSON))

	assert.ok(!('error' in validateConfig(config)), 'a missing role is no longer a config fault')
	assert.equal(
		/** @type {any} */ (config.classification).labels.type.release,
		'release',
		'and the hand-added role survives the trip'
	)

	assert.ok(!('error' in toYaml(config)), 'toYaml writes it')

	// What /setup does next: it asks for the missing role, keeping the strings already mapped.
	const labels = /** @type {any} */ (config.classification).labels
	const answered = mergeConfig(config, { classification: { labels: { type: { docs: 'documentation' } } } })
	const emitted = toYaml(answered)
	assert.ok(!('error' in emitted), 'and writes once the answer lands')
	assert.equal(/** @type {any} */ (answered.classification).labels.type.docs, 'documentation')
	assert.equal(/** @type {any} */ (answered.classification).labels.type.release, labels.type.release)
})

test('mergeConfig keeps a hand-edited classification.labels when the answers carry none', () => {
	// Already true — `DEFAULTS < existing < answers` — but nothing guarded it, and it is the reason a
	// re-run of /setup cannot quietly overwrite a team's own Label strings.
	const labels = identityLabels()
	const existing = answeredConfig({
		classification: { labels: { ...labels, state: { ...labels.state, 'needs-triage': '3-Analysis' } } },
	})

	const reRun = mergeConfig(existing, {})

	assert.deepEqual(
		/** @type {any} */ (reRun.classification).labels,
		/** @type {any} */ (existing.classification).labels,
		'a re-run with no label answers preserves the mapping on disk'
	)
})

test('toYaml validates then serializes; round-trips through loadConfig', () => {
	const config = mergeConfig(migrateLegacy(DOGFOOD_JSON))
	const emitted = toYaml(config)
	assert.ok(!('error' in emitted), 'valid config should serialize')
	if ('error' in emitted) return

	const path = join(tempDir(), 'unic-dlc.config.yaml')
	writeFileSync(path, emitted.yaml)
	const reloaded = loadConfig(path)
	assert.ok(!('error' in reloaded))
	if ('error' in reloaded) return
	assert.deepEqual(reloaded.config, config) // full round-trip fidelity
	assert.deepEqual(parseYaml(emitted.yaml), config)
})

test('toYaml refuses to serialize an invalid config', () => {
	const emitted = toYaml(defaultConfig()) // mandatory leaves still null
	assert.ok('error' in emitted && emitted.error === true)
})

test('defaultConfig ships the PRD template in config (ADR-0018), carrying every canonical heading', () => {
	const templates = /** @type {any} */ (defaultConfig().templates)
	assert.equal(typeof templates.prd, 'string', 'templates.prd is the default scaffold, not null')
	for (const heading of DEFAULT_PRD_HEADINGS) {
		assert.ok(templates.prd.includes(`## ${heading}`), `scaffold should carry the "${heading}" heading`)
	}
	assert.equal(templates.prd, DEFAULT_PRD_TEMPLATE, 'default templates.prd is DEFAULT_PRD_TEMPLATE')
})

test('defaultConfig ships specs defaults: discuss_mode=discuss, gate=open-pr', () => {
	const specs = /** @type {any} */ (defaultConfig().specs)
	assert.equal(specs.discuss_mode, 'discuss')
	assert.equal(specs.gate, 'open-pr')
})

test('defaultConfig ships tickets defaults: gate=open-pr', () => {
	const tickets = /** @type {any} */ (defaultConfig().tickets)
	assert.equal(tickets.gate, 'open-pr')
})

test('defaultConfig ships triage defaults: out_of_scope_dir=.out-of-scope, external_prs=auto', () => {
	const triage = /** @type {any} */ (defaultConfig().triage)
	assert.equal(triage.out_of_scope_dir, '.out-of-scope')
	assert.equal(triage.external_prs, 'auto')
})

test('defaultConfig ships qa defaults: e2e_command=null, coverage_threshold=null (fall back to build.*)', () => {
	const qa = /** @type {any} */ (defaultConfig().qa)
	assert.equal(qa.e2e_command, null)
	assert.equal(qa.coverage_threshold, null)
})

test('mergeConfig auto-fills the qa block for an existing config that predates it', () => {
	// A config written before the qa block existed (e.g. the triage-era dogfood config).
	const merged = mergeConfig(
		{ tracker: { type: 'github' }, project: { branching: 'gitflow', pr_strategy: 'merge' } },
		{}
	)
	const qa = /** @type {any} */ (merged.qa)
	assert.deepEqual(qa, { e2e_command: null, coverage_threshold: null }, 'qa block filled from default')
})

test('mergeConfig preserves a team override of qa, filling untouched sub-keys', () => {
	const merged = mergeConfig({ qa: { e2e_command: 'pnpm test:e2e' } }, {})
	const qa = /** @type {any} */ (merged.qa)
	assert.equal(qa.e2e_command, 'pnpm test:e2e', 'existing override wins')
	assert.equal(qa.coverage_threshold, null, 'untouched sub-key filled from default')
})

test('defaultConfig ships pr-review defaults: confidence_threshold=60, inline_comments=true', () => {
	const prReview = /** @type {any} */ (defaultConfig()['pr-review'])
	assert.equal(prReview.confidence_threshold, 60)
	assert.equal(prReview.inline_comments, true)
})

test('mergeConfig auto-fills the pr-review block for an existing config that predates it', () => {
	// A config written before the pr-review block existed (e.g. the qa-era dogfood config).
	const merged = mergeConfig(
		{ tracker: { type: 'github' }, project: { branching: 'gitflow', pr_strategy: 'merge' } },
		{}
	)
	const prReview = /** @type {any} */ (merged['pr-review'])
	assert.deepEqual(prReview, { confidence_threshold: 60, inline_comments: true }, 'pr-review block filled from default')
})

test('mergeConfig preserves a team override of pr-review, filling untouched sub-keys', () => {
	const merged = mergeConfig({ 'pr-review': { confidence_threshold: 80 } }, {})
	const prReview = /** @type {any} */ (merged['pr-review'])
	assert.equal(prReview.confidence_threshold, 80, 'existing override wins')
	assert.equal(prReview.inline_comments, true, 'untouched sub-key filled from default')
})

test('defaultConfig ships cleanup defaults: stale_days=7, dry_run=true, prune_slug_dirs=false', () => {
	const cleanup = /** @type {any} */ (defaultConfig().cleanup)
	assert.deepEqual(cleanup, { stale_days: 7, dry_run: true, prune_slug_dirs: false })
})

test('mergeConfig auto-fills the cleanup block for an existing config that predates it', () => {
	// A config written before the cleanup block existed (e.g. the pr-review-era dogfood config).
	const merged = mergeConfig(
		{ tracker: { type: 'github' }, project: { branching: 'gitflow', pr_strategy: 'merge' } },
		{}
	)
	const cleanup = /** @type {any} */ (merged.cleanup)
	assert.deepEqual(
		cleanup,
		{ stale_days: 7, dry_run: true, prune_slug_dirs: false },
		'cleanup block filled from default'
	)
})

test('mergeConfig preserves a team override of cleanup, filling untouched sub-keys', () => {
	const merged = mergeConfig({ cleanup: { stale_days: 14 } }, {})
	const cleanup = /** @type {any} */ (merged.cleanup)
	assert.equal(cleanup.stale_days, 14, 'existing override wins')
	assert.equal(cleanup.dry_run, true, 'untouched sub-key filled from default')
	assert.equal(cleanup.prune_slug_dirs, false, 'untouched sub-key filled from default')
})

test('mergeConfig preserves a team override of triage, filling untouched sub-keys', () => {
	const merged = mergeConfig({ triage: { external_prs: 'never' } }, {})
	const triage = /** @type {any} */ (merged.triage)
	assert.equal(triage.external_prs, 'never', 'existing override wins')
	assert.equal(triage.out_of_scope_dir, '.out-of-scope', 'untouched sub-key filled from default')
})

test('defaultConfig ships an empty methods block and no retired skills block', () => {
	const config = defaultConfig()
	assert.deepEqual(config.methods, {}, 'the config tier of Method resolution starts empty')
	assert.ok(!('skills' in config), 'the retired skills.matt_suite probe is gone')
})

test('mergeConfig strips a legacy skills.matt_suite block from an existing config', () => {
	// The Bundle answers "is the Method available" by construction, so a re-run of /setup must clean
	// the old discovery key out rather than keep merging it forward.
	const merged = mergeConfig({ skills: { matt_suite: { present: true, missing: [] } }, tracker: { type: 'github' } })

	assert.ok(!('skills' in merged), 'legacy skills block stripped')
	assert.deepEqual(/** @type {any} */ (merged.tracker).type, 'github', 'sibling keys survive the strip')
})

test('mergeConfig strips skills even when passed explicitly as an answer', () => {
	const merged = mergeConfig({}, { skills: { matt_suite: { present: true, missing: [] } } })

	assert.ok(!('skills' in merged), 'an explicit answer cannot reintroduce a retired key')
})

test('mergeConfig stays idempotent after stripping a retired key', () => {
	const once = mergeConfig({ skills: { matt_suite: { present: false, missing: ['tdd'] } } })
	const twice = mergeConfig(once)

	assert.deepEqual(twice, once)
})

test('mergeConfig preserves a team-declared methods override', () => {
	const merged = mergeConfig({ methods: { tdd: { source: 'team/methods/tdd/SKILL.md' } } })

	assert.deepEqual(merged.methods, { tdd: { source: 'team/methods/tdd/SKILL.md' } })
})

test('mergeConfig preserves a team override of specs and templates.prd, filling gaps', () => {
	const merged = mergeConfig({ specs: { gate: 'stage-only' }, templates: { prd: '# Custom\n## Goal\n' } }, {})
	const specs = /** @type {any} */ (merged.specs)
	const templates = /** @type {any} */ (merged.templates)
	assert.equal(specs.gate, 'stage-only', 'existing override wins')
	assert.equal(specs.discuss_mode, 'discuss', 'untouched sub-key filled from default')
	assert.equal(templates.prd, '# Custom\n## Goal\n', 'a custom PRD template replaces the default wholesale')
	assert.equal(templates.issue, null, 'sibling template default retained')
})

test('project.repo_ref is retired — nothing seeds it and nothing requires it', () => {
	// #389 deleted it. `docs/agents/issue-tracker.md` § Addressing names the repository, so there is no
	// derivation from a remote left for an override to correct. A config that still carries the key
	// keeps it — an operator's hand-edit is never stripped — but no Box reads it.
	// `test/box-staging-and-repo-pinning.test.mjs` asserts that absence across every Box.
	const project = /** @type {any} */ (defaultConfig().project)
	assert.ok(!('repo_ref' in project), 'project.repo_ref must not be in the default config')

	const merged = /** @type {any} */ (mergeConfig())
	assert.ok(!('repo_ref' in merged.project), 'a default merge must not introduce project.repo_ref')

	assert.ok(
		!MANDATORY_PATHS.some((path) => path.includes('repo_ref')),
		'project.repo_ref must never become a mandatory config path'
	)
})

test('commands/setup.md keeps the classification.labels question and the CLAUDE.md marker sentence', () => {
	// Same pattern as the repo_ref guard above: doc-only prose with no other test surface, guarding
	// against a future reformat or merge-conflict resolution silently dropping any of the three
	// sentences. Each assertion anchors one sentence, so all three are named here rather than
	// assumed to travel together.
	const setupDoc = readFileSync(join(import.meta.dirname, '..', 'commands', 'setup.md'), 'utf8')
	assert.match(
		setupDoc,
		/\*\*classification\*\* — `classification\.labels` _\(mandatory\)_/,
		'Step 4 must keep asking the Canonical role → Label string question'
	)
	assert.match(
		setupDoc,
		/Any entry in `MISSING` that starts with `classification\.labels` selects this field/,
		'Step 4 must keep routing a partial config to the label question, or a legacy config short of a role is never collected'
	)
	assert.match(
		setupDoc,
		/carries one sentence naming `classification\.labels`/,
		'Step 7 must keep pointing the CLAUDE.md marker block at classification.labels'
	)
})

test('resolveArchonRemote prefers worktree.remote over auto-detection', () => {
	assert.equal(
		resolveArchonRemote({ remotes: ['origin', 'fork'], archonConfig: { worktree: { remote: 'fork' } } }),
		'fork'
	)
})

test('resolveArchonRemote falls back to origin when worktree.remote is unset', () => {
	assert.equal(resolveArchonRemote({ remotes: ['origin', 'fork'], archonConfig: null }), 'origin')
})

test('resolveArchonRemote falls back to the sole remote when origin is absent', () => {
	assert.equal(resolveArchonRemote({ remotes: ['fork'], archonConfig: null }), 'fork')
})

test('resolveArchonRemote resolves to null when ambiguous', () => {
	assert.equal(resolveArchonRemote({ remotes: ['fork-a', 'fork-b'], archonConfig: null }), null)
})
