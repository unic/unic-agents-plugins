// @ts-check

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

/**
 * `package.json`'s `test` script names every test file by hand, and nothing checked that list
 * against `test/` on disk. A hand-maintained list fails OPEN: an unlisted file never runs and the
 * suite still reports green, which is worse than a missing test because it manufactures a green
 * number for coverage that did not execute — and it fires exactly when someone adds a guard, when
 * they are most likely to trust the number.
 *
 * This is not hypothetical. It happened on #290's own branch: `build-qa-evidence-and-always-run`
 * went unlisted, so all three of its structural guards never ran and the suite reported 226/226.
 *
 * The structural fix is `node --test test/` instead of an enumeration; that changes how CI's
 * per-package matrix invokes the suite, so it is a separate decision. This guard holds the line
 * until then, in the shape `methods-manifest.test.mjs` already uses for an on-disk-versus-manifest
 * diff.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

test('every test file is enumerated in package.json, and every enumerated file exists', () => {
	const onDisk = readdirSync(join(PLUGIN_ROOT, 'test'))
		.filter((name) => name.endsWith('.test.mjs'))
		.sort()

	const script = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'package.json'), 'utf8')).scripts.test
	const enumerated = script
		.split(/\s+/)
		.filter((/** @type {string} */ token) => token.endsWith('.test.mjs'))
		.map((/** @type {string} */ token) => token.replace(/^test[/\\]/, ''))
		.sort()

	assert.ok(onDisk.length > 0, 'no test files found on disk — this guard went blind')
	assert.deepEqual(
		enumerated,
		onDisk,
		"package.json's test script and test/ have drifted — an unlisted file never runs and the suite still reports green"
	)
})
