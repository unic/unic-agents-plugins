// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * @typedef {Object} LandscapeBrief
 * @property {string[]} stack - detected technologies (e.g. 'Next.js', 'TypeScript', 'React')
 * @property {string[]} testSetup - detected test frameworks (e.g. 'jest', 'vitest', 'playwright')
 * @property {string[]} tooling - detected build/dev tooling (e.g. 'vite', 'biome', 'docker')
 * @property {boolean | null} reachableProd - true if a production URL was inferred; null if unknown
 * @property {string[]} adjacentSystems - user-declared adjacent systems (passed through, not detected)
 */

/**
 * @typedef {Object} DetectorDeps
 * @property {(path: string) => string | null} [readFile] - read file, return null if missing
 * @property {(dir: string) => string[]} [listDir] - list dir entries, return [] if missing
 */

const STACK_HINTS = new Map([
	['next', 'Next.js'],
	['react', 'React'],
	['react-dom', 'React'],
	['vue', 'Vue'],
	['@vue/core', 'Vue'],
	['nuxt', 'Nuxt'],
	['svelte', 'Svelte'],
	['@sveltejs/kit', 'SvelteKit'],
	['angular', 'Angular'],
	['@angular/core', 'Angular'],
	['express', 'Express'],
	['fastify', 'Fastify'],
	['koa', 'Koa'],
	['@nestjs/core', 'NestJS'],
	['typescript', 'TypeScript'],
	['graphql', 'GraphQL'],
	['@prisma/client', 'Prisma'],
	['prisma', 'Prisma'],
	['mongoose', 'MongoDB/Mongoose'],
	['drizzle-orm', 'Drizzle ORM'],
	['gatsby', 'Gatsby'],
	['@remix-run/react', 'Remix'],
	['astro', 'Astro'],
	['tailwindcss', 'Tailwind CSS'],
	['styled-components', 'styled-components'],
	['@mui/material', 'Material UI'],
	['@chakra-ui/react', 'Chakra UI'],
	['@trpc/server', 'tRPC'],
	['stripe', 'Stripe'],
	['three', 'Three.js'],
])

const TEST_HINTS = new Map([
	['jest', 'jest'],
	['@jest/core', 'jest'],
	['vitest', 'vitest'],
	['@playwright/test', 'playwright'],
	['playwright', 'playwright'],
	['cypress', 'cypress'],
	['mocha', 'mocha'],
	['jasmine', 'jasmine'],
	['ava', 'ava'],
	['@testing-library/react', 'testing-library'],
	['@testing-library/vue', 'testing-library'],
	['supertest', 'supertest'],
	['@storybook/react', 'storybook'],
	['@storybook/vue3', 'storybook'],
	['storybook', 'storybook'],
	['msw', 'msw'],
])

const TOOLING_HINTS = new Map([
	['vite', 'vite'],
	['@vitejs/plugin-react', 'vite'],
	['webpack', 'webpack'],
	['rollup', 'rollup'],
	['esbuild', 'esbuild'],
	['turbo', 'turborepo'],
	['nx', 'nx'],
	['eslint', 'eslint'],
	['@biomejs/biome', 'biome'],
	['biome', 'biome'],
	['prettier', 'prettier'],
	['husky', 'husky'],
])

const FILE_STACK_HINTS = new Map([
	['Cargo.toml', 'Rust'],
	['pyproject.toml', 'Python'],
	['requirements.txt', 'Python'],
	['setup.py', 'Python'],
	['go.mod', 'Go'],
	['composer.json', 'PHP'],
	['Gemfile', 'Ruby'],
	['pom.xml', 'Java (Maven)'],
	['build.gradle', 'Java (Gradle)'],
])

const FILE_TOOLING_HINTS = new Map([
	['Dockerfile', 'docker'],
	['docker-compose.yml', 'docker-compose'],
	['docker-compose.yaml', 'docker-compose'],
	['Makefile', 'make'],
	['.github', 'github-actions'],
])

/**
 * @param {string} path
 * @returns {string | null}
 */
function safeReadFile(path) {
	try {
		return readFileSync(path, 'utf8')
	} catch {
		return null
	}
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function safeListDir(dir) {
	try {
		return readdirSync(dir)
	} catch {
		return []
	}
}

/**
 * @param {string | null} text
 * @returns {any}
 */
function tryParseJson(text) {
	if (!text) return null
	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}

/**
 * @param {string[]} arr
 * @returns {string[]}
 */
function dedupe(arr) {
	return [...new Set(arr)]
}

/**
 * @param {string[]} depKeys
 * @param {Map<string, string>} hintMap
 * @returns {string[]}
 */
function collectHints(depKeys, hintMap) {
	const out = []
	for (const key of depKeys) {
		const label = hintMap.get(key)
		if (label) out.push(label)
	}
	return out
}

/**
 * @param {Record<string, string> | null | undefined} allDeps
 * @param {string[]} rootEntries
 * @returns {string[]}
 */
function detectStack(allDeps, rootEntries) {
	const fromDeps = collectHints(Object.keys(allDeps ?? {}), STACK_HINTS)
	const fromFiles = /** @type {string[]} */ (
		rootEntries.map((e) => FILE_STACK_HINTS.get(e)).filter((v) => v !== undefined)
	)
	return dedupe([...fromDeps, ...fromFiles])
}

/**
 * @param {Record<string, string> | null | undefined} allDeps
 * @param {string[]} rootEntries
 * @returns {string[]}
 */
function detectTestSetup(allDeps, rootEntries) {
	return dedupe(collectHints(Object.keys(allDeps ?? {}), TEST_HINTS))
}

/**
 * @param {Record<string, string> | null | undefined} allDeps
 * @param {string | undefined} packageManager
 * @param {string[]} rootEntries
 * @returns {string[]}
 */
function detectTooling(allDeps, packageManager, rootEntries) {
	const fromDeps = collectHints(Object.keys(allDeps ?? {}), TOOLING_HINTS)
	const fromFiles = /** @type {string[]} */ (
		rootEntries.map((e) => FILE_TOOLING_HINTS.get(e)).filter((v) => v !== undefined)
	)
	const pm = typeof packageManager === 'string' ? packageManager.split('@')[0] : null
	return dedupe([...fromDeps, ...fromFiles, ...(pm ? [pm] : [])])
}

/**
 * @param {any} pkgJson
 * @param {string[]} rootEntries
 * @returns {boolean | null}
 */
function detectReachableProd(pkgJson, rootEntries) {
	if (pkgJson?.homepage) return true
	if (rootEntries.includes('.env.production') || rootEntries.includes('.env.prod')) return true
	return null
}

/**
 * Produce a LandscapeBrief from repo manifests, file listing, and declared
 * adjacent systems. Never hardcodes stack assumptions; reads from actual files.
 * @param {string} repoRoot
 * @param {string[]} [adjacentSystems]
 * @param {DetectorDeps} [deps]
 * @returns {LandscapeBrief}
 */
export function detectLandscape(repoRoot, adjacentSystems = [], deps = {}) {
	const readFile = deps.readFile ?? safeReadFile
	const listDir = deps.listDir ?? safeListDir

	const pkgJson = tryParseJson(readFile(join(repoRoot, 'package.json')))
	const rootEntries = listDir(repoRoot)

	const allDeps = {
		...(pkgJson?.dependencies ?? {}),
		...(pkgJson?.devDependencies ?? {}),
	}

	return {
		stack: detectStack(allDeps, rootEntries),
		testSetup: detectTestSetup(allDeps, rootEntries),
		tooling: detectTooling(allDeps, pkgJson?.packageManager, rootEntries),
		reachableProd: detectReachableProd(pkgJson, rootEntries),
		adjacentSystems: Array.isArray(adjacentSystems) ? adjacentSystems : [],
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const argv = process.argv.slice(2)
	let cwd = process.cwd()
	/** @type {string[]} */
	const adjacentSystems = []
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--cwd' && argv[i + 1]) {
			cwd = argv[++i]
		} else if (argv[i] === '--adjacent' && argv[i + 1]) {
			const systems = argv[++i]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
			adjacentSystems.push(...systems)
		}
	}
	const brief = detectLandscape(cwd, adjacentSystems)
	process.stdout.write(`${JSON.stringify(brief)}\n`)
}
