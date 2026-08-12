// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import {
	BOX_WORKFLOW_NAME_PATTERN,
	discoverBoxWorkflowEntry,
	GENERATED_HEADER_PREFIX,
	hasGeneratedHeader,
	installArtefacts,
	installBoxWorkflows,
	renderGeneratedHeader,
} from '../lib/artefact-install.mjs'

/**
 * The generic tree-install engine behind `/setup` (#294): one **directory** entry kind
 * (`.archon/methods/`, exercised by `methods-bundle.test.mjs` via `installMethods`) and one
 * **named** entry kind (the Box workflow YAMLs, exercised here). The named kind is what fixes the
 * defect PR #333 shipped: it gates a stale artefact's deletion on its NAME matching the shipped
 * naming convention, never on whether the file carries a generated header — because header-gating
 * fails in both directions (misses a headerless retired Box, deletes a header-carrying variant
 * copy) and this issue exists precisely because of that.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

let _seq = 0
/** @returns {string} a fresh scratch directory, never cleaned up (matches methods-bundle.test.mjs) */
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-artefact-install-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

/**
 * A minimal in-memory fs double, keyed by absolute path. `files` maps a path to its contents;
 * `dirs` maps a directory path to the names it lists. Every fn records its calls so a test can
 * assert a path was — or crucially, was NOT — ever touched.
 * @param {{ files?: Record<string, string>, dirs?: Record<string, string[]> }} [seed]
 */
function fakeFs({ files = {}, dirs = {} } = {}) {
	/** @type {string[]} */
	const readdirCalls = []
	/** @type {string[]} */
	const readFileCalls = []
	/** @type {{ path: string, options: object }[]} */
	const rmCalls = []
	/** @type {{ path: string, options: object }[]} */
	const mkdirCalls = []
	/** @type {{ path: string, contents: string }[]} */
	const writeCalls = []

	return {
		files,
		dirs,
		readdirCalls,
		readFileCalls,
		rmCalls,
		mkdirCalls,
		writeCalls,
		readdirFn: (/** @type {string} */ path) => {
			readdirCalls.push(path)
			if (!(path in dirs))
				throw Object.assign(new Error(`ENOENT: no such directory, scandir '${path}'`), { code: 'ENOENT' })
			return dirs[path]
		},
		readFileFn: (/** @type {string} */ path) => {
			readFileCalls.push(path)
			if (!(path in files))
				throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' })
			return files[path]
		},
		writeFileFn: (/** @type {string} */ path, /** @type {string} */ contents) => {
			writeCalls.push({ path, contents })
			files[path] = contents
		},
		rmFn: (/** @type {string} */ path, /** @type {object} */ options) => {
			rmCalls.push({ path, options })
			delete files[path]
		},
		mkdirFn: (/** @type {string} */ path, /** @type {object} */ options) => {
			mkdirCalls.push({ path, options })
		},
		existsFn: (/** @type {string} */ path) => path in dirs || path in files,
	}
}

// --- installArtefacts: directory entries ------------------------------------------------------

test('installArtefacts (directory) removes the whole destination once, then copies every item', () => {
	const fs = fakeFs()
	/** @type {{ from: string, to: string, options: object }[]} */
	const copied = []

	const result = installArtefacts({
		entries: [
			{
				kind: 'directory',
				destinationDir: '/repo/.archon/methods',
				items: [
					{ name: 'a', from: '/bundle/a', to: '/repo/.archon/methods/a' },
					{ name: 'b', from: '/bundle/b', to: '/repo/.archon/methods/b' },
				],
			},
		],
		rmFn: (path, options) => fs.rmFn(path, options),
		cpFn: (from, to, options) => copied.push({ from, to, options }),
	})

	assert.deepEqual(fs.rmCalls, [{ path: '/repo/.archon/methods', options: { recursive: true, force: true } }])
	assert.deepEqual(copied, [
		{ from: '/bundle/a', to: '/repo/.archon/methods/a', options: { recursive: true } },
		{ from: '/bundle/b', to: '/repo/.archon/methods/b', options: { recursive: true } },
	])
	assert.deepEqual(result, {
		ok: true,
		written: ['/repo/.archon/methods/a', '/repo/.archon/methods/b'],
		deleted: [],
		skipped: [],
	})
})

test('installArtefacts (directory) reports which item failed and which already landed, without throwing', () => {
	let calls = 0
	const result = installArtefacts({
		entries: [
			{
				kind: 'directory',
				destinationDir: '/repo/.archon/methods',
				items: [
					{ name: 'a', from: '/bundle/a', to: '/repo/.archon/methods/a' },
					{ name: 'b', from: '/bundle/b', to: '/repo/.archon/methods/b' },
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
	assert.deepEqual(result.written, ['/repo/.archon/methods/a'])
	assert.equal(/** @type {{ failed: string }} */ (result).failed, '/repo/.archon/methods/b')
	assert.match(/** @type {{ cause: string }} */ (result).cause, /EBUSY/)
})

// --- installArtefacts: named entries --------------------------------------------------------

const DEST = '/repo/.archon/workflows'

test('installArtefacts (named) creates the destination directory before touching anything', () => {
	const fs = fakeFs({ dirs: {} }) // destination does not exist yet — fresh Consumer

	const result = installArtefacts({
		entries: [
			{
				kind: 'named',
				destinationDir: DEST,
				namePattern: BOX_WORKFLOW_NAME_PATTERN,
				files: [{ name: 'unic-dlc-a.yaml', contents: 'a\n' }],
			},
		],
		mkdirFn: fs.mkdirFn,
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.deepEqual(fs.mkdirCalls, [{ path: DEST, options: { recursive: true } }])
	assert.equal(result.ok, true)
	assert.deepEqual(result.written, [join(DEST, 'unic-dlc-a.yaml')])
})

test('installArtefacts (named) writes every shipped file, overwriting unconditionally without reading the old contents', () => {
	const fs = fakeFs({
		dirs: { [DEST]: ['unic-dlc-a.yaml'] },
		files: { [join(DEST, 'unic-dlc-a.yaml')]: 'STALE HAND-EDITED CONTENT\n' },
	})

	const result = installArtefacts({
		entries: [
			{
				kind: 'named',
				destinationDir: DEST,
				namePattern: BOX_WORKFLOW_NAME_PATTERN,
				files: [{ name: 'unic-dlc-a.yaml', contents: 'fresh\n' }],
			},
		],
		mkdirFn: fs.mkdirFn,
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.equal(result.ok, true)
	assert.equal(fs.files[join(DEST, 'unic-dlc-a.yaml')], 'fresh\n')
	// A name the current set still ships is overwritten directly — it is never part of the sweep,
	// so its old contents are never read and it is never "deleted" en route to being replaced.
	assert.deepEqual(fs.readFileCalls, [])
	assert.deepEqual(result.deleted, [])
})

test('installArtefacts (named) deletes a stale match with no header — the exact defect #294 exists to fix', () => {
	const fs = fakeFs({
		dirs: { [DEST]: ['unic-dlc-retired.yaml'] },
		files: { [join(DEST, 'unic-dlc-retired.yaml')]: 'kind: workflow\n# no header, hand-seeded long ago\n' },
	})

	const result = installArtefacts({
		entries: [{ kind: 'named', destinationDir: DEST, namePattern: BOX_WORKFLOW_NAME_PATTERN, files: [] }],
		mkdirFn: fs.mkdirFn,
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.deleted, [join(DEST, 'unic-dlc-retired.yaml')])
	assert.ok(!(join(DEST, 'unic-dlc-retired.yaml') in fs.files))
})

test('installArtefacts (named) deletes a stale match that DOES carry the generated header — ownership is by name, never by header', () => {
	const path = join(DEST, 'unic-dlc-retired.yaml')
	const fs = fakeFs({
		dirs: { [DEST]: ['unic-dlc-retired.yaml'] },
		files: { [path]: `${renderGeneratedHeader({ pluginVersion: '1.0.0' })}kind: workflow\n` },
	})
	assert.ok(hasGeneratedHeader(fs.files[path]), 'fixture must actually carry the header, or this test proves nothing')

	const result = installArtefacts({
		entries: [{ kind: 'named', destinationDir: DEST, namePattern: BOX_WORKFLOW_NAME_PATTERN, files: [] }],
		mkdirFn: fs.mkdirFn,
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.deleted, [path])
})

test('installArtefacts (named) never inspects or deletes a file outside the naming, whatever it contains', () => {
	const headered = join(DEST, 'my-team-variant.yaml')
	const fs = fakeFs({
		dirs: { [DEST]: ['my-team-variant.yaml'] },
		files: {
			[headered]:
				renderGeneratedHeader({ pluginVersion: '1.0.0' }) +
				'kind: workflow\n# a variant copied from an installed Box\n',
		},
	})

	const result = installArtefacts({
		entries: [{ kind: 'named', destinationDir: DEST, namePattern: BOX_WORKFLOW_NAME_PATTERN, files: [] }],
		mkdirFn: fs.mkdirFn,
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.written, [])
	assert.deepEqual(result.deleted, [])
	assert.deepEqual(result.skipped, [])
	// The README's variant escape hatch depends on this: a name outside the pattern is never even
	// read, let alone deleted, no matter what it contains — including a copy of an installed Box.
	assert.deepEqual(fs.readFileCalls, [])
	assert.deepEqual(fs.rmCalls, [])
	assert.ok(headered in fs.files, 'the untouched file must still be on disk')
})

test('installArtefacts (named) reports an unreadable stale match, never silently drops it, and does not report success', () => {
	const unreadable = join(DEST, 'unic-dlc-locked.yaml')
	/** @type {Record<string, string[]>} */
	const dirs = { [DEST]: ['unic-dlc-locked.yaml'] }
	/** @type {string[]} */
	const readFileCalls = []
	/** @type {{path:string, options:object}[]} */
	const rmCalls = []

	const result = installArtefacts({
		entries: [{ kind: 'named', destinationDir: DEST, namePattern: BOX_WORKFLOW_NAME_PATTERN, files: [] }],
		mkdirFn: () => {},
		readdirFn: (path) => dirs[path] ?? [],
		readFileFn: (path) => {
			readFileCalls.push(path)
			throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
		},
		writeFileFn: () => {},
		rmFn: (path, options) => rmCalls.push({ path, options }),
		existsFn: (path) => path in dirs,
	})

	assert.equal(result.ok, false)
	assert.equal(/** @type {{ stage: string }} */ (result).stage, 'stale-sweep')
	assert.deepEqual(result.skipped, [{ path: unreadable, message: 'EACCES: permission denied' }])
	assert.match(/** @type {{ cause: string }} */ (result).cause, /unic-dlc-locked\.yaml/)
	assert.match(/** @type {{ cause: string }} */ (result).cause, /EACCES/)
	// Read was attempted (so the failure is real, not assumed) but the file was never removed —
	// "reported, never silently skipped" means it stays exactly where it was.
	assert.deepEqual(readFileCalls, [unreadable])
	assert.deepEqual(rmCalls, [])
})

// --- discoverBoxWorkflowEntry -----------------------------------------------------------------

test('discoverBoxWorkflowEntry reads the plugin source directory and filters to unic-dlc-*.yaml', () => {
	// Built with `join`, never a literal: the function under test looks the directory up as
	// `join(pluginRoot, '.archon', 'workflows')`, which is backslash-separated on Windows. A
	// forward-slash literal misses that lookup, and the double returns undefined.
	const sourceDir = join('/plugin', '.archon', 'workflows')
	/** @type {Record<string, string[]>} */
	const dirs = { [sourceDir]: ['unic-dlc-a.yaml', 'unic-dlc-b.yaml', 'README.md', 'unic-dlc-c.json', '.gitkeep'] }
	/** @type {Record<string, string>} */
	const files = { [join(sourceDir, 'unic-dlc-a.yaml')]: 'a-body\n', [join(sourceDir, 'unic-dlc-b.yaml')]: 'b-body\n' }

	const entry = discoverBoxWorkflowEntry({
		pluginRoot: '/plugin',
		repoRoot: '/repo',
		pluginVersion: '1.2.3',
		readdirFn: (path) => dirs[path],
		readFileFn: (path) => files[path],
	})

	assert.deepEqual(
		entry.files.map((f) => f.name),
		['unic-dlc-a.yaml', 'unic-dlc-b.yaml']
	)
	assert.equal(entry.kind, 'named')
	assert.equal(entry.destinationDir, join('/repo', '.archon', 'workflows'))
})

test('discoverBoxWorkflowEntry stamps every discovered file with the generated header naming the version', () => {
	const entry = discoverBoxWorkflowEntry({
		pluginRoot: '/plugin',
		repoRoot: '/repo',
		pluginVersion: '4.5.6',
		readdirFn: () => ['unic-dlc-a.yaml'],
		readFileFn: () => 'kind: workflow\n',
	})

	assert.ok(hasGeneratedHeader(entry.files[0].contents))
	assert.match(entry.files[0].contents, /4\.5\.6/)
	assert.match(entry.files[0].contents, /kind: workflow/)
})

test('adding a unic-dlc-*.yaml to the plugin tree installs it with no other source change', () => {
	// A fixture plugin tree, not the real plugin — proves discovery is driven by disk, not by a
	// name list anywhere in this codebase (#294's discovery criterion).
	const pluginRoot = tempDir()
	const repoRoot = tempDir()
	mkdirSync(join(pluginRoot, '.archon', 'workflows'), { recursive: true })
	writeFileSync(join(pluginRoot, '.archon', 'workflows', 'unic-dlc-alpha.yaml'), 'kind: workflow\nname: alpha\n')
	writeFileSync(join(pluginRoot, '.archon', 'workflows', 'unic-dlc-beta.yaml'), 'kind: workflow\nname: beta\n')

	const first = installBoxWorkflows({ pluginRoot, repoRoot, pluginVersion: '0.0.1' })
	assert.equal(first.ok, true)
	assert.deepEqual(readdirSync(join(repoRoot, '.archon', 'workflows')).sort(), [
		'unic-dlc-alpha.yaml',
		'unic-dlc-beta.yaml',
	])

	// The plugin ships a new Box. No call site here changes.
	writeFileSync(join(pluginRoot, '.archon', 'workflows', 'unic-dlc-gamma.yaml'), 'kind: workflow\nname: gamma\n')

	const second = installBoxWorkflows({ pluginRoot, repoRoot, pluginVersion: '0.0.2' })
	assert.equal(second.ok, true)
	assert.deepEqual(readdirSync(join(repoRoot, '.archon', 'workflows')).sort(), [
		'unic-dlc-alpha.yaml',
		'unic-dlc-beta.yaml',
		'unic-dlc-gamma.yaml',
	])
})

// --- installBoxWorkflows against the REAL shipped Box set --------------------------------------

test('installBoxWorkflows into a fresh Consumer matches the plugin directory exactly — no count, no name list', () => {
	const repoRoot = tempDir()

	const result = installBoxWorkflows({ pluginRoot: PLUGIN_ROOT, repoRoot, pluginVersion: '9.9.9' })
	assert.equal(result.ok, true)

	const shipped = readdirSync(join(PLUGIN_ROOT, '.archon', 'workflows'))
		.filter((name) => BOX_WORKFLOW_NAME_PATTERN.test(name))
		.sort()
	const installed = readdirSync(join(repoRoot, '.archon', 'workflows'))
		.filter((name) => BOX_WORKFLOW_NAME_PATTERN.test(name))
		.sort()

	assert.ok(shipped.length > 0, 'the real plugin ships no Box workflow — this assertion would pass vacuously')
	assert.deepEqual(installed, shipped)
})

test('re-running installBoxWorkflows with no plugin change produces byte-identical artefacts', () => {
	const repoRoot = tempDir()

	installBoxWorkflows({ pluginRoot: PLUGIN_ROOT, repoRoot, pluginVersion: '9.9.9' })
	const names = readdirSync(join(repoRoot, '.archon', 'workflows'))
	const before = Object.fromEntries(
		names.map((name) => [name, readFileSync(join(repoRoot, '.archon', 'workflows', name), 'utf8')])
	)

	installBoxWorkflows({ pluginRoot: PLUGIN_ROOT, repoRoot, pluginVersion: '9.9.9' })
	const after = Object.fromEntries(
		names.map((name) => [name, readFileSync(join(repoRoot, '.archon', 'workflows', name), 'utf8')])
	)

	assert.deepEqual(after, before)
})

test('installBoxWorkflows leaves a Consumer file outside the naming untouched across a real re-run', () => {
	const repoRoot = tempDir()
	mkdirSync(join(repoRoot, '.archon', 'workflows'), { recursive: true })
	const variantPath = join(repoRoot, '.archon', 'workflows', 'team-variant.yaml')
	writeFileSync(variantPath, 'kind: workflow\nname: team-variant\n')

	installBoxWorkflows({ pluginRoot: PLUGIN_ROOT, repoRoot, pluginVersion: '9.9.9' })

	assert.equal(readFileSync(variantPath, 'utf8'), 'kind: workflow\nname: team-variant\n')
})

// --- header helpers ----------------------------------------------------------------------------

test('renderGeneratedHeader names the version and states that /setup replaces the file', () => {
	const header = renderGeneratedHeader({ pluginVersion: '2.0.0' })
	assert.match(header, /2\.0\.0/)
	assert.match(header, /setup/i)
	assert.match(header, /lost/i)
	assert.ok(header.startsWith(GENERATED_HEADER_PREFIX))
})

test('hasGeneratedHeader matches only a first-line prefix, never a substring over the whole body', () => {
	assert.equal(hasGeneratedHeader(`${renderGeneratedHeader({ pluginVersion: '1.0.0' })}kind: workflow\n`), true)
	// The marker text appears in the body, but not as the first line — a Consumer file that merely
	// mentions it must not be classified as plugin-owned.
	assert.equal(hasGeneratedHeader(`kind: workflow\n# see also: ${GENERATED_HEADER_PREFIX}@1.0.0\n`), false)
	assert.equal(hasGeneratedHeader(''), false)
	assert.equal(hasGeneratedHeader('kind: workflow\n'), false)
})
