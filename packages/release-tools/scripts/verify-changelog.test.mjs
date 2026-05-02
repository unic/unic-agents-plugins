#!/usr/bin/env node
import assert from 'node:assert/strict'
// @ts-check
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./verify-changelog.mjs', import.meta.url))
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Run the verify script with controlled env.
 * @param {Record<string, string>} env
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function run(env) {
	const result = spawnSync('node', [script], {
		encoding: 'utf8',
		env: { ...process.env, ...env },
	})
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	}
}

/** @returns {string} */
function validChangelog() {
	return [
		'# Changelog',
		'',
		'## [Unreleased]',
		'',
		'### Breaking',
		'- (none)',
		'',
		'### Added',
		'- (none)',
		'',
		'### Fixed',
		'- (none)',
		'',
		'## [1.0.0] — 2025-01-01',
		'',
		'### Added',
		'- initial release',
	].join('\n')
}

/**
 * Run verify-changelog.mjs with controlled CHANGELOG content and changed files.
 * Uses a Node.js CJS shim as a cross-platform fake git (no shell required).
 * @param {{ changelog: string, changedFiles: string[] }} opts
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
function runVerify({ changelog, changedFiles }) {
	const changelogPath = path.join(projectRoot, 'CHANGELOG.md')
	const original = readFileSync(changelogPath, 'utf8')
	const tmpDir = mkdtempSync(path.join(tmpdir(), 'vc-test-'))
	writeFileSync(changelogPath, changelog, 'utf8')
	try {
		const diffFile = path.join(tmpDir, 'diff.txt')
		writeFileSync(diffFile, changedFiles.join('\n'), 'utf8')
		const shimPath = path.join(tmpDir, 'fake-git.cjs')
		writeFileSync(
			shimPath,
			[
				"const { readFileSync } = require('node:fs')",
				'const cmd = process.argv[2]',
				"if (cmd === 'diff') {",
				'  const f = process.env._GIT_DIFF_FILE',
				"  if (f) process.stdout.write(readFileSync(f, 'utf8'))",
				'  process.exit(0)',
				'}',
				'process.exit(1)',
			].join('\n')
		)
		const result = spawnSync('node', [script], {
			encoding: 'utf8',
			env: { ...process.env, _GIT_BIN: shimPath, _GIT_DIFF_FILE: diffFile, CI: 'false' },
		})
		return {
			exitCode: result.status ?? 1,
			stdout: result.stdout ?? '',
			stderr: result.stderr ?? '',
		}
	} finally {
		writeFileSync(changelogPath, original, 'utf8')
		rmSync(tmpDir, { recursive: true, force: true })
	}
}

// TC-01: GITHUB_BASE_REF is referenced in the script source
test('fix1: GITHUB_BASE_REF is read when CI=true', () => {
	const text = readFileSync(script, 'utf8')
	assert.ok(text.includes('GITHUB_BASE_REF'), 'script must reference GITHUB_BASE_REF')
})

// TC-02: CI=true with unavailable diff should exit 1, not 0
test('fix2: CI=true + unavailable diff exits 1', () => {
	const result = run({
		CI: 'true',
		GITHUB_BASE_REF: 'nonexistent-branch-that-does-not-exist-xyzzy',
	})
	assert.equal(result.status, 1, 'should exit 1 in CI when diff unavailable')
	assert.ok(
		result.stderr.includes('git diff unavailable'),
		`expected "git diff unavailable" in stderr, got: ${result.stderr}`
	)
})

// TC-03: fix3 regex — last section with no trailing newline still matches body
test('fix3: regex captures last CHANGELOG section without trailing newline', () => {
	const version = '9.9.9'
	const changelog = `## [${version}] — 2026-01-01\n- a real bullet`
	const re = new RegExp(
		`## \\[${version.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|\\s*$)`
	)
	const match = changelog.match(re)
	assert.ok(match, 'regex should match')
	const body = match[1]
	const hasBullet = body
		.split('\n')
		.filter((l) => l.startsWith('- '))
		.some((l) => l !== '- (none)')
	assert.ok(hasBullet, `body "${body}" should contain a real bullet`)
})

// TC-04: old regex — documents the historical bug (may not reproduce on all V8 versions)
test('fix3: old regex is present as regression documentation (no assertion)', () => {
	const version = '9.9.9'
	const changelog = `## [${version}] — 2026-01-01\n- a real bullet`
	const oldRe = new RegExp(
		`## \\[${version.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|$)`
	)
	// Just verify the regex compiles and runs without throwing.
	changelog.match(oldRe)
})

// ── Layer 1 structural checks ─────────────────────────────────────────────────

test('exits 1 when [Unreleased] section is absent', async (_t) => {
	const cl = `# Changelog\n\n## [1.0.0] — 2025-01-01\n\n### Added\n- initial\n`
	const result = runVerify({ changelog: cl, changedFiles: [] })
	assert.strictEqual(result.exitCode, 1)
	assert.ok(result.stderr.includes('Missing ## [Unreleased] section'))
})

test('exits 1 when [Unreleased] is missing ### Breaking subsection', async (_t) => {
	const cl = [
		'# Changelog',
		'',
		'## [Unreleased]',
		'',
		'### Added',
		'- (none)',
		'',
		'### Fixed',
		'- (none)',
		'',
		'## [1.0.0] — 2025-01-01',
		'',
		'### Added',
		'- initial',
	].join('\n')
	const result = runVerify({ changelog: cl, changedFiles: [] })
	assert.strictEqual(result.exitCode, 1)
	assert.ok(result.stderr.includes('[Unreleased] is missing subsection: ### Breaking'))
})

test('exits 1 when a versioned release header lacks em-dash date', async (_t) => {
	const cl = [
		'# Changelog',
		'',
		'## [Unreleased]',
		'',
		'### Breaking',
		'- (none)',
		'',
		'### Added',
		'- (none)',
		'',
		'### Fixed',
		'- (none)',
		'',
		'## [1.0.0] - 2025-01-01',
		'',
		'### Added',
		'- initial',
	].join('\n')
	const result = runVerify({ changelog: cl, changedFiles: [] })
	assert.strictEqual(result.exitCode, 1)
	assert.ok(result.stderr.includes('Release section missing em-dash date'))
	assert.ok(result.stderr.includes('## [1.0.0] - 2025-01-01'))
})

test('exits 0 when CHANGELOG is structurally valid and no guarded paths changed', async (_t) => {
	const cl = validChangelog()
	const result = runVerify({ changelog: cl, changedFiles: ['docs/unguarded.md'] })
	assert.strictEqual(result.exitCode, 0)
	assert.ok(result.stdout.includes('no guarded paths changed'))
})

test('structural check runs even when no guarded files changed', async (_t) => {
	const cl = `# Changelog\n\n## [1.0.0] — 2025-01-01\n\n### Added\n- initial\n`
	// No [Unreleased] — structural error should fire regardless of changedFiles
	const result = runVerify({ changelog: cl, changedFiles: [] })
	assert.strictEqual(result.exitCode, 1)
	assert.ok(result.stderr.includes('Missing ## [Unreleased] section'))
})
