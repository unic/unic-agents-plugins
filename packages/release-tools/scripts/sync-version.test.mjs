#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const script = new URL('./sync-version.mjs', import.meta.url).pathname

/**
 * @param {string} cwd
 */
function run(cwd) {
	const result = spawnSync('node', [script], { encoding: 'utf8', cwd })
	return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** @returns {{ tmpDir: string, cleanup: () => void }} */
function makeTmpDir() {
	const tmpDir = mkdtempSync(path.join(tmpdir(), 'sv-test-'))
	mkdirSync(path.join(tmpDir, '.claude-plugin'), { recursive: true })
	return { tmpDir, cleanup: () => rmSync(tmpDir, { recursive: true, force: true }) }
}

/**
 * @param {string} dir
 * @param {Record<string, unknown>} data
 */
function writePluginJson(dir, data) {
	writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

/**
 * @param {string} dir
 * @param {Record<string, unknown>} data
 */
function writeMarketplaceJson(dir, data) {
	writeFileSync(path.join(dir, '.claude-plugin', 'marketplace.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

// ── Error cases ──────────────────────────────────────────────────────────────

test('exits 1 when plugin.json is missing', () => {
	const { tmpDir, cleanup } = makeTmpDir()
	try {
		const result = run(tmpDir)
		assert.strictEqual(result.status, 1)
		assert.ok(
			result.stderr.includes('plugin.json') || result.stderr.includes('cannot read'),
			`expected plugin.json error, got: ${result.stderr}`
		)
	} finally {
		cleanup()
	}
})

test('exits 1 when .version is missing or not a string in plugin.json', () => {
	const { tmpDir, cleanup } = makeTmpDir()
	try {
		writePluginJson(tmpDir, { name: 'test-plugin' })
		const result = run(tmpDir)
		assert.strictEqual(result.status, 1)
		assert.ok(
			result.stderr.includes('.version') || result.stderr.includes('missing'),
			`expected .version error, got: ${result.stderr}`
		)
	} finally {
		cleanup()
	}
})

test('exits 1 when marketplace.json has no plugins[] array', () => {
	const { tmpDir, cleanup } = makeTmpDir()
	try {
		writePluginJson(tmpDir, { name: 'test-plugin', version: '1.0.0' })
		writeMarketplaceJson(tmpDir, {})
		const result = run(tmpDir)
		assert.strictEqual(result.status, 1)
		assert.ok(
			result.stderr.includes('plugins[]') || result.stderr.includes('no plugins'),
			`expected plugins[] error, got: ${result.stderr}`
		)
	} finally {
		cleanup()
	}
})

// ── Happy path ────────────────────────────────────────────────────────────────

test('syncs version from plugin.json to marketplace.json', () => {
	const { tmpDir, cleanup } = makeTmpDir()
	try {
		writePluginJson(tmpDir, { name: 'test-plugin', version: '2.0.0' })
		writeMarketplaceJson(tmpDir, { plugins: [{ name: 'test-plugin', version: '1.0.0' }] })
		const result = run(tmpDir)
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		const marketplace = JSON.parse(readFileSync(path.join(tmpDir, '.claude-plugin', 'marketplace.json'), 'utf8'))
		assert.strictEqual(marketplace.plugins[0].version, '2.0.0')
	} finally {
		cleanup()
	}
})

test('syncs version to package.json when it exists', () => {
	const { tmpDir, cleanup } = makeTmpDir()
	try {
		writePluginJson(tmpDir, { name: 'test-plugin', version: '2.0.0' })
		writeMarketplaceJson(tmpDir, { plugins: [{ name: 'test-plugin', version: '2.0.0' }] })
		writeFileSync(
			path.join(tmpDir, 'package.json'),
			`${JSON.stringify({ name: 'test-plugin', version: '1.5.0' }, null, 2)}\n`,
			'utf8'
		)
		const result = run(tmpDir)
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		const pkg = JSON.parse(readFileSync(path.join(tmpDir, 'package.json'), 'utf8'))
		assert.strictEqual(pkg.version, '2.0.0')
	} finally {
		cleanup()
	}
})

test('reports no change when versions already match', () => {
	const { tmpDir, cleanup } = makeTmpDir()
	try {
		writePluginJson(tmpDir, { name: 'test-plugin', version: '1.0.0' })
		writeMarketplaceJson(tmpDir, { plugins: [{ name: 'test-plugin', version: '1.0.0' }] })
		const result = run(tmpDir)
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		assert.ok(
			result.stdout.includes('no change') || result.stdout.includes('already at'),
			`expected no-change message, got: ${result.stdout}`
		)
	} finally {
		cleanup()
	}
})

test('mirrors license, homepage, and keywords fields from plugin.json into marketplace entry', () => {
	const { tmpDir, cleanup } = makeTmpDir()
	try {
		writePluginJson(tmpDir, {
			name: 'test-plugin',
			version: '1.0.0',
			license: 'MIT',
			homepage: 'https://example.com',
			keywords: ['ai', 'plugin'],
		})
		writeMarketplaceJson(tmpDir, { plugins: [{ name: 'test-plugin', version: '1.0.0' }] })
		const result = run(tmpDir)
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		const marketplace = JSON.parse(readFileSync(path.join(tmpDir, '.claude-plugin', 'marketplace.json'), 'utf8'))
		assert.strictEqual(marketplace.plugins[0].license, 'MIT')
		assert.strictEqual(marketplace.plugins[0].homepage, 'https://example.com')
		assert.deepStrictEqual(marketplace.plugins[0].keywords, ['ai', 'plugin'])
	} finally {
		cleanup()
	}
})
