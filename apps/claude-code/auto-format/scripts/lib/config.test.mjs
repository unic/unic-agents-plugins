// @ts-check
import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DEFAULTS, loadConfig } from './config.mjs'

/**
 * Creates a temp directory to act as the consumer project root.
 * Caller must rmSync(dir) in a finally block.
 *
 * @returns {string}
 */
function makeProjectDir() {
	return mkdtempSync(join(tmpdir(), 'config-test-'))
}

/**
 * Writes `.claude/unic-format.json` into dir with the given content.
 *
 * @param {string} dir
 * @param {unknown} content
 */
function writeConfig(dir, content) {
	mkdirSync(join(dir, '.claude'), { recursive: true })
	writeFileSync(join(dir, '.claude', 'unic-format.json'), JSON.stringify(content))
}

test('returns DEFAULTS when no config file exists', () => {
	const dir = makeProjectDir()
	try {
		deepStrictEqual(loadConfig(dir), DEFAULTS)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('returns DEFAULTS and writes stderr on malformed JSON', () => {
	const dir = makeProjectDir()
	const stderrLines = /** @type {string[]} */ ([])
	const orig = process.stderr.write.bind(process.stderr)
	process.stderr.write = (/** @type {string} */ s) => {
		stderrLines.push(String(s))
		return true
	}
	try {
		mkdirSync(join(dir, '.claude'), { recursive: true })
		writeFileSync(join(dir, '.claude', 'unic-format.json'), '{not valid json')
		deepStrictEqual(loadConfig(dir), DEFAULTS)
		strictEqual(stderrLines.length, 1)
		ok(stderrLines[0].includes('malformed'))
	} finally {
		process.stderr.write = orig
		rmSync(dir, { recursive: true, force: true })
	}
})

test('full skipPrefixes replacement when non-empty array provided', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { skipPrefixes: ['custom/'] })
		const cfg = loadConfig(dir)
		deepStrictEqual(cfg.skipPrefixes, ['custom/'])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('additionalSkipPrefixes appends to DEFAULTS when no skipPrefixes given', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { additionalSkipPrefixes: ['extra/'] })
		const cfg = loadConfig(dir)
		deepStrictEqual(cfg.skipPrefixes, [...DEFAULTS.skipPrefixes, 'extra/'])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('uses DEFAULTS.skipPrefixes when neither field is provided', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, {})
		const cfg = loadConfig(dir)
		deepStrictEqual(cfg.skipPrefixes, DEFAULTS.skipPrefixes)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('clamps formatTimeoutMs to minimum 1000', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatTimeoutMs: 100 })
		strictEqual(loadConfig(dir).formatTimeoutMs, 1_000)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('clamps formatTimeoutMs to maximum 120000', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatTimeoutMs: 999_999 })
		strictEqual(loadConfig(dir).formatTimeoutMs, 120_000)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accepts valid formatTimeoutMs within range', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatTimeoutMs: 15_000 })
		strictEqual(loadConfig(dir).formatTimeoutMs, 15_000)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('uses DEFAULTS.formatter for invalid formatter value', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatter: 'webpack' })
		strictEqual(loadConfig(dir).formatter, DEFAULTS.formatter)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accepts valid formatter value "biome"', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatter: 'biome' })
		strictEqual(loadConfig(dir).formatter, 'biome')
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
