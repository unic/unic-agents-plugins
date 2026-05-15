// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTrackerAdapter } from '../scripts/lib/tracker.mjs'

/** @type {import('../scripts/lib/config.mjs').DlcConfig} */
const BASE_CONFIG = {
	issueTracker: 'github',
	branchingStrategy: 'gitflow',
	tddMode: true,
	nyquistValidation: true,
	slopsquattingGate: true,
	modelProfile: 'balanced',
	e2eCommand: null,
	labels: {
		state: {
			'needs-triage': 'needs-triage',
			'ready-for-agent': 'ready-for-agent',
			resolved: 'resolved',
			closed: 'closed',
		},
		type: {
			feature: 'enhancement',
			bug: 'bug',
		},
		priority: {
			p0: 'critical',
			p1: 'high',
			p2: 'medium',
			p3: 'low',
		},
	},
}

describe('createTrackerAdapter — github', () => {
	const config = { ...BASE_CONFIG, issueTracker: /** @type {'github'} */ ('github') }
	const adapter = createTrackerAdapter(config)

	it('createIssue returns correct gh CLI command', () => {
		const cmd = adapter.createIssue('Fix bug', 'Description here', ['bug', 'p1'])
		assert.ok(cmd.startsWith('gh issue create'))
		assert.ok(cmd.includes('--title "Fix bug"'))
		assert.ok(cmd.includes('--label "bug,high"'))
	})

	it('createIssue with no labels omits --label flag', () => {
		const cmd = adapter.createIssue('New feature', 'Body', [])
		assert.ok(!cmd.includes('--label'))
	})

	it('updateLabels returns gh issue edit command', () => {
		const cmd = adapter.updateLabels('42', ['needs-triage'])
		assert.ok(cmd.includes('gh issue edit 42'))
		assert.ok(cmd.includes('needs-triage'))
	})

	it('closeIssue returns gh issue close command', () => {
		const cmd = adapter.closeIssue('42')
		assert.equal(cmd, 'gh issue close 42')
	})

	it('mergePr returns gh pr merge command', () => {
		const cmd = adapter.mergePr('10')
		assert.ok(cmd !== null)
		assert.ok(/** @type {string} */ (cmd).includes('gh pr merge 10'))
	})
})

describe('createTrackerAdapter — ado', () => {
	const config = { ...BASE_CONFIG, issueTracker: /** @type {'ado'} */ ('ado') }
	const adapter = createTrackerAdapter(config)

	it('createIssue returns correct az CLI command', () => {
		const cmd = adapter.createIssue('Fix bug', 'Description', ['bug'])
		assert.ok(cmd.startsWith('az boards work-item create'))
		assert.ok(cmd.includes('--title "Fix bug"'))
	})

	it('updateLabels returns az CLI command', () => {
		const cmd = adapter.updateLabels('123', ['ready-for-agent'])
		assert.ok(cmd.includes('az boards work-item update'))
		assert.ok(cmd.includes('123'))
	})

	it('closeIssue returns az CLI command', () => {
		const cmd = adapter.closeIssue('123')
		assert.ok(cmd.includes('az boards work-item update'))
		assert.ok(cmd.includes('Done'))
	})

	it('mergePr returns az repos command', () => {
		const cmd = adapter.mergePr('5')
		assert.ok(cmd !== null)
		assert.ok(/** @type {string} */ (cmd).includes('az repos pr update'))
	})
})

describe('createTrackerAdapter — jira', () => {
	const config = { ...BASE_CONFIG, issueTracker: /** @type {'jira'} */ ('jira') }
	const adapter = createTrackerAdapter(config)

	it('createIssue returns correct jira CLI command', () => {
		const cmd = adapter.createIssue('Fix bug', 'Description', ['bug'])
		assert.ok(cmd.startsWith('jira issue create'))
		assert.ok(cmd.includes('--summary "Fix bug"'))
	})

	it('updateLabels returns jira edit command', () => {
		const cmd = adapter.updateLabels('PROJ-42', ['feature'])
		assert.ok(cmd.includes('jira issue edit PROJ-42'))
		assert.ok(cmd.includes('enhancement'))
	})

	it('closeIssue returns jira transition command', () => {
		const cmd = adapter.closeIssue('PROJ-42')
		assert.ok(cmd.includes('jira issue transition PROJ-42'))
	})

	it('mergePr returns jira transition command', () => {
		const cmd = adapter.mergePr('PROJ-10')
		assert.ok(cmd !== null)
	})
})

describe('createTrackerAdapter — local', () => {
	const config = { ...BASE_CONFIG, issueTracker: /** @type {'local'} */ ('local') }
	const adapter = createTrackerAdapter(config)

	it('createIssue returns a Node.js snippet comment string', () => {
		const cmd = adapter.createIssue('Fix bug', 'Description', ['bug'])
		assert.ok(cmd.startsWith('//'))
		assert.ok(cmd.includes('Fix bug') || cmd.includes('fix-bug'))
	})

	it('updateLabels returns a comment string', () => {
		const cmd = adapter.updateLabels('my-issue', ['resolved'])
		assert.ok(cmd.startsWith('//'))
	})

	it('closeIssue returns a comment string', () => {
		const cmd = adapter.closeIssue('my-issue')
		assert.ok(cmd.startsWith('//'))
	})

	it('mergePr returns null for local backend', () => {
		const cmd = adapter.mergePr('N/A')
		assert.equal(cmd, null)
	})
})

describe('label resolution', () => {
	it('translates canonical label names to config-mapped values', () => {
		const config = { ...BASE_CONFIG, issueTracker: /** @type {'github'} */ ('github') }
		const adapter = createTrackerAdapter(config)
		const cmd = adapter.createIssue('Issue', 'Body', ['p0', 'feature'])
		assert.ok(cmd.includes('critical'))
		assert.ok(cmd.includes('enhancement'))
	})

	it('passes through unknown labels unchanged', () => {
		const config = { ...BASE_CONFIG, issueTracker: /** @type {'github'} */ ('github') }
		const adapter = createTrackerAdapter(config)
		const cmd = adapter.createIssue('Issue', 'Body', ['custom-label'])
		assert.ok(cmd.includes('custom-label'))
	})
})
