// @ts-check

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/sync-version.mjs', import.meta.url))

/**
 * @param {string} version
 * @returns {string}
 */
function makeFixtureRepo(version) {
	const dir = mkdtempSync(join(tmpdir(), 'unic-sync-version-test-'))
	mkdirSync(join(dir, '.claude-plugin'))
	writeFileSync(
		join(dir, '.claude-plugin', 'plugin.json'),
		`${JSON.stringify({ name: 'test-plugin', version }, null, 2)}\n`
	)
	writeFileSync(join(dir, '.claude-plugin', 'marketplace.json'), `${JSON.stringify({ version: '0.0.0' }, null, 2)}\n`)
	writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ version: '0.0.0' }, null, 2)}\n`)
	return dir
}

test('sync-version writes 2-space indented JSON (no tabs)', () => {
	const dir = makeFixtureRepo('1.2.3')
	try {
		const result = spawnSync(process.execPath, [SCRIPT], {
			env: { ...process.env },
			cwd: dir,
			encoding: 'utf8',
		})
		assert.equal(result.status, 0, `sync-version failed: ${result.stderr}`)

		for (const rel of ['.claude-plugin/marketplace.json', 'package.json']) {
			const content = readFileSync(join(dir, rel), 'utf8')
			assert.ok(!content.includes('\t'), `${rel} must not contain tabs`)
			assert.ok(content.startsWith('{\n  "'), `${rel} must start with 2-space indent`)
		}
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
