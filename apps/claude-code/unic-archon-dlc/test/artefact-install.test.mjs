// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import {
	buildGeneratedHeader,
	discoverInstallItems,
	GENERATED_HEADER_MARKER,
	installArtefacts,
} from '../lib/artefact-install.mjs'

/**
 * The generic tree-install engine behind both `installMethods` (whole-dir, unchanged contract — see
 * `test/methods-bundle.test.mjs`) and the Box-workflow install `commands/setup.md` Step 6 runs
 * (name-scoped). Fixture names below are deliberately generic (`fixture-a.yaml`, not a real Box name):
 * #294 forbids a Box name appearing as a literal in a test fixture, because the box set is in flux.
 */

let _seq = 0
function tempDir() {
	const dir = join(tmpdir(), `unic-dlc-artefact-install-${Date.now()}-${++_seq}`)
	mkdirSync(dir, { recursive: true })
	return dir
}

/**
 * @param {string} dir
 * @param {Record<string, string>} files
 */
function writeFiles(dir, files) {
	mkdirSync(dir, { recursive: true })
	for (const [name, contents] of Object.entries(files)) writeFileSync(join(dir, name), contents)
}

const PLUGIN_NAME = 'unic-archon-dlc'
const HEADER = buildGeneratedHeader(PLUGIN_NAME, '9.9.9')

// --- discoverInstallItems -----------------------------------------------------------------------

test('discoverInstallItems lists a source directory sorted, skipping dotfiles', () => {
	const sourceDir = tempDir()
	writeFiles(sourceDir, { 'b.yaml': 'b', 'a.yaml': 'a', '.gitkeep': '' })

	assert.deepEqual(discoverInstallItems({ sourceDir }), [
		{ name: 'a.yaml', sourcePath: join(sourceDir, 'a.yaml') },
		{ name: 'b.yaml', sourcePath: join(sourceDir, 'b.yaml') },
	])
})

// --- installArtefacts: whole-dir entries --------------------------------------------------------

test('a whole-dir entry wipes destDir once, then copies each item as a directory', () => {
	const repoRoot = resolve('/repo')
	/** @type {{ path: string, options: object }[]} */
	const removed = []
	/** @type {{ from: string, to: string, options: object }[]} */
	const copied = []

	const [result] = installArtefacts({
		entries: [
			{
				name: 'fixture-whole-dir',
				destDir: join(repoRoot, '.archon/fixture'),
				ownsWholeDir: true,
				items: [
					{ name: 'one', sourcePath: '/bundle/one' },
					{ name: 'two', sourcePath: '/bundle/two' },
				],
			},
		],
		rmFn: (path, options) => removed.push({ path, options }),
		cpFn: (from, to, options) => copied.push({ from, to, options }),
	})

	assert.deepEqual(removed, [{ path: join(repoRoot, '.archon/fixture'), options: { recursive: true, force: true } }])
	assert.deepEqual(copied, [
		{ from: '/bundle/one', to: join(repoRoot, '.archon/fixture', 'one'), options: { recursive: true } },
		{ from: '/bundle/two', to: join(repoRoot, '.archon/fixture', 'two'), options: { recursive: true } },
	])
	assert.deepEqual(result, { name: 'fixture-whole-dir', ok: true, installed: ['one', 'two'], deleted: [], skipped: [] })
})

test('a whole-dir entry stops at the failing item and reports which items already landed', () => {
	let calls = 0
	const [result] = installArtefacts({
		entries: [
			{
				name: 'fixture-whole-dir',
				destDir: '/repo/.archon/fixture',
				ownsWholeDir: true,
				items: [
					{ name: 'one', sourcePath: '/bundle/one' },
					{ name: 'two', sourcePath: '/bundle/two' },
					{ name: 'three', sourcePath: '/bundle/three' },
				],
			},
		],
		rmFn: () => {},
		cpFn: () => {
			calls += 1
			if (calls === 2) throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' })
		},
	})

	assert.equal(result.ok, false)
	assert.deepEqual(/** @type {{ installed: string[] }} */ (result).installed, ['one'])
	assert.equal(/** @type {{ failed: string }} */ (result).failed, 'two')
	assert.match(/** @type {{ error: Error }} */ (result).error.message, /EBUSY/)
})

// --- installArtefacts: name-scoped entries --------------------------------------------------------

test('a name-scoped entry installs every item with the generated header prepended', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })

	const [result] = installArtefacts({
		entries: [
			{
				name: 'fixture-workflows',
				destDir,
				items: discoverInstallItems({ sourceDir }),
				header: HEADER,
			},
		],
	})

	assert.deepEqual(result.installed, ['fixture-a.yaml'])
	assert.equal(readFileSync(join(destDir, 'fixture-a.yaml'), 'utf8'), `${HEADER}\n\na: 1\n`)
})

test('a name-scoped entry creates a destination directory the Consumer does not have yet', () => {
	// A Consumer that has never authored a workflow has no `.archon/workflows/`. `cpSync` would make
	// the parents; `writeFileSync` would throw ENOENT, so the fresh-repo install has to make it.
	const sourceDir = tempDir()
	const destDir = join(tempDir(), '.archon', 'workflows')
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })

	const [result] = installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})

	assert.deepEqual(result.installed, ['fixture-a.yaml'])
	assert.equal(readFileSync(join(destDir, 'fixture-a.yaml'), 'utf8'), `${HEADER}\n\na: 1\n`)
})

test('a name-scoped entry leaves a Consumer file outside the install set untouched', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })
	writeFiles(destDir, { 'consumer-own.yaml': 'not ours\n' })

	const [result] = installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})

	assert.deepEqual(result.deleted, [])
	assert.equal(readFileSync(join(destDir, 'consumer-own.yaml'), 'utf8'), 'not ours\n')
	assert.ok(readdirSync(destDir).includes('consumer-own.yaml'))
})

test('a name-scoped entry deletes a stale plugin-owned file the current run no longer ships', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })
	writeFiles(destDir, { 'fixture-retired.yaml': `${HEADER}\n\nretired: true\n` })

	const [result] = installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})

	assert.deepEqual(result.deleted, ['fixture-retired.yaml'])
	assert.ok(!readdirSync(destDir).includes('fixture-retired.yaml'))
})

test('a name-scoped entry never crashes on an existing directory it cannot read as a file', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })
	mkdirSync(join(destDir, 'some-subdir'), { recursive: true })

	const [result] = installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})

	assert.deepEqual(result.deleted, [])
	assert.deepEqual(/** @type {{ skipped: string[] }} */ (result).skipped, ['some-subdir'])
	assert.ok(readdirSync(destDir).includes('some-subdir'))
})

test('a name-scoped item whose source cannot be read propagates as a throw, never a silent skip', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })

	assert.throws(
		() =>
			installArtefacts({
				entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
				readFileFn: () => {
					throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
				},
			}),
		/EACCES/
	)
})

test('a name-scoped entry never treats .gitkeep as stale or as an item to install', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n', '.gitkeep': '' })
	writeFiles(destDir, { '.gitkeep': '' })

	const [result] = installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})

	assert.deepEqual(result.installed, ['fixture-a.yaml'])
	assert.deepEqual(result.deleted, [])
	assert.ok(readdirSync(destDir).includes('.gitkeep'))
})

test('adding a fixture yaml to the plugin tree installs it with no other source change', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })

	installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})
	assert.deepEqual(readdirSync(destDir).sort(), ['fixture-a.yaml'])

	writeFiles(sourceDir, { 'fixture-b.yaml': 'b: 2\n' })
	installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})
	assert.deepEqual(readdirSync(destDir).sort(), ['fixture-a.yaml', 'fixture-b.yaml'])
})

test('re-running with no source change produces byte-identical output', () => {
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, { 'fixture-a.yaml': 'a: 1\n' })
	const entries = () => [
		{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER },
	]

	installArtefacts({ entries: entries() })
	const first = readFileSync(join(destDir, 'fixture-a.yaml'))

	installArtefacts({ entries: entries() })
	const second = readFileSync(join(destDir, 'fixture-a.yaml'))

	assert.deepEqual(first, second)
})

test('a stale file with no generated-header marker is never deleted even if the name looks retired', () => {
	// The staleness check reads for the MARKER, not for a name pattern — a Consumer's own file that
	// happens to share a name with something the plugin once shipped must survive exactly like any
	// other foreign file.
	const sourceDir = tempDir()
	const destDir = tempDir()
	writeFiles(sourceDir, {})
	writeFiles(destDir, { 'fixture-retired.yaml': 'hand-authored, no marker\n' })

	const [result] = installArtefacts({
		entries: [{ name: 'fixture-workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})

	assert.deepEqual(result.deleted, [])
	assert.equal(readFileSync(join(destDir, 'fixture-retired.yaml'), 'utf8'), 'hand-authored, no marker\n')
})

test('buildGeneratedHeader names the plugin and version, and the marker it writes matches the constant', () => {
	const header = buildGeneratedHeader('unic-archon-dlc', '1.2.3')
	assert.match(header, /unic-archon-dlc@1\.2\.3/)
	assert.ok(header.includes(GENERATED_HEADER_MARKER))
})

// --- real files: the plugin's own shipped Box workflows -------------------------------------------

test('installing the plugin real .archon/workflows/ into a fresh Consumer fixture matches on disk', () => {
	// Set equality, not a count or a name list (#294 AC): the box set is in flux, so this test must
	// keep passing the day a Box is added or retired without anyone touching it.
	const pluginRoot = resolve(import.meta.dirname, '..')
	const sourceDir = join(pluginRoot, '.archon', 'workflows')
	const destDir = tempDir()

	installArtefacts({
		entries: [{ name: 'workflows', destDir, items: discoverInstallItems({ sourceDir }), header: HEADER }],
	})

	const shipped = readdirSync(sourceDir).filter((name) => !name.startsWith('.'))
	const installed = readdirSync(destDir).filter((name) => !name.startsWith('.'))
	assert.deepEqual(installed.sort(), shipped.sort())
	rmSync(destDir, { recursive: true, force: true })
})
