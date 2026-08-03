// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { resolveMethod } from '../lib/methods-resolver.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-methods-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

/**
 * Write a `SKILL.md` at a repo-relative path under `root` and return its absolute path.
 * @param {string} root
 * @param {string} relative
 * @returns {string}
 */
function writeSkill(root, relative) {
	const absolute = join(root, relative)
	mkdirSync(join(absolute, '..'), { recursive: true })
	writeFileSync(absolute, '# fixture\n')
	return absolute
}

test('resolves from the bundle tier when nothing else is present', () => {
	const repoRoot = tempDir()
	const expected = writeSkill(repoRoot, '.archon/methods/to-spec/SKILL.md')

	const result = resolveMethod('to-spec', { repoRoot, box: 'specs' })

	assert.deepEqual(result, { name: 'to-spec', path: expected, tier: 'bundle' })
})

test('the local tier wins over the bundle tier', () => {
	const repoRoot = tempDir()
	const expected = writeSkill(repoRoot, '.archon/methods.local/to-spec/SKILL.md')
	writeSkill(repoRoot, '.archon/methods/to-spec/SKILL.md')

	const result = resolveMethod('to-spec', { repoRoot, box: 'specs' })

	assert.deepEqual(result, { name: 'to-spec', path: expected, tier: 'local' })
})

test('the config tier wins over both filesystem tiers', () => {
	const repoRoot = tempDir()
	const expected = writeSkill(repoRoot, 'team/methods/to-spec/SKILL.md')
	writeSkill(repoRoot, '.archon/methods.local/to-spec/SKILL.md')
	writeSkill(repoRoot, '.archon/methods/to-spec/SKILL.md')

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: 'team/methods/to-spec/SKILL.md' } } },
	})

	assert.deepEqual(result, { name: 'to-spec', path: expected, tier: 'config' })
})

test('an alias input resolves under the canonical name', () => {
	const repoRoot = tempDir()
	const expected = writeSkill(repoRoot, '.archon/methods/to-spec/SKILL.md')

	const result = resolveMethod('to-prd', { repoRoot, box: 'specs' })

	assert.deepEqual(result, { name: 'to-spec', path: expected, tier: 'bundle' })
})

test('a config block without this Method falls through to the filesystem tiers', () => {
	const repoRoot = tempDir()
	const expected = writeSkill(repoRoot, '.archon/methods/to-spec/SKILL.md')

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { tdd: { source: 'team/methods/tdd/SKILL.md' } } },
	})

	assert.deepEqual(result, { name: 'to-spec', path: expected, tier: 'bundle' })
})

test('an empty config source is treated as absent, not as the repo root', () => {
	const repoRoot = tempDir()
	const expected = writeSkill(repoRoot, '.archon/methods/to-spec/SKILL.md')

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: '   ' } } },
	})

	assert.deepEqual(result, { name: 'to-spec', path: expected, tier: 'bundle' })
})

test('rejects an absolute config source', () => {
	const repoRoot = tempDir()

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: '/etc/passwd' } } },
	})

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	assert.equal(/** @type {{ path?: string }} */ (result).path, undefined)
	assert.match(/** @type {{ message: string }} */ (result).message, /absolute path/)
})

test('rejects a Windows drive-letter config source', () => {
	const repoRoot = tempDir()

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: 'C:\\Windows\\System32\\SKILL.md' } } },
	})

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	assert.match(/** @type {{ message: string }} */ (result).message, /absolute path/)
})

test('rejects a home-directory config source', () => {
	const repoRoot = tempDir()

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: '~/methods/to-spec/SKILL.md' } } },
	})

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	assert.equal(/** @type {{ path?: string }} */ (result).path, undefined)
	assert.match(/** @type {{ message: string }} */ (result).message, /home-directory/)
})

test('rejects a config source that escapes the repository root', () => {
	const repoRoot = tempDir()

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: '../../etc/passwd' } } },
	})

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	assert.equal(/** @type {{ path?: string }} */ (result).path, undefined)
	assert.match(/** @type {{ message: string }} */ (result).message, /escapes the repository root/)
})

test('rejects a backslash-escaping config source on every platform', () => {
	const repoRoot = tempDir()

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: '..\\..\\etc\\passwd' } } },
	})

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	assert.match(/** @type {{ message: string }} */ (result).message, /escapes the repository root/)
})

test('a sibling directory sharing the repo-root prefix does not count as inside it', () => {
	const parent = tempDir()
	const repoRoot = join(parent, 'repo')
	mkdirSync(repoRoot, { recursive: true })

	const result = resolveMethod('to-spec', {
		repoRoot,
		box: 'specs',
		config: { methods: { 'to-spec': { source: '../repo-evil/SKILL.md' } } },
	})

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	assert.match(/** @type {{ message: string }} */ (result).message, /escapes the repository root/)
})

test('an unresolved Method names both the Method and the Box', () => {
	const repoRoot = tempDir()

	const result = resolveMethod('to-spec', { repoRoot, box: 'specs' })

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	const { message } = /** @type {{ message: string }} */ (result)
	assert.match(message, /to-spec/)
	assert.match(message, /specs/)
})

test('a name outside the manifest is an error, not a resolution attempt', () => {
	const repoRoot = tempDir()

	const result = resolveMethod('no-such-method', { repoRoot, box: 'tickets' })

	assert.equal(/** @type {{ error?: true }} */ (result).error, true)
	const { message } = /** @type {{ message: string }} */ (result)
	assert.match(message, /no-such-method/)
	assert.match(message, /tickets/)
	assert.match(message, /manifest/)
})

test('never touches the real filesystem when an existsFn is injected', () => {
	const repoRoot = tempDir()
	const bundlePath = resolve(repoRoot, '.archon/methods/tdd/SKILL.md')
	const probed = []
	const existsFn = (/** @type {string} */ p) => {
		probed.push(p)
		return p === bundlePath
	}

	const result = resolveMethod('tdd', { repoRoot, box: 'build', existsFn })

	assert.deepEqual(result, { name: 'tdd', path: bundlePath, tier: 'bundle' })
	assert.equal(probed.length, 2, 'should probe the local tier, then the bundle tier')
})
