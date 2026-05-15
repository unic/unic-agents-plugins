// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { exploreProject } from '../scripts/lib/explorer.mjs'

/**
 * Creates a temp directory and returns its path with a cleanup function.
 * @returns {{ dir: string, cleanup: () => void }}
 */
function makeTempDir() {
	const dir = mkdtempSync(join(tmpdir(), 'dlc-explorer-test-'))
	return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

/** @type {import('../scripts/lib/config.mjs').DlcConfig} */
const VALID_CONFIG = {
	issueTracker: 'github',
	branchingStrategy: 'gitflow',
	tddMode: true,
	nyquistValidation: true,
	slopsquattingGate: true,
	modelProfile: 'balanced',
	e2eCommand: null,
	labels: { state: {}, type: {}, priority: {} },
}

describe('exploreProject', () => {
	it('returns all-absent/false snapshot for an empty directory', () => {
		const { dir, cleanup } = makeTempDir()
		try {
			const snapshot = exploreProject(dir)
			assert.equal(snapshot.hasClaudeMd, false)
			assert.equal(snapshot.hasContextMd, false)
			assert.equal(snapshot.hasContextMapMd, false)
			assert.equal(snapshot.existingConfig, null)
			assert.equal(snapshot.isMultiContext, false)
		} finally {
			cleanup()
		}
	})

	it('detects hasClaudeMd, hasContextMd, hasContextMapMd when files exist', () => {
		const { dir, cleanup } = makeTempDir()
		try {
			writeFileSync(join(dir, 'CLAUDE.md'), '# test', 'utf8')
			writeFileSync(join(dir, 'CONTEXT.md'), '# test', 'utf8')
			writeFileSync(join(dir, 'CONTEXT-MAP.md'), '# test', 'utf8')
			const snapshot = exploreProject(dir)
			assert.equal(snapshot.hasClaudeMd, true)
			assert.equal(snapshot.hasContextMd, true)
			assert.equal(snapshot.hasContextMapMd, true)
			assert.equal(snapshot.isMultiContext, true)
		} finally {
			cleanup()
		}
	})

	it('returns existingConfig with parsed config when valid config file is present', () => {
		const { dir, cleanup } = makeTempDir()
		try {
			const archonDir = join(dir, '.archon')
			mkdirSync(archonDir, { recursive: true })
			writeFileSync(join(archonDir, 'unic-dlc.config.json'), JSON.stringify(VALID_CONFIG, null, 2), 'utf8')
			const snapshot = exploreProject(dir)
			assert.ok(snapshot.existingConfig !== null)
			if (!snapshot.existingConfig) throw new Error('expected config')
			assert.equal(snapshot.existingConfig.issueTracker, 'github')
			assert.equal(snapshot.existingConfig.branchingStrategy, 'gitflow')
		} finally {
			cleanup()
		}
	})

	it('returns existingConfig:null when config file is absent', () => {
		const { dir, cleanup } = makeTempDir()
		try {
			const snapshot = exploreProject(dir)
			assert.equal(snapshot.existingConfig, null)
		} finally {
			cleanup()
		}
	})

	it('returns existingConfig:null when config file is invalid JSON', () => {
		const { dir, cleanup } = makeTempDir()
		try {
			const archonDir = join(dir, '.archon')
			mkdirSync(archonDir, { recursive: true })
			writeFileSync(join(archonDir, 'unic-dlc.config.json'), '{ invalid json }', 'utf8')
			const snapshot = exploreProject(dir)
			assert.equal(snapshot.existingConfig, null)
		} finally {
			cleanup()
		}
	})

	it('archonInstalled is a boolean', () => {
		const { dir, cleanup } = makeTempDir()
		try {
			const snapshot = exploreProject(dir)
			assert.equal(typeof snapshot.archonInstalled, 'boolean')
		} finally {
			cleanup()
		}
	})

	it('gitRemote is null when not inside a git repo', () => {
		const { dir, cleanup } = makeTempDir()
		try {
			const snapshot = exploreProject(dir)
			assert.equal(snapshot.gitRemote, null)
		} finally {
			cleanup()
		}
	})
})
