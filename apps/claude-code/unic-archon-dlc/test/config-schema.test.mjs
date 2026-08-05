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

test('project.repo_ref defaults to null and is optional, so a config without it still validates', () => {
	// #289: every PR-touching Box pins `gh --repo` / `az repos --repository` to this value, and cancels
	// cleanly when it is absent. Optional on purpose — promoting it to mandatory is the 0.7.0 adoption's
	// job, and a mandatory leaf here would make every existing Consumer config invalid on upgrade.
	const project = /** @type {any} */ (defaultConfig().project)
	assert.ok('repo_ref' in project, 'defaultConfig must define project.repo_ref so a Box can read it')
	assert.equal(project.repo_ref, null, 'project.repo_ref defaults to null — "not pinned"')

	const filled = mergeConfig(defaultConfig(), {
		tracker: { type: 'github' },
		project: { branching: 'gitflow', pr_strategy: 'merge' },
	})
	const result = validateConfig(filled)
	assert.ok(!('error' in result), 'a config with no repo_ref must still validate')
	assert.ok(!MANDATORY_PATHS.includes('project.repo_ref'), 'project.repo_ref must not be a mandatory path')
})

test('project.repo_ref survives a merge and stays host-agnostic', () => {
	// The value is passed verbatim to whichever CLI the tracker resolves to, so the schema must not
	// normalise, split or host-qualify it: "OWNER/REPO", "HOST/OWNER/REPO" and ADO's "PROJECT/REPO" are
	// all legal and only the consuming Box knows which flag they belong to.
	for (const ref of ['unic/unic-agents-plugins', 'github.com/unic/unic-agents-plugins', 'MyProject/my-repo']) {
		const merged = mergeConfig({ project: { repo_ref: ref } }, {})
		assert.equal(/** @type {any} */ (merged.project).repo_ref, ref)
		// The sibling project keys must survive alongside it — a replaced (not merged) project block
		// would silently drop `branching` and send every Box to the wrong base branch.
		assert.equal(/** @type {any} */ (merged.project).repo_layout, 'single-context')
	}
	const answered = mergeConfig({ project: { repo_ref: 'old/repo' } }, { project: { repo_ref: 'new/repo' } })
	assert.equal(/** @type {any} */ (answered.project).repo_ref, 'new/repo', 'an answer wins over the on-disk value')
})

test('migrateLegacy carries a hand-added flat repo_ref into project.repo_ref', () => {
	const config = mergeConfig(migrateLegacy({ ...DOGFOOD_JSON, repo_ref: 'unic/unic-agents-plugins' }))
	assert.equal(/** @type {any} */ (config.project).repo_ref, 'unic/unic-agents-plugins')
	// A legacy config without the key migrates to the null default, never to undefined — a Box reads
	// the key unconditionally.
	assert.equal(/** @type {any} */ (mergeConfig(migrateLegacy(DOGFOOD_JSON)).project).repo_ref, null)
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
