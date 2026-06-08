// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectLandscape } from '../scripts/lib/landscape-detector.mjs'

/**
 * @param {Record<string, string>} [deps]
 * @param {Record<string, string>} [devDeps]
 * @param {object} [pkgOverrides]
 * @param {string[]} [rootFiles]
 */
function makeDeps(deps = {}, devDeps = {}, pkgOverrides = {}, rootFiles = []) {
	return {
		readFile: (/** @type {string} */ path) => {
			if (path.endsWith('package.json')) {
				return JSON.stringify({ dependencies: deps, devDependencies: devDeps, ...pkgOverrides })
			}
			return null
		},
		listDir: () => rootFiles,
	}
}

describe('detectLandscape', () => {
	it('returns empty Brief for a repo with no files', () => {
		const d = { readFile: () => null, listDir: () => [] }
		const brief = detectLandscape('/repo', [], d)
		assert.deepEqual(brief.stack, [])
		assert.deepEqual(brief.testSetup, [])
		assert.deepEqual(brief.tooling, [])
		assert.equal(brief.reachableProd, null)
		assert.deepEqual(brief.adjacentSystems, [])
	})

	it('detects React from dependencies', () => {
		const d = makeDeps({ react: '^18.0.0' })
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.stack.includes('React'))
	})

	it('detects Next.js from dependencies', () => {
		const d = makeDeps({ next: '^14.0.0', react: '^18.0.0' })
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.stack.includes('Next.js'))
		assert.ok(brief.stack.includes('React'))
	})

	it('detects TypeScript from devDependencies', () => {
		const d = makeDeps({}, { typescript: '^5.0.0' })
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.stack.includes('TypeScript'))
	})

	it('detects jest from devDependencies in testSetup', () => {
		const d = makeDeps({}, { jest: '^29.0.0' })
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.testSetup.includes('jest'))
	})

	it('detects vitest from devDependencies in testSetup', () => {
		const d = makeDeps({}, { vitest: '^1.0.0' })
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.testSetup.includes('vitest'))
	})

	it('detects playwright from devDependencies in testSetup', () => {
		const d = makeDeps({}, { '@playwright/test': '^1.0.0' })
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.testSetup.includes('playwright'))
	})

	it('deduplicates: react and react-dom both map to React but appear once', () => {
		const d = makeDeps({ react: '^18.0.0', 'react-dom': '^18.0.0' })
		const brief = detectLandscape('/repo', [], d)
		assert.equal(brief.stack.filter((s) => s === 'React').length, 1)
	})

	it('detects Rust when Cargo.toml is in root listing', () => {
		const d = makeDeps({}, {}, {}, ['Cargo.toml'])
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.stack.includes('Rust'))
	})

	it('detects Python when pyproject.toml is in root listing', () => {
		const d = makeDeps({}, {}, {}, ['pyproject.toml'])
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.stack.includes('Python'))
	})

	it('detects docker tooling when Dockerfile is in root listing', () => {
		const d = makeDeps({}, {}, {}, ['Dockerfile'])
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.tooling.includes('docker'))
	})

	it('detects pnpm from packageManager field, stripping version suffix', () => {
		const d = makeDeps({}, {}, { packageManager: 'pnpm@10.33.2' })
		const brief = detectLandscape('/repo', [], d)
		assert.ok(brief.tooling.includes('pnpm'))
		assert.ok(!brief.tooling.includes('pnpm@10.33.2'))
	})

	it('sets reachableProd true when homepage is set in package.json', () => {
		const d = makeDeps({}, {}, { homepage: 'https://example.com' })
		const brief = detectLandscape('/repo', [], d)
		assert.equal(brief.reachableProd, true)
	})

	it('sets reachableProd true when .env.production is in root listing', () => {
		const d = makeDeps({}, {}, {}, ['.env.production'])
		const brief = detectLandscape('/repo', [], d)
		assert.equal(brief.reachableProd, true)
	})

	it('sets reachableProd null when no prod signals found', () => {
		const d = makeDeps()
		const brief = detectLandscape('/repo', [], d)
		assert.equal(brief.reachableProd, null)
	})

	it('passes adjacentSystems through unchanged', () => {
		const d = makeDeps()
		const brief = detectLandscape('/repo', ['.NET backend', 'Contentful CMS'], d)
		assert.deepEqual(brief.adjacentSystems, ['.NET backend', 'Contentful CMS'])
	})

	it('handles invalid package.json JSON gracefully (returns empty arrays, not throw)', () => {
		const d = {
			readFile: () => 'not-json{{{',
			listDir: () => [],
		}
		const brief = detectLandscape('/repo', [], d)
		assert.deepEqual(brief.stack, [])
		assert.deepEqual(brief.testSetup, [])
		assert.deepEqual(brief.tooling, [])
		assert.equal(brief.reachableProd, null)
	})

	it('handles missing package.json gracefully (readFile returns null)', () => {
		const d = { readFile: () => null, listDir: () => [] }
		const brief = detectLandscape('/repo', [], d)
		assert.deepEqual(brief.stack, [])
	})

	it('handles empty package.json object gracefully', () => {
		const d = makeDeps({}, {}, {})
		const brief = detectLandscape('/repo', [], d)
		assert.deepEqual(brief.stack, [])
		assert.deepEqual(brief.testSetup, [])
	})
})
