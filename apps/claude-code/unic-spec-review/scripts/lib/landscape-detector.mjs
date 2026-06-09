// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * landscape-detector.mjs - derive a Landscape Brief from repo manifests.
 *
 * Pure library: detectLandscape() inspects manifest files and the file listing
 * at a repository root plus user-declared out-of-repo systems, and returns a
 * structured LandscapeBrief (stack, test setup, tooling, reachable-prod flag,
 * adjacent systems). The technology landscape is never hardcoded - everything is
 * read from the repo. All filesystem access goes through injectable deps so unit
 * tests touch no real files; the function never throws.
 *
 * CLI entry: node landscape-detector.mjs [repo-root] — prints the LandscapeBrief
 * as JSON to stdout. Default repo root is '.'.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * @typedef {'node:test' | 'vitest' | 'jest' | 'playwright' | 'pytest' | 'unknown'} TestRunner
 */

/**
 * @typedef {Object} LandscapeBrief
 * @property {string[]} stack - detected technologies and frameworks
 * @property {TestRunner} testRunner - primary test runner
 * @property {string[]} testFrameworks - additional testing libraries detected
 * @property {string[]} tooling - detected dev tools (linters, formatters, bundlers)
 * @property {boolean} reachableProd - true if E2E/prod-access tooling is detected
 * @property {string[]} adjacentSystems - user-declared out-of-repo systems
 */

/**
 * @typedef {Object} LandscapeDetectorDeps
 * @property {(path: string) => boolean} [existsSync]
 * @property {(path: string, encoding: 'utf8') => string} [readFileSync]
 */

/**
 * Read and parse a JSON file. Returns null on any error (missing file, parse
 * failure); never throws.
 * @param {string} filePath
 * @param {LandscapeDetectorDeps} deps
 * @returns {unknown | null}
 */
function tryReadJson(filePath, deps) {
	const exists = deps.existsSync ?? existsSync
	const read = deps.readFileSync ?? readFileSync
	try {
		if (!exists(filePath)) return null
		return JSON.parse(read(filePath, 'utf8'))
	} catch {
		return null
	}
}

/**
 * Read a text file. Returns null on any error; never throws.
 * @param {string} filePath
 * @param {LandscapeDetectorDeps} deps
 * @returns {string | null}
 */
function tryReadText(filePath, deps) {
	const exists = deps.existsSync ?? existsSync
	const read = deps.readFileSync ?? readFileSync
	try {
		if (!exists(filePath)) return null
		return read(filePath, 'utf8')
	} catch {
		return null
	}
}

/**
 * Test whether a path exists. Returns false on any error; never throws.
 * @param {string} filePath
 * @param {LandscapeDetectorDeps} deps
 * @returns {boolean}
 */
function tryExists(filePath, deps) {
	const exists = deps.existsSync ?? existsSync
	try {
		return exists(filePath)
	} catch {
		return false
	}
}

/**
 * Extract all dependency keys from a parsed package.json.
 * @param {unknown} pkg
 * @returns {Set<string>}
 */
function allDeps(pkg) {
	if (!pkg || typeof pkg !== 'object') return new Set()
	const p = /** @type {Record<string, unknown>} */ (pkg)
	const deps = {
		.../** @type {object} */ (p.dependencies ?? {}),
		.../** @type {object} */ (p.devDependencies ?? {}),
		.../** @type {object} */ (p.peerDependencies ?? {}),
	}
	return new Set(Object.keys(deps))
}

/**
 * Detect the primary test runner from a package.json and its dependency set.
 * @param {unknown} pkg
 * @param {Set<string>} deps
 * @returns {TestRunner}
 */
function detectTestRunner(pkg, deps) {
	const rawScripts = /** @type {any} */ (pkg)?.scripts
	const scripts = rawScripts && typeof rawScripts === 'object' ? /** @type {Record<string, string>} */ (rawScripts) : {}
	const testScript = scripts.test ?? ''

	// Script is the most authoritative signal — check before dep presence
	if (typeof testScript === 'string' && testScript.includes('node --test')) return 'node:test'
	if (deps.has('vitest')) return 'vitest'
	if (deps.has('jest') || deps.has('@jest/core')) return 'jest'
	if (deps.has('@playwright/test')) return 'playwright'
	return 'unknown'
}

/**
 * Derive stack entries from a package.json dependency set.
 * @param {Set<string>} deps
 * @returns {string[]}
 */
function stackFromNodeDeps(deps) {
	/** @type {string[]} */
	const stack = ['Node.js']
	/** @type {[string[], string][]} */
	const frameworkMap = [
		[['react', 'react-dom'], 'React'],
		[['vue'], 'Vue'],
		[['svelte'], 'Svelte'],
		[['@angular/core'], 'Angular'],
		[['next'], 'Next.js'],
		[['nuxt', '@nuxt/core'], 'Nuxt'],
		[['express'], 'Express'],
		[['fastify'], 'Fastify'],
		[['koa'], 'Koa'],
		[['@nestjs/core'], 'NestJS'],
		[['astro'], 'Astro'],
		[['remix', '@remix-run/react'], 'Remix'],
		[['solid-js'], 'SolidJS'],
		[['qwik', '@builder.io/qwik'], 'Qwik'],
	]
	for (const [keys, label] of frameworkMap) {
		if (keys.some((k) => deps.has(k))) stack.push(label)
	}
	return stack
}

/**
 * Detect dev tooling (linters, formatters, bundlers) from a dependency set.
 * @param {Set<string>} deps
 * @returns {string[]}
 */
function detectTooling(deps) {
	/** @type {string[]} */
	const tooling = []
	/** @type {[string[], string][]} */
	const toolMap = [
		[['@biomejs/biome', 'biome'], 'Biome'],
		[['eslint'], 'ESLint'],
		[['prettier'], 'Prettier'],
		[['webpack', 'webpack-cli'], 'webpack'],
		[['vite'], 'Vite'],
		[['rollup'], 'Rollup'],
		[['esbuild'], 'esbuild'],
		[['turbo'], 'Turborepo'],
		[['@swc/core', 'swc'], 'SWC'],
		[['tsup'], 'tsup'],
	]
	for (const [keys, label] of toolMap) {
		if (keys.some((k) => deps.has(k))) tooling.push(label)
	}
	return tooling
}

/**
 * Detect additional testing libraries from a dependency set.
 * @param {Set<string>} deps
 * @returns {string[]}
 */
function detectTestFrameworks(deps) {
	/** @type {string[]} */
	const frameworks = []
	/** @type {[string[], string][]} */
	const map = [
		[['@testing-library/react', '@testing-library/dom', '@testing-library/vue'], 'Testing Library'],
		[['cypress'], 'Cypress'],
		[['msw'], 'MSW'],
		[['supertest'], 'Supertest'],
		[['nock'], 'Nock'],
	]
	for (const [keys, label] of map) {
		if (keys.some((k) => deps.has(k))) frameworks.push(label)
	}
	return frameworks
}

/**
 * Detect the technology landscape from a repository root.
 * Stateless, injectable — all I/O goes through deps; never throws.
 * @param {string} repoRoot - absolute path to the repo root
 * @param {string[]} [adjacentSystems] - user-declared out-of-repo systems
 * @param {LandscapeDetectorDeps} [deps]
 * @returns {LandscapeBrief}
 */
export function detectLandscape(repoRoot, adjacentSystems = [], deps = {}) {
	/** @type {string[]} */
	let stack = []
	/** @type {TestRunner} */
	let testRunner = 'unknown'
	/** @type {string[]} */
	let testFrameworks = []
	/** @type {string[]} */
	let tooling = []
	let reachableProd = false

	// Node.js project detection
	const pkg = tryReadJson(join(repoRoot, 'package.json'), deps)
	if (pkg !== null) {
		const nodeDeps = allDeps(pkg)
		stack = stackFromNodeDeps(nodeDeps)
		// TypeScript: tsconfig.json OR typescript in deps
		if (tryExists(join(repoRoot, 'tsconfig.json'), deps) || nodeDeps.has('typescript')) {
			stack.push('TypeScript')
		}
		testRunner = detectTestRunner(pkg, nodeDeps)
		testFrameworks = detectTestFrameworks(nodeDeps)
		tooling = detectTooling(nodeDeps)
		// reachableProd: E2E tooling that could reach a production-like environment
		const playwrightConfigs = [
			'playwright.config.js',
			'playwright.config.ts',
			'playwright.config.mjs',
			'playwright.config.cjs',
		]
		reachableProd =
			nodeDeps.has('@playwright/test') ||
			nodeDeps.has('playwright') ||
			nodeDeps.has('cypress') ||
			playwrightConfigs.some((f) => tryExists(join(repoRoot, f), deps))
	}

	// Python
	const hasPyproject = tryExists(join(repoRoot, 'pyproject.toml'), deps)
	const hasRequirements = tryExists(join(repoRoot, 'requirements.txt'), deps)
	if (hasPyproject || hasRequirements) {
		if (!stack.includes('Python')) stack.push('Python')
		if (hasPyproject) {
			const pyprojectText = tryReadText(join(repoRoot, 'pyproject.toml'), deps)
			if (pyprojectText) {
				if (pyprojectText.includes('pytest') && testRunner === 'unknown') testRunner = 'pytest'
				if (pyprojectText.includes('django') && !stack.includes('Django')) stack.push('Django')
				if (pyprojectText.includes('fastapi') && !stack.includes('FastAPI')) stack.push('FastAPI')
				if (pyprojectText.includes('flask') && !stack.includes('Flask')) stack.push('Flask')
			}
		}
	}

	// Rust
	if (tryExists(join(repoRoot, 'Cargo.toml'), deps)) {
		if (!stack.includes('Rust')) stack.push('Rust')
	}

	// Go
	if (tryExists(join(repoRoot, 'go.mod'), deps)) {
		if (!stack.includes('Go')) stack.push('Go')
	}

	// Ruby
	if (tryExists(join(repoRoot, 'Gemfile'), deps)) {
		if (!stack.includes('Ruby')) stack.push('Ruby')
		const gemfile = tryReadText(join(repoRoot, 'Gemfile'), deps)
		if (gemfile?.includes('rails') && !stack.includes('Rails')) stack.push('Rails')
	}

	// Java
	if (tryExists(join(repoRoot, 'pom.xml'), deps) || tryExists(join(repoRoot, 'build.gradle'), deps)) {
		if (!stack.includes('Java')) stack.push('Java')
	}

	return { stack, testRunner, testFrameworks, tooling, reachableProd, adjacentSystems: [...adjacentSystems] }
}

// CLI entry: prints the LandscapeBrief as JSON to stdout.
// argv[2] = repo root path (default '.').
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const repoRoot = process.argv[2] ?? '.'
		const brief = detectLandscape(repoRoot)
		process.stdout.write(`${JSON.stringify(brief)}\n`)
	} catch (err) {
		process.stderr.write(`landscape-detector: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	}
}
