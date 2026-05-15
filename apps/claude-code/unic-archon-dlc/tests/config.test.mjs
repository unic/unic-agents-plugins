// @ts-check

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { loadConfig } from '../scripts/lib/config.mjs'

/** @type {import('../scripts/lib/config.mjs').DlcConfig} */
const VALID_CONFIG = {
	issueTracker: 'github',
	branchingStrategy: 'gitflow',
	tddMode: true,
	nyquistValidation: true,
	slopsquattingGate: true,
	modelProfile: 'balanced',
	e2eCommand: null,
	labels: {
		state: { 'needs-triage': 'needs-triage', 'ready-for-agent': 'ready-for-agent' },
		type: { feature: 'enhancement', bug: 'bug' },
		priority: { p0: 'critical', p1: 'high', p2: 'medium', p3: 'low' },
	},
}

/**
 * Writes a JSON file to a temp dir and returns the file path.
 * @param {Record<string, unknown>} content
 * @returns {{ filePath: string, cleanup: () => void }}
 */
function makeTempConfig(content) {
	const dir = mkdtempSync(join(tmpdir(), 'dlc-config-test-'))
	const filePath = join(dir, 'unic-dlc.config.json')
	writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8')
	return {
		filePath,
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	}
}

describe('loadConfig', () => {
	it('returns ok:true with parsed config for a valid full config', () => {
		const { filePath, cleanup } = makeTempConfig(VALID_CONFIG)
		try {
			const result = loadConfig(filePath)
			assert.equal(result.ok, true)
			if (!result.ok) throw new Error('expected ok')
			assert.equal(result.config.issueTracker, 'github')
			assert.equal(result.config.branchingStrategy, 'gitflow')
			assert.equal(result.config.tddMode, true)
			assert.equal(result.config.nyquistValidation, true)
			assert.equal(result.config.slopsquattingGate, true)
			assert.equal(result.config.modelProfile, 'balanced')
			assert.equal(result.config.e2eCommand, null)
		} finally {
			cleanup()
		}
	})

	it('returns ok:false with error when issueTracker is missing', () => {
		const cfg = { ...VALID_CONFIG }
		// @ts-ignore — intentional test of missing field
		delete cfg.issueTracker
		const { filePath, cleanup } = makeTempConfig(cfg)
		try {
			const result = loadConfig(filePath)
			assert.equal(result.ok, false)
			if (result.ok) throw new Error('expected not ok')
			assert.ok(result.errors.some((e) => e.includes('issueTracker')))
		} finally {
			cleanup()
		}
	})

	it('returns ok:false with error when branchingStrategy is missing', () => {
		const cfg = { ...VALID_CONFIG }
		// @ts-ignore — intentional test of missing field
		delete cfg.branchingStrategy
		const { filePath, cleanup } = makeTempConfig(cfg)
		try {
			const result = loadConfig(filePath)
			assert.equal(result.ok, false)
			if (result.ok) throw new Error('expected not ok')
			assert.ok(result.errors.some((e) => e.includes('branchingStrategy')))
		} finally {
			cleanup()
		}
	})

	it('ignores unknown keys without error', () => {
		const cfg = { ...VALID_CONFIG, unknownKey: 'should-be-ignored', anotherExtra: 42 }
		const { filePath, cleanup } = makeTempConfig(cfg)
		try {
			const result = loadConfig(filePath)
			assert.equal(result.ok, true)
		} finally {
			cleanup()
		}
	})

	it('returns ok:false when file path does not exist', () => {
		const result = loadConfig('/nonexistent/path/to/unic-dlc.config.json')
		assert.equal(result.ok, false)
		if (result.ok) throw new Error('expected not ok')
		assert.ok(result.errors.length > 0)
	})

	it('accepts all valid issueTracker values', () => {
		for (const tracker of ['github', 'ado', 'jira', 'local']) {
			const cfg = { ...VALID_CONFIG, issueTracker: tracker }
			const { filePath, cleanup } = makeTempConfig(cfg)
			try {
				const result = loadConfig(filePath)
				assert.equal(result.ok, true, `Expected ok for issueTracker: ${tracker}`)
			} finally {
				cleanup()
			}
		}
	})

	it('defaults modelProfile to balanced when value is unrecognised', () => {
		const cfg = { ...VALID_CONFIG, modelProfile: 'turbo' }
		const { filePath, cleanup } = makeTempConfig(cfg)
		try {
			const result = loadConfig(filePath)
			assert.equal(result.ok, true)
			if (!result.ok) throw new Error('expected ok')
			assert.equal(result.config.modelProfile, 'balanced')
		} finally {
			cleanup()
		}
	})

	it('sets e2eCommand when provided as a string', () => {
		const cfg = { ...VALID_CONFIG, e2eCommand: 'pnpm run e2e' }
		const { filePath, cleanup } = makeTempConfig(cfg)
		try {
			const result = loadConfig(filePath)
			assert.equal(result.ok, true)
			if (!result.ok) throw new Error('expected ok')
			assert.equal(result.config.e2eCommand, 'pnpm run e2e')
		} finally {
			cleanup()
		}
	})
})
