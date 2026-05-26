// @ts-check

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { writeAgentDocs } from '../lib/agent-docs-writer.mjs'
import { AGENT_DOC_BANNER } from '../lib/dogfood-banner.mjs'
import { getDefaultLabels } from '../lib/labels-config.mjs'

const TEST_CONFIG = {
	tracker: /** @type {const} */ ('local-markdown'),
	pr_strategy: /** @type {const} */ ('merge'),
	branching: /** @type {const} */ ('gitflow'),
	repo_layout: 'single-context',
	labels: getDefaultLabels('local-markdown'),
}

test('writeAgentDocs writes all 5 docs/agents/*.md files with expected content', () => {
	const dir = join(tmpdir(), `unic-dlc-docs-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	writeAgentDocs(dir, TEST_CONFIG)

	// All 5 files exist
	for (const name of ['issue-tracker.md', 'labels.md', 'branching.md', 'domain.md', 'workflow.md']) {
		assert.ok(existsSync(join(dir, 'docs', 'agents', name)), `${name} should exist`)
	}

	// labels.md contains all three tiers
	const labels = readFileSync(join(dir, 'docs', 'agents', 'labels.md'), 'utf8')
	assert.ok(labels.includes('needs-triage'), 'labels.md should include state label')
	assert.ok(labels.includes('feature'), 'labels.md should include type label')
	assert.ok(labels.includes('p0'), 'labels.md should include priority label')

	// branching.md reflects gitflow
	const branching = readFileSync(join(dir, 'docs', 'agents', 'branching.md'), 'utf8')
	assert.ok(branching.includes('gitflow') || branching.includes('Gitflow'), 'branching.md should mention gitflow')

	// domain.md reflects single-context
	const domain = readFileSync(join(dir, 'docs', 'agents', 'domain.md'), 'utf8')
	assert.ok(domain.includes('single-context') || domain.includes('single'), 'domain.md should mention single-context')
	assert.ok(
		!domain.includes('each context may also keep its own'),
		'single-context domain.md should not mention per-context ADR pattern'
	)
	assert.ok(
		!domain.includes('located via `CONTEXT-MAP.md`'),
		'single-context domain.md should not contain the multi-context "How agents use this" wording'
	)

	// workflow.md mentions all 7 workflow phases
	const workflow = readFileSync(join(dir, 'docs', 'agents', 'workflow.md'), 'utf8')
	for (const phase of ['explore', 'plan', 'build', 'qa', 'cleanup', 'triage', 'review']) {
		assert.ok(workflow.toLowerCase().includes(phase), `workflow.md should mention ${phase}`)
	}
	// 'review' is also a substring of 'arch-review' and appears in surrounding prose — anchor on the
	// unique command string to make sure the review *row* is present, not just the word.
	assert.ok(workflow.includes('/unic-dlc-review'), 'workflow.md should list the /unic-dlc-review command')
})

test('multi-context domain.md mentions per-context ADR pattern', () => {
	const dir = join(tmpdir(), `unic-dlc-docs-multi-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	writeAgentDocs(dir, { ...TEST_CONFIG, repo_layout: 'multi-context' })

	const domain = readFileSync(join(dir, 'docs', 'agents', 'domain.md'), 'utf8')
	assert.ok(domain.includes('multi-context'), 'multi-context domain.md should mention multi-context')
	assert.ok(
		domain.includes('each context may also keep its own'),
		'multi-context domain.md should mention per-context docs/adr/ pattern'
	)
	assert.ok(
		domain.includes('located via `CONTEXT-MAP.md`'),
		'multi-context domain.md "How agents use this" should branch on multi-context wording'
	)
	assert.ok(domain.startsWith(AGENT_DOC_BANNER), 'multi-context domain.md should still begin with AGENT_DOC_BANNER')
})

test('each generated docs/agents/*.md file begins with AGENT_DOC_BANNER', () => {
	const dir = join(tmpdir(), `unic-dlc-docs-banner-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	writeAgentDocs(dir, TEST_CONFIG)

	for (const name of ['issue-tracker.md', 'labels.md', 'branching.md', 'domain.md', 'workflow.md']) {
		const content = readFileSync(join(dir, 'docs', 'agents', name), 'utf8')
		assert.ok(content.startsWith(AGENT_DOC_BANNER), `${name} should begin with AGENT_DOC_BANNER`)
	}
})

test('AGENT_DOC_BANNER appears exactly once per file on repeated writeAgentDocs calls', () => {
	const dir = join(tmpdir(), `unic-dlc-docs-dedup-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	writeAgentDocs(dir, TEST_CONFIG)
	writeAgentDocs(dir, TEST_CONFIG)
	writeAgentDocs(dir, TEST_CONFIG)

	for (const name of ['issue-tracker.md', 'labels.md', 'branching.md', 'domain.md', 'workflow.md']) {
		const content = readFileSync(join(dir, 'docs', 'agents', name), 'utf8')
		const occurrences = content.split(AGENT_DOC_BANNER).length - 1
		assert.equal(occurrences, 1, `${name}: AGENT_DOC_BANNER should appear exactly once`)
	}
})
