#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./bump-version.mjs', import.meta.url))

/**
 * @param {string[]} args
 * @param {string} cwd
 * @param {Record<string, string>} [extraEnv]
 */
function run(args, cwd, extraEnv = {}) {
	const result = spawnSync('node', [script, ...args], {
		encoding: 'utf8',
		cwd,
		env: { ...process.env, ...extraEnv },
	})
	return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** @returns {{ tmpDir: string, env: Record<string,string>, cleanup: () => void }} */
function makeTmpDir() {
	const tmpDir = mkdtempSync(path.join(tmpdir(), 'bv-test-'))
	mkdirSync(path.join(tmpDir, '.claude-plugin'), { recursive: true })
	// On Windows, PATH may be stored as 'Path'; use the same key to avoid duplicates
	const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
	const pathParts = [tmpDir, process.env[pathKey]].filter(Boolean)
	return {
		tmpDir,
		env: { [pathKey]: pathParts.join(path.delimiter) },
		cleanup: () => rmSync(tmpDir, { recursive: true, force: true }),
	}
}

/**
 * Write cross-platform fake git as a Node.js CJS script.
 * Pass the returned path as _GIT_BIN in the test env.
 * @param {string} dir
 * @param {{ dirty?: boolean }} [opts]
 * @returns {string} absolute path to the .cjs shim
 */
function writeFakeGit(dir, opts = {}) {
	const dirty = opts.dirty ?? false
	const shimPath = path.join(dir, 'fake-git.cjs')
	const dirtyLine = dirty ? "  process.stdout.write(' M some-file.txt\\n')" : ''
	writeFileSync(
		shimPath,
		[
			'const cmd = process.argv[2]',
			"if (cmd === 'status') {",
			dirtyLine,
			'  process.exit(0)',
			'}',
			'process.exit(0)',
		].join('\n')
	)
	return shimPath
}

/**
 * Write cross-platform fake pnpm binary into dir (no-op, exits 0).
 * @param {string} dir
 */
function writeFakePnpm(dir) {
	writeFileSync(path.join(dir, 'pnpm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
	writeFileSync(path.join(dir, 'pnpm.cmd'), '@echo off\nexit /b 0\n')
}

/**
 * @param {string} dir
 * @param {string} version
 */
function writePluginJson(dir, version) {
	writeFileSync(
		path.join(dir, '.claude-plugin', 'plugin.json'),
		`${JSON.stringify({ name: 'test-plugin', version }, null, 2)}\n`,
		'utf8'
	)
}

/**
 * @param {string} dir
 * @param {string} version
 */
function writeMarketplaceJson(dir, version) {
	writeFileSync(
		path.join(dir, '.claude-plugin', 'marketplace.json'),
		`${JSON.stringify({ plugins: [{ name: 'test-plugin', version }] }, null, 2)}\n`,
		'utf8'
	)
}

/**
 * @param {string} dir
 * @param {{ version?: string, hasEntry?: boolean, hasUnreleased?: boolean }} [opts]
 */
function writeChangelog(dir, opts = {}) {
	const version = opts.version ?? '1.0.0'
	const hasEntry = opts.hasEntry ?? true
	const hasUnreleased = opts.hasUnreleased ?? true
	const lines = ['# Changelog', '']
	if (hasUnreleased) {
		lines.push(
			'## [Unreleased]',
			'',
			'### Breaking',
			'- (none)',
			'',
			'### Added',
			hasEntry ? '- Added something useful' : '- (none)',
			'',
			'### Fixed',
			'- (none)',
			''
		)
	}
	lines.push(`## [${version}] — 2025-01-01`, '', '### Added', '- initial release')
	writeFileSync(path.join(dir, 'CHANGELOG.md'), `${lines.join('\n')}\n`, 'utf8')
}

// ── Error cases ──────────────────────────────────────────────────────────────

test('exits 1 with usage message when bump type is invalid', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		const result = run(['bogus'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 1)
		assert.ok(result.stderr.includes('Usage:'), `expected "Usage:" in stderr, got: ${result.stderr}`)
	} finally {
		cleanup()
	}
})

test('exits 1 when working tree is dirty', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir, { dirty: true })
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 1)
		assert.ok(result.stderr.includes('dirty'), `expected "dirty" in stderr, got: ${result.stderr}`)
	} finally {
		cleanup()
	}
})

test('exits 1 when plugin.json is missing', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 1)
		assert.ok(
			result.stderr.includes('plugin.json') || result.stderr.includes('cannot read'),
			`expected error about plugin.json, got: ${result.stderr}`
		)
	} finally {
		cleanup()
	}
})

test('exits 1 when version in plugin.json is malformed (e.g. "not-semver")', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writePluginJson(tmpDir, 'not-semver')
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 1)
		assert.ok(
			result.stderr.includes('cannot parse version') || result.stderr.includes('not-semver'),
			`expected version parse error, got: ${result.stderr}`
		)
	} finally {
		cleanup()
	}
})

test('exits 1 when CHANGELOG.md is missing', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writePluginJson(tmpDir, '1.0.0')
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 1)
		assert.ok(result.stderr.includes('CHANGELOG'), `expected "CHANGELOG" in stderr, got: ${result.stderr}`)
	} finally {
		cleanup()
	}
})

test('exits 1 when CHANGELOG.md has no [Unreleased] section', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writePluginJson(tmpDir, '1.0.0')
		writeChangelog(tmpDir, { hasUnreleased: false })
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 1)
		assert.ok(
			result.stderr.includes('[Unreleased]') || result.stderr.includes('no ## [Unreleased]'),
			`expected [Unreleased] error, got: ${result.stderr}`
		)
	} finally {
		cleanup()
	}
})

test('exits 1 when [Unreleased] has no real entries (only "(none)")', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writePluginJson(tmpDir, '1.0.0')
		writeChangelog(tmpDir, { hasEntry: false })
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 1)
		assert.ok(
			result.stderr.includes('no entries') || result.stderr.includes('[Unreleased]'),
			`expected no-entries error, got: ${result.stderr}`
		)
	} finally {
		cleanup()
	}
})

// ── Happy path ────────────────────────────────────────────────────────────────

test('patch bump: increments patch, resets nothing', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writeFakePnpm(tmpDir)
		writePluginJson(tmpDir, '1.2.3')
		writeMarketplaceJson(tmpDir, '1.2.3')
		writeChangelog(tmpDir, { version: '1.2.3' })
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		const plugin = JSON.parse(readFileSync(path.join(tmpDir, '.claude-plugin', 'plugin.json'), 'utf8'))
		assert.strictEqual(plugin.version, '1.2.4')
	} finally {
		cleanup()
	}
})

test('minor bump: increments minor, resets patch to 0', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writeFakePnpm(tmpDir)
		writePluginJson(tmpDir, '1.2.3')
		writeMarketplaceJson(tmpDir, '1.2.3')
		writeChangelog(tmpDir, { version: '1.2.3' })
		const result = run(['minor'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		const plugin = JSON.parse(readFileSync(path.join(tmpDir, '.claude-plugin', 'plugin.json'), 'utf8'))
		assert.strictEqual(plugin.version, '1.3.0')
	} finally {
		cleanup()
	}
})

test('major bump: increments major, resets minor and patch to 0', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writeFakePnpm(tmpDir)
		writePluginJson(tmpDir, '1.2.3')
		writeMarketplaceJson(tmpDir, '1.2.3')
		writeChangelog(tmpDir, { version: '1.2.3' })
		const result = run(['major'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		const plugin = JSON.parse(readFileSync(path.join(tmpDir, '.claude-plugin', 'plugin.json'), 'utf8'))
		assert.strictEqual(plugin.version, '2.0.0')
	} finally {
		cleanup()
	}
})

test('bump promotes [Unreleased] section and leaves a fresh empty [Unreleased] — released section date matches YYYY-MM-DD', () => {
	const { tmpDir, env, cleanup } = makeTmpDir()
	try {
		const gitShim = writeFakeGit(tmpDir)
		writeFakePnpm(tmpDir)
		writePluginJson(tmpDir, '1.0.0')
		writeMarketplaceJson(tmpDir, '1.0.0')
		writeChangelog(tmpDir, { version: '1.0.0' })
		const result = run(['patch'], tmpDir, { ...env, _GIT_BIN: gitShim })
		assert.strictEqual(result.status, 0, `expected exit 0, stderr: ${result.stderr}`)
		const changelog = readFileSync(path.join(tmpDir, 'CHANGELOG.md'), 'utf8')
		assert.ok(changelog.includes('## [Unreleased]'), 'new [Unreleased] section should exist')
		assert.ok(changelog.includes('## [1.0.1]'), 'released section should exist')
		assert.match(changelog, /## \[1\.0\.1\] — \d{4}-\d{2}-\d{2}/, 'released section should have YYYY-MM-DD date')
		const unreleasedMatch = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[)/)
		assert.ok(unreleasedMatch, '[Unreleased] section should be followed by a versioned section')
		const unreleasedBody = unreleasedMatch[1]
		const bulletLines = unreleasedBody.split('\n').filter((l) => l.startsWith('- '))
		assert.ok(
			bulletLines.length > 0 && bulletLines.every((l) => l === '- (none)'),
			`fresh [Unreleased] should have only (none) entries, got: ${JSON.stringify(bulletLines)}`
		)
	} finally {
		cleanup()
	}
})
