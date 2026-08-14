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
		added: [],
		skipped: [],
	})
})

test('installArtefacts (directory) contributes nothing to added — a directory entry has no per-name history', () => {
	// `added` answers "which names are new to this Consumer", which only a named entry can know: a
	// directory entry removes its whole destination first, so every item it copies is trivially new
	// and the answer would be noise (#295 AC-3).
	const result = installArtefacts({
		entries: [
			{
				kind: 'directory',
				destinationDir: '/repo/.archon/methods',
				items: [{ name: 'a', from: '/bundle/a', to: '/repo/.archon/methods/a' }],
			},
		],
		rmFn: () => {},
		cpFn: () => {},
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.added, [])
	assert.deepEqual(result.written, ['/repo/.archon/methods/a'])
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

test('installArtefacts (named) reports as added only the shipped names the destination did not already hold', () => {
	const fs = fakeFs({
		dirs: { [DEST]: ['unic-dlc-a.yaml', 'team-variant.yaml'] },
		files: { [join(DEST, 'unic-dlc-a.yaml')]: 'previously installed\n' },
	})

	const result = installArtefacts({
		entries: [
			{
				kind: 'named',
				destinationDir: DEST,
				namePattern: BOX_WORKFLOW_NAME_PATTERN,
				files: [
					{ name: 'unic-dlc-a.yaml', contents: 'a\n' },
					{ name: 'unic-dlc-b.yaml', contents: 'b\n' },
					{ name: 'unic-dlc-c.yaml', contents: 'c\n' },
				],
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
	// `written` is the whole shipped set; `added` is the part of it that is new to this Consumer.
	assert.deepEqual(result.written, [
		join(DEST, 'unic-dlc-a.yaml'),
		join(DEST, 'unic-dlc-b.yaml'),
		join(DEST, 'unic-dlc-c.yaml'),
	])
	assert.deepEqual(result.added, [join(DEST, 'unic-dlc-b.yaml'), join(DEST, 'unic-dlc-c.yaml')])
	// One listing of the destination serves both the stale sweep and `added` — a second would be a
	// second answer, and the two could disagree if anything wrote in between.
	assert.deepEqual(fs.readdirCalls, [DEST])
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

test('installArtefacts (named) does not fail the install over a stale match that is already gone', () => {
	// The whole file vanished between `readdir` and the sweep. The desired end state — the retired
	// name is not on disk — already holds, so reporting failure would be a false negative. It is not
	// counted in `deleted` either: this sweep did not delete it.
	const path = join(DEST, 'unic-dlc-retired.yaml')
	/** @type {Record<string, string[]>} */
	const dirs = { [DEST]: ['unic-dlc-retired.yaml'] }
	/** @type {string[]} */
	const rmPaths = []

	const result = installArtefacts({
		entries: [{ kind: 'named', destinationDir: DEST, namePattern: BOX_WORKFLOW_NAME_PATTERN, files: [] }],
		mkdirFn: () => {},
		readdirFn: (p) => dirs[p] ?? [],
		readFileFn: () => {
			throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' })
		},
		writeFileFn: () => {},
		rmFn: (p) => {
			rmPaths.push(p)
			throw Object.assign(new Error(`ENOENT: no such file or directory, unlink '${p}'`), { code: 'ENOENT' })
		},
		existsFn: (p) => p in dirs,
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.deleted, [])
	assert.deepEqual(result.skipped, [])
	// The delete was still attempted — absence is concluded from the delete, never assumed from the read.
	assert.deepEqual(rmPaths, [path])
})

test('installArtefacts (named) still deletes a stale match whose CONTENTS are unreadable but whose name is on disk', () => {
	// A dangling symlink is the case that makes an ENOENT from the read useless as proof of absence:
	// the read fails ENOENT while the directory entry is listed, stale, and perfectly deletable. If
	// the sweep forgave the read, a retired Box name would survive under a green /setup.
	const path = join(DEST, 'unic-dlc-retired.yaml')
	/** @type {Record<string, string[]>} */
	const dirs = { [DEST]: ['unic-dlc-retired.yaml'] }
	/** @type {string[]} */
	const rmPaths = []

	const result = installArtefacts({
		entries: [{ kind: 'named', destinationDir: DEST, namePattern: BOX_WORKFLOW_NAME_PATTERN, files: [] }],
		mkdirFn: () => {},
		readdirFn: (p) => dirs[p] ?? [],
		readFileFn: () => {
			throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' })
		},
		writeFileFn: () => {},
		rmFn: (p) => rmPaths.push(p),
		existsFn: (p) => p in dirs,
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.deleted, [path])
	assert.deepEqual(result.skipped, [])
	assert.deepEqual(rmPaths, [path])
})

test('installArtefacts (named) reports a stale match the delete itself cannot remove', () => {
	// The ENOENT relaxation above must not have become blanket leniency: an EACCES on the delete
	// leaves the retired Box on disk, which is exactly what must not pass as success.
	const path = join(DEST, 'unic-dlc-retired.yaml')
	/** @type {Record<string, string[]>} */
	const dirs = { [DEST]: ['unic-dlc-retired.yaml'] }

	const result = installArtefacts({
		entries: [{ kind: 'named', destinationDir: DEST, namePattern: BOX_WORKFLOW_NAME_PATTERN, files: [] }],
		mkdirFn: () => {},
		readdirFn: (p) => dirs[p] ?? [],
		readFileFn: () => 'kind: workflow\n',
		writeFileFn: () => {},
		rmFn: () => {
			throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
		},
		existsFn: (p) => p in dirs,
	})

	assert.equal(result.ok, false)
	assert.equal(/** @type {{ stage: string }} */ (result).stage, 'stale-sweep')
	assert.deepEqual(result.skipped, [{ path, message: 'EACCES: permission denied' }])
	assert.deepEqual(result.deleted, [])
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

test('discoverBoxWorkflowEntry orders the discovered set by name, not by readdir order', () => {
	// `readdir` returns whatever the filesystem returns — insertion order on ext4, hash order
	// elsewhere — so an unsorted set makes the install order, `written[]` and the /setup Step 8
	// summary differ between a maintainer's Mac and the Linux CI runner for identical inputs.
	const sourceDir = join('/plugin', '.archon', 'workflows')

	const entry = discoverBoxWorkflowEntry({
		pluginRoot: '/plugin',
		repoRoot: '/repo',
		pluginVersion: '1.2.3',
		readdirFn: () => ['unic-dlc-c.yaml', 'unic-dlc-a.yaml', 'unic-dlc-b.yaml'],
		readFileFn: (path) => `body of ${path}\n`,
	})

	assert.deepEqual(
		entry.files.map((f) => f.name),
		['unic-dlc-a.yaml', 'unic-dlc-b.yaml', 'unic-dlc-c.yaml']
	)
	// Each entry still carries its OWN body — sorting the names must not shear names from contents.
	assert.match(entry.files[0].contents, /body of .*unic-dlc-a\.yaml/)
	assert.ok(entry.files[0].contents.includes(join(sourceDir, 'unic-dlc-a.yaml')))
})

test('installBoxWorkflows writes in name order, so written[] and the Step 8 summary are stable across machines', () => {
	const fs = fakeFs({ dirs: { [join('/plugin', '.archon', 'workflows')]: ['unic-dlc-c.yaml', 'unic-dlc-a.yaml'] } })

	const result = installBoxWorkflows({
		pluginRoot: '/plugin',
		repoRoot: '/repo',
		pluginVersion: '1.2.3',
		readdirFn: (path) => fs.dirs[path] ?? [],
		readFileFn: () => 'kind: workflow\n',
		mkdirFn: fs.mkdirFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: (path) => path in fs.dirs,
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.written, [
		join('/repo', '.archon', 'workflows', 'unic-dlc-a.yaml'),
		join('/repo', '.archon', 'workflows', 'unic-dlc-c.yaml'),
	])
})

// --- installBoxWorkflows: previousVersion --------------------------------------------------------

const PLUGIN_SOURCE = join('/plugin', '.archon', 'workflows')
const CONSUMER_DEST = join('/repo', '.archon', 'workflows')

test('installBoxWorkflows reports no previous version and every shipped path as added on a fresh Consumer', () => {
	// Nothing on disk to read a header from, and nothing already installed — so every shipped Box is
	// new here, and the summary has no "upgraded from" to print.
	const fs = fakeFs({
		dirs: { [PLUGIN_SOURCE]: ['unic-dlc-a.yaml', 'unic-dlc-b.yaml'] },
		files: {
			[join(PLUGIN_SOURCE, 'unic-dlc-a.yaml')]: 'kind: workflow\n',
			[join(PLUGIN_SOURCE, 'unic-dlc-b.yaml')]: 'kind: workflow\n',
		},
	})

	const result = installBoxWorkflows({
		pluginRoot: '/plugin',
		repoRoot: '/repo',
		pluginVersion: '0.21.0',
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		mkdirFn: fs.mkdirFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.equal(result.ok, true)
	assert.equal(result.previousVersion, null)
	assert.deepEqual(result.added, [join(CONSUMER_DEST, 'unic-dlc-a.yaml'), join(CONSUMER_DEST, 'unic-dlc-b.yaml')])
})

test('installBoxWorkflows reports no previous version when the installed Box carries no generated header', () => {
	const fs = fakeFs({
		dirs: { [PLUGIN_SOURCE]: ['unic-dlc-a.yaml'], [CONSUMER_DEST]: ['unic-dlc-a.yaml'] },
		files: {
			[join(PLUGIN_SOURCE, 'unic-dlc-a.yaml')]: 'kind: workflow\n',
			[join(CONSUMER_DEST, 'unic-dlc-a.yaml')]: 'kind: workflow\n# hand-seeded, predates the header\n',
		},
	})

	const result = installBoxWorkflows({
		pluginRoot: '/plugin',
		repoRoot: '/repo',
		pluginVersion: '0.21.0',
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		mkdirFn: fs.mkdirFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.equal(result.ok, true)
	assert.equal(result.previousVersion, null)
	assert.deepEqual(result.added, [])
})

test('installBoxWorkflows reports no previous version when the header names none', () => {
	// The prefix is there, the `@<version>` is not. Null, not the prefix line itself — the summary
	// prints this straight to an operator.
	const fs = fakeFs({
		dirs: { [PLUGIN_SOURCE]: ['unic-dlc-a.yaml'], [CONSUMER_DEST]: ['unic-dlc-a.yaml'] },
		files: {
			[join(PLUGIN_SOURCE, 'unic-dlc-a.yaml')]: 'kind: workflow\n',
			[join(CONSUMER_DEST, 'unic-dlc-a.yaml')]: `${GENERATED_HEADER_PREFIX} — no version here\nkind: workflow\n`,
		},
	})

	const result = installBoxWorkflows({
		pluginRoot: '/plugin',
		repoRoot: '/repo',
		pluginVersion: '0.21.0',
		readdirFn: fs.readdirFn,
		readFileFn: fs.readFileFn,
		mkdirFn: fs.mkdirFn,
		writeFileFn: fs.writeFileFn,
		rmFn: fs.rmFn,
		existsFn: fs.existsFn,
	})

	assert.equal(result.ok, true)
	assert.equal(result.previousVersion, null)
})

test('installBoxWorkflows reads the previous version before this run overwrites it', () => {
	// The whole point of the value, and the one bug that would pass every other assertion here: read
	// the header AFTER the write loop and it names the version being installed, on every run.
	const pluginRoot = tempDir()
	const repoRoot = tempDir()
	mkdirSync(join(pluginRoot, '.archon', 'workflows'), { recursive: true })
	writeFileSync(join(pluginRoot, '.archon', 'workflows', 'unic-dlc-alpha.yaml'), 'kind: workflow\nname: alpha\n')

	const first = installBoxWorkflows({ pluginRoot, repoRoot, pluginVersion: '0.20.0' })
	assert.equal(first.ok, true)
	assert.equal(first.previousVersion, null)
	assert.deepEqual(first.added, [join(repoRoot, '.archon', 'workflows', 'unic-dlc-alpha.yaml')])

	// Same plugin content, newer version: nothing is added, and the version on disk is the one the
	// first run stamped.
	const second = installBoxWorkflows({ pluginRoot, repoRoot, pluginVersion: '0.21.0' })
	assert.equal(second.ok, true)
	assert.equal(second.previousVersion, '0.20.0')
	assert.deepEqual(second.added, [])
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

// --- the Step 8 summary prose --------------------------------------------------------------------

test('commands/setup.md Step 8 reports the previous version and the added workflows', () => {
	// The pattern `config-schema.test.mjs` already uses on this same file: doc-only prose with no
	// other test surface. Its limit is worth stating — it proves the two lines and the three version
	// forms are present, not that the agent branches correctly between them at run time. That
	// branching rests on review.
	const setupDoc = readFileSync(join(import.meta.dirname, '..', 'commands', 'setup.md'), 'utf8')

	assert.match(setupDoc, /workflows added:/, 'Step 8 must gain a workflows added: line')
	assert.match(setupDoc, /print `first install`/, 'Step 8 must state the first-install version form')
	assert.match(setupDoc, /print `upgraded from: unknown`/, 'Step 8 must state the unknown-previous-version form')
	assert.match(
		setupDoc,
		/print `upgraded from: \{PREVIOUS_VERSION\} → \{PLUGIN_VERSION\}`/,
		'Step 8 must state the known-upgrade version form'
	)
	assert.match(
		setupDoc,
		/`WORKFLOWS_ADDED` \(`workflowsAdded`\), `PREVIOUS_VERSION` \(`previousVersion`\) and `PLUGIN_VERSION` \(`pluginVersion`\)/,
		'Step 6 must keep naming WORKFLOWS_ADDED, PREVIOUS_VERSION and PLUGIN_VERSION among the variables Step 8 receives'
	)
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
