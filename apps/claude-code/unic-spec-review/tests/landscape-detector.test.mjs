// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectLandscape } from '../scripts/lib/landscape-detector.mjs'

/** @import { LandscapeDetectorDeps } from '../scripts/lib/landscape-detector.mjs' */

/**
 * Build a minimal in-memory filesystem stub. Keys are absolute paths; values
 * are file contents. readdirSync returns only entries directly within a dir.
 * @param {Record<string, string>} files
 * @returns {LandscapeDetectorDeps}
 */
function stubFs(files) {
	return {
		existsSync: (p) =>
			Object.prototype.hasOwnProperty.call(files, p) || Object.keys(files).some((f) => f.startsWith(`${p}/`)),
		readFileSync: (p) => {
			if (!Object.prototype.hasOwnProperty.call(files, p)) throw new Error(`ENOENT: ${p}`)
			return files[p]
		},
		readdirSync: (dir) =>
			Object.keys(files)
				.filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
				.map((p) => p.slice(dir.length + 1)),
	}
}

describe('detectLandscape', () => {
	it('returns unknown runner and empty stack when no manifest files exist', () => {
		const brief = detectLandscape('/repo', [], stubFs({}))
		assert.deepEqual(brief.stack, [])
		assert.equal(brief.testRunner, 'unknown')
		assert.deepEqual(brief.testFrameworks, [])
		assert.deepEqual(brief.tooling, [])
		assert.equal(brief.reachableProd, false)
		assert.deepEqual(brief.adjacentSystems, [])
	})

	it('detects Node.js and TypeScript from package.json + tsconfig.json', () => {
		const pkg = JSON.stringify({ name: 'app', dependencies: {}, devDependencies: { typescript: '5.0.0' } })
		const brief = detectLandscape(
			'/repo',
			[],
			stubFs({
				'/repo/package.json': pkg,
				'/repo/tsconfig.json': '{}',
			})
		)
		assert.ok(brief.stack.includes('Node.js'))
		assert.ok(brief.stack.includes('TypeScript'))
	})

	it('detects React from package.json dependencies', () => {
		const pkg = JSON.stringify({ dependencies: { react: '18.0.0', 'react-dom': '18.0.0' } })
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/package.json': pkg }))
		assert.ok(brief.stack.includes('React'))
	})

	it('detects jest as test runner from devDependencies', () => {
		const pkg = JSON.stringify({ devDependencies: { jest: '29.0.0' } })
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/package.json': pkg }))
		assert.equal(brief.testRunner, 'jest')
	})

	it('detects vitest and prefers it over jest when both present', () => {
		const pkg = JSON.stringify({ devDependencies: { vitest: '1.0.0', jest: '29.0.0' } })
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/package.json': pkg }))
		assert.equal(brief.testRunner, 'vitest')
	})

	it('detects node:test runner from test script', () => {
		const pkg = JSON.stringify({ scripts: { test: 'node --test tests/*.test.mjs' }, devDependencies: {} })
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/package.json': pkg }))
		assert.equal(brief.testRunner, 'node:test')
	})

	it('detects Playwright and sets reachableProd=true', () => {
		const pkg = JSON.stringify({ devDependencies: { '@playwright/test': '1.40.0' } })
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/package.json': pkg }))
		assert.equal(brief.reachableProd, true)
		assert.ok(brief.testFrameworks.includes('Playwright'))
	})

	it('detects playwright.config.js and sets reachableProd=true', () => {
		const pkg = JSON.stringify({ devDependencies: {} })
		const brief = detectLandscape(
			'/repo',
			[],
			stubFs({
				'/repo/package.json': pkg,
				'/repo/playwright.config.js': 'module.exports = {}',
			})
		)
		assert.equal(brief.reachableProd, true)
	})

	it('detects Biome and ESLint as tooling', () => {
		const pkg = JSON.stringify({ devDependencies: { '@biomejs/biome': '2.0.0', eslint: '8.0.0' } })
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/package.json': pkg }))
		assert.ok(brief.tooling.includes('Biome'))
		assert.ok(brief.tooling.includes('ESLint'))
	})

	it('detects Python from pyproject.toml', () => {
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/pyproject.toml': '[tool.pytest.ini_options]' }))
		assert.ok(brief.stack.includes('Python'))
	})

	it('detects pytest runner from pyproject.toml content', () => {
		const brief = detectLandscape(
			'/repo',
			[],
			stubFs({ '/repo/pyproject.toml': '[tool.pytest.ini_options]\nminversion = "6.0"' })
		)
		assert.equal(brief.testRunner, 'pytest')
	})

	it('detects Python from requirements.txt', () => {
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/requirements.txt': 'flask==3.0.0' }))
		assert.ok(brief.stack.includes('Python'))
	})

	it('detects Rust from Cargo.toml', () => {
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/Cargo.toml': '[package]\nname = "my-crate"' }))
		assert.ok(brief.stack.includes('Rust'))
	})

	it('detects Go from go.mod', () => {
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/go.mod': 'module example.com/app\n\ngo 1.21' }))
		assert.ok(brief.stack.includes('Go'))
	})

	it('detects Ruby and Rails from Gemfile', () => {
		const brief = detectLandscape(
			'/repo',
			[],
			stubFs({ '/repo/Gemfile': "source 'https://rubygems.org'\ngem 'rails'" })
		)
		assert.ok(brief.stack.includes('Ruby'))
		assert.ok(brief.stack.includes('Rails'))
	})

	it('detects Java from pom.xml', () => {
		const brief = detectLandscape('/repo', [], stubFs({ '/repo/pom.xml': '<project></project>' }))
		assert.ok(brief.stack.includes('Java'))
	})

	it('passes through adjacentSystems unchanged', () => {
		const brief = detectLandscape('/repo', ['.NET API', 'CMS'], stubFs({}))
		assert.deepEqual(brief.adjacentSystems, ['.NET API', 'CMS'])
	})

	it('returns a copy of adjacentSystems (not a reference)', () => {
		const input = ['SomeSystem']
		const brief = detectLandscape('/repo', input, stubFs({}))
		input.push('Another')
		assert.equal(brief.adjacentSystems.length, 1)
	})

	it('does not throw on malformed package.json', () => {
		assert.doesNotThrow(() => detectLandscape('/repo', [], stubFs({ '/repo/package.json': '{invalid json}' })))
	})

	it('does not throw when readdirSync fails', () => {
		/** @type {LandscapeDetectorDeps} */
		const deps = {
			existsSync: (p) => p.endsWith('package.json'),
			readFileSync: () => JSON.stringify({ devDependencies: {} }),
			readdirSync: () => {
				throw new Error('permission denied')
			},
		}
		assert.doesNotThrow(() => detectLandscape('/repo', [], deps))
	})
})
