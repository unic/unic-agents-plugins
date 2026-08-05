// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
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
	toYaml,
	validateConfig,
} from '../lib/config-schema.mjs'
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
	const result = validateConfig(defaultConfig()) // all mandatory leaves are null
	assert.ok('error' in result && result.error === true)
	if (!('error' in result)) return
	assert.deepEqual(result.missing.sort(), ['project.branching', 'project.pr_strategy', 'tracker.type'])
})

test('validateConfig passes once mandatory paths are filled', () => {
	const config = mergeConfig(defaultConfig(), {
		tracker: { type: 'github' },
		project: { branching: 'gitflow', pr_strategy: 'merge' },
	})
	const result = validateConfig(config)
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

test('defaultConfig ships project.repo_ref as an optional key defaulting to null', () => {
	const project = /** @type {any} */ (defaultConfig().project)
	assert.equal(project.repo_ref, null, 'the key exists so the config can carry it, unset by default')
	assert.ok(
		!MANDATORY_PATHS.includes('project.repo_ref'),
		'repo_ref stays optional — promoting it to mandatory is out of scope (a box guards and cancels instead)'
	)
})

test('validateConfig passes with repo_ref unset — the key is optional, not mandatory', () => {
	const config = mergeConfig(
		{ tracker: { type: 'github' }, project: { branching: 'gitflow', pr_strategy: 'merge' } },
		{}
	)
	const result = validateConfig(config)
	assert.ok('ok' in result, 'a config with no repo_ref is still usable')
})

test('mergeConfig auto-fills project.repo_ref for an existing config that predates it', () => {
	// A config written before repo_ref existed keeps every answered project key.
	const merged = mergeConfig(
		{ tracker: { type: 'github' }, project: { branching: 'gitflow', pr_strategy: 'merge' } },
		{}
	)
	const project = /** @type {any} */ (merged.project)
	assert.equal(project.repo_ref, null, 'repo_ref filled from default')
	assert.equal(project.branching, 'gitflow', 'answered sibling key untouched')
	assert.equal(project.pr_strategy, 'merge', 'answered sibling key untouched')
})

test('mergeConfig carries a host-agnostic repo_ref through, for github and for ado', () => {
	const github = /** @type {any} */ (mergeConfig({ project: { repo_ref: 'unic/unic-agents-plugins' } }, {}).project)
	assert.equal(github.repo_ref, 'unic/unic-agents-plugins', 'github owner/repo form preserved verbatim')
	const ado = /** @type {any} */ (mergeConfig({ project: { repo_ref: 'MyRepo' } }, {}).project)
	assert.equal(ado.repo_ref, 'MyRepo', 'ado repository name preserved verbatim')
	assert.equal(github.repo_layout, 'single-context', 'untouched sub-key filled from default')
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
