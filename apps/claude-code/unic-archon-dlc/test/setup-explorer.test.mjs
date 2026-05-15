// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { exploreProject } from '../lib/setup-explorer.mjs'

test('returns structured snapshot; missing files are absent not throwing', async () => {
	const dir = join(tmpdir(), `unic-dlc-explore-${Date.now()}`)
	mkdirSync(dir, { recursive: true })
	// Only create CLAUDE.md — leave CONTEXT.md, CONTEXT-MAP.md, docs/adr/, .archon/ absent
	writeFileSync(join(dir, 'CLAUDE.md'), '# test project')

	const snapshot = await exploreProject(dir)

	// gitRemote: no git repo in tmpdir — should be null, not throw
	assert.equal(snapshot.gitRemote, null)

	// CLAUDE.md present
	assert.equal(snapshot.claudeMd.present, true)
	assert.ok(snapshot.claudeMd.content?.includes('test project'))

	// Missing files reported as absent
	assert.equal(snapshot.contextMd.present, false)
	assert.equal(snapshot.contextMd.content, null)
	assert.equal(snapshot.contextMapMd.present, false)

	// ADR directory absent — empty array, not throw
	assert.deepEqual(snapshot.adrFiles, [])

	// No existing .archon config
	assert.equal(snapshot.archonConfigPresent, false)
	assert.equal(snapshot.existingConfig, null)
})
