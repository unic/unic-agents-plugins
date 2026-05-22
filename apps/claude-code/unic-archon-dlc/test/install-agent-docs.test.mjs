// @ts-check

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { writeAgentDocs } from '../lib/agent-docs-writer.mjs'
import { getDefaultLabels } from '../lib/labels-config.mjs'

test('writeAgentDocs writes all 5 docs/agents/*.md files with expected content', () => {
	const dir = join(tmpdir(), `unic-dlc-docs-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	writeAgentDocs(dir, {
		tracker: 'local-markdown',
		pr_strategy: 'merge',
		branching: 'gitflow',
		repo_layout: 'single-context',
		labels: getDefaultLabels('local-markdown'),
	})

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

	// workflow.md mentions all 7 workflow phases
	const workflow = readFileSync(join(dir, 'docs', 'agents', 'workflow.md'), 'utf8')
	for (const phase of ['explore', 'plan', 'build', 'qa', 'cleanup', 'triage', 'review']) {
		assert.ok(workflow.toLowerCase().includes(phase), `workflow.md should mention ${phase}`)
	}
	// 'review' is also a substring of 'arch-review' and appears in surrounding prose — anchor on the
	// unique command string to make sure the review *row* is present, not just the word.
	assert.ok(workflow.includes('/unic-dlc-review'), 'workflow.md should list the /unic-dlc-review command')
})
