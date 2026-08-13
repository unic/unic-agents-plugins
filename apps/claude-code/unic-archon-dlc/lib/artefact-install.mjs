// @ts-check
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The one tree-install engine `/setup` writes artefacts through (#294).
 *
 * An install set is a list of entries, each either:
 *
 * - **directory** — owns its whole destination directory. The directory is removed wholesale
 *   (`recursive, force`), then every item is copied in. `.archon/methods/` is the only entry that
 *   ever sets this: `installMethods` in `methods-bundle.mjs` builds one and calls
 *   {@link installArtefacts}, unchanged in behaviour from before this module existed.
 * - **named** — never owns its destination directory, because `.archon/workflows/` is shared with
 *   the Consumer's own workflows (a directory-level clean-replace there would delete unrelated
 *   files on the first `/setup` run). Ownership is scoped **by name**: `namePattern` names the
 *   naming convention this entry may act on (e.g. `unic-dlc-*.yaml`), and only names matching it are
 *   ever inspected, overwritten, or deleted. A destination file whose name does not match is never
 *   touched, whatever it contains — including a file that happens to carry the generated header,
 *   because a team's documented escape hatch for a variant Box is to name it outside the pattern.
 *
 * The stale sweep for a named entry deletes a matching destination name that the current `files`
 * list no longer ships, **regardless of whether it carries the generated header** — ownership is
 * decided by name alone, never by reading file contents. A name this entry cannot even read is
 * reported in `skipped`, never silently dropped: `/setup` must not report success while a stale
 * artefact it meant to retire is still on disk. The one exception is precise, and it is the whole
 * reason the sweep classifies errors by `errno` rather than treating every throw alike: a name that
 * is *absent* is not "still on disk" — it is already in the end state the sweep wanted — so `ENOENT`
 * from the deletion is neither a failure nor a deletion this sweep performed. See
 * {@link installArtefacts}'s sweep for why the read cannot be the arbiter of that.
 */

/**
 * @typedef {Object} DirectoryInstallItem
 * @property {string} name
 * @property {string} from - absolute path in the Plugin
 * @property {string} to - absolute path in the Consumer
 */

/**
 * @typedef {Object} DirectoryEntry
 * @property {'directory'} kind
 * @property {string} destinationDir - absolute path this entry clean-replaces wholesale
 * @property {DirectoryInstallItem[]} items
 */

/**
 * @typedef {Object} NamedInstallFile
 * @property {string} name - the destination file name
 * @property {string} contents - the exact bytes to write, header already rendered in
 */

/**
 * @typedef {Object} NamedEntry
 * @property {'named'} kind
 * @property {string} destinationDir - absolute path; never removed wholesale
 * @property {RegExp} namePattern - the only names this entry may inspect, write, or delete
 * @property {NamedInstallFile[]} files - the current shipped set
 */

/** @typedef {DirectoryEntry | NamedEntry} InstallEntry */

/**
 * @typedef {Object} InstallArtefactsOptions
 * @property {InstallEntry[]} entries
 * @property {(path: string, options: { recursive: boolean, force: boolean }) => void} [rmFn]
 * @property {(from: string, to: string, options: { recursive: boolean }) => void} [cpFn]
 * @property {(path: string, options: { recursive: boolean }) => void} [mkdirFn]
 * @property {(path: string) => string[]} [readdirFn]
 * @property {(path: string) => string} [readFileFn]
 * @property {(path: string, contents: string) => void} [writeFileFn]
 * @property {(path: string) => boolean} [existsFn]
 */

/**
 * @typedef {{ path: string, message: string }} SkippedArtefact
 */

/**
 * The `errno` code of a thrown filesystem error, or null when it carries none (a test double, a
 * plain `Error`). Null never matches a code, so an error without one takes the strict branch.
 *
 * @param {unknown} err
 * @returns {string | null}
 */
function errnoCode(err) {
	const code = /** @type {NodeJS.ErrnoException} */ (err)?.code
	return typeof code === 'string' ? code : null
}

/**
 * `added` is the subset of `written` whose destination name was absent before this run — what a new
 * Plugin version brought that the Consumer did not already have. It is a set difference over the
 * names the stale sweep already reads, never a second `readdir` (#295).
 *
 * @typedef {{ ok: true, written: string[], deleted: string[], added: string[], skipped: SkippedArtefact[] } | { ok: false, written: string[], deleted: string[], added: string[], skipped: SkippedArtefact[], stage: string, failed: string, cause: string }} InstallArtefactsResult
 */

/**
 * @param {InstallArtefactsOptions} options
 * @returns {InstallArtefactsResult}
 */
export function installArtefacts({
	entries,
	rmFn = (path, options) => rmSync(path, options),
	cpFn = (from, to, options) => cpSync(from, to, options),
	mkdirFn = (path, options) => mkdirSync(path, options),
	readdirFn = (path) => readdirSync(path),
	readFileFn = (path) => readFileSync(path, 'utf8'),
	writeFileFn = (path, contents) => writeFileSync(path, contents),
	existsFn = (path) => existsSync(path),
}) {
	/** @type {string[]} */
	const written = []
	/** @type {string[]} */
	const deleted = []
	/** @type {string[]} */
	const added = []
	/** @type {SkippedArtefact[]} */
	const skipped = []

	for (const entry of entries) {
		if (entry.kind === 'directory') {
			try {
				rmFn(entry.destinationDir, { recursive: true, force: true })
			} catch (err) {
				return {
					ok: false,
					written,
					deleted,
					added,
					skipped,
					stage: 'directory-clean',
					failed: entry.destinationDir,
					cause: /** @type {Error} */ (err).message,
				}
			}
			for (const item of entry.items) {
				try {
					cpFn(item.from, item.to, { recursive: true })
					written.push(item.to)
				} catch (err) {
					return {
						ok: false,
						written,
						deleted,
						added,
						skipped,
						stage: 'directory-copy',
						failed: item.to,
						cause: /** @type {Error} */ (err).message,
					}
				}
			}
			continue
		}

		// named entry — destinationDir itself is never removed; only names namePattern matches are
		// ever inspected, written, or deleted. A name outside that pattern is never even read.
		try {
			mkdirFn(entry.destinationDir, { recursive: true })
		} catch (err) {
			return {
				ok: false,
				written,
				deleted,
				added,
				skipped,
				stage: 'named-mkdir',
				failed: entry.destinationDir,
				cause: /** @type {Error} */ (err).message,
			}
		}

		const shippedNames = new Set(entry.files.map((file) => file.name))
		/** @type {string[]} */
		let existingNames = []
		if (existsFn(entry.destinationDir)) {
			try {
				existingNames = readdirFn(entry.destinationDir)
			} catch (err) {
				return {
					ok: false,
					written,
					deleted,
					added,
					skipped,
					stage: 'named-readdir',
					failed: entry.destinationDir,
					cause: /** @type {Error} */ (err).message,
				}
			}
		}

		// The complement of the stale sweep, from the same two name sets and no further `readdir`: a
		// shipped name absent from the destination is one this run adds rather than overwrites (#295).
		// `entry.files` is iterated, not `shippedNames`, to keep the shipped order the write loop below
		// uses — a `Set` carries insertion order, but the sorted order an operator reads in the Step 8
		// summary is `entry.files`'s, and only one of the two is a stated guarantee.
		const existingSet = new Set(existingNames)
		for (const file of entry.files) {
			if (!existingSet.has(file.name)) added.push(join(entry.destinationDir, file.name))
		}

		// Stale sweep, scoped strictly to namePattern. A stale match is deleted regardless of its
		// contents — ownership is decided by name alone. A match that cannot even be read is reported
		// in `skipped`, not silently left in place.
		//
		// Only ENOENT is forgiven, and only from the DELETION, never from the read. The read cannot be
		// the arbiter of absence: a dangling symlink reads ENOENT while its directory entry is still
		// listed and still stale, and forgiving that would leave a retired Box name in place under a
		// green `/setup` — this issue's motivating defect. The read stays a strict probe for every
		// other failure (EACCES, EISDIR); an ENOENT from it only means "let the delete decide".
		//
		// `force` stays false for the same reason: `force: true` would swallow the ENOENT inside `rm`,
		// and this loop would then record a `deleted` path it never deleted.
		for (const name of existingNames) {
			if (!entry.namePattern.test(name)) continue
			if (shippedNames.has(name)) continue
			const path = join(entry.destinationDir, name)
			try {
				readFileFn(path)
			} catch (err) {
				if (errnoCode(err) !== 'ENOENT') {
					skipped.push({ path, message: /** @type {Error} */ (err).message })
					continue
				}
			}
			try {
				rmFn(path, { recursive: false, force: false })
				deleted.push(path)
			} catch (err) {
				// The name is already absent — the end state this sweep wanted. Not `deleted`, because
				// this sweep did not delete it, and not `skipped`, because nothing was left behind.
				if (errnoCode(err) === 'ENOENT') continue
				skipped.push({ path, message: /** @type {Error} */ (err).message })
			}
		}

		for (const file of entry.files) {
			const path = join(entry.destinationDir, file.name)
			try {
				writeFileFn(path, file.contents)
				written.push(path)
			} catch (err) {
				return {
					ok: false,
					written,
					deleted,
					added,
					skipped,
					stage: 'named-write',
					failed: path,
					cause: /** @type {Error} */ (err).message,
				}
			}
		}
	}

	if (skipped.length > 0) {
		return {
			ok: false,
			written,
			deleted,
			added,
			skipped,
			stage: 'stale-sweep',
			failed: skipped.map((entry) => entry.path).join(', '),
			cause: skipped.map((entry) => `${entry.path} (${entry.message})`).join('; '),
		}
	}

	return { ok: true, written, deleted, added, skipped }
}

/** The first line of every artefact this engine header-stamps. Never matched as a substring. */
export const GENERATED_HEADER_PREFIX = '# Generated by unic-archon-dlc'

/**
 * The plugin name is a constant here, not a parameter: it is always this Plugin's own name, and
 * threading it through every call site as an argument only this module ever passes one value for
 * is dead weight (#294 review).
 *
 * @param {{ pluginVersion: string }} options
 * @returns {string}
 */
export function renderGeneratedHeader({ pluginVersion }) {
	return (
		`${GENERATED_HEADER_PREFIX}@${pluginVersion} — /setup replaces this file on every run; a local edit is lost on the next run.\n` +
		`# To keep a variant, copy it to a name outside the unic-dlc-* set — see README.md.\n\n`
	)
}

/**
 * Whether `contents` opens with the generated header — matched as a prefix of the first line only,
 * never as a substring search over the whole body. A Consumer file that merely mentions the marker
 * further down is not the same thing as a file this engine wrote (#294).
 *
 * @param {string} contents
 * @returns {boolean}
 */
export function hasGeneratedHeader(contents) {
	const firstLine = contents.split(/\r?\n/, 1)[0] ?? ''
	return firstLine.startsWith(GENERATED_HEADER_PREFIX)
}

/**
 * The version named in a generated header's first line, or null when that line does not open with
 * {@link GENERATED_HEADER_PREFIX} or carries no `@<version>` after it. Same first-line-prefix rule as
 * {@link hasGeneratedHeader}, never a substring search over the body.
 *
 * @param {string} contents
 * @returns {string | null}
 */
function parseGeneratedHeaderVersion(contents) {
	const firstLine = contents.split(/\r?\n/, 1)[0] ?? ''
	if (!firstLine.startsWith(GENERATED_HEADER_PREFIX)) return null
	const match = firstLine.slice(GENERATED_HEADER_PREFIX.length).match(/^@(\S+)/)
	return match ? match[1] : null
}

/** Every `unic-dlc-*.yaml` Box workflow, and nothing else — the naming convention, not a Box name. */
export const BOX_WORKFLOW_NAME_PATTERN = /^unic-dlc-.*\.yaml$/

/**
 * @typedef {Object} DiscoverBoxWorkflowEntryOptions
 * @property {string} pluginRoot
 * @property {string} repoRoot
 * @property {string} pluginVersion
 * @property {(path: string) => string[]} [readdirFn]
 * @property {(path: string) => string} [readFileFn]
 */

/**
 * Build the named install-set entry for the Box workflow YAMLs, discovering the shipped set by
 * reading the Plugin's own `.archon/workflows/` at install time.
 *
 * No Box name is a literal here: the set is whatever `readdirFn` returns that matches
 * {@link BOX_WORKFLOW_NAME_PATTERN}, so a Box added to or retired from the Plugin changes what
 * installs with no change to this function (#294).
 *
 * @param {DiscoverBoxWorkflowEntryOptions} options
 * @returns {NamedEntry}
 */
export function discoverBoxWorkflowEntry({
	pluginRoot,
	repoRoot,
	pluginVersion,
	readdirFn = (path) => readdirSync(path),
	readFileFn = (path) => readFileSync(path, 'utf8'),
}) {
	const sourceDir = join(pluginRoot, '.archon', 'workflows')
	// Sorted, because `readdir` order is whatever the filesystem returns — insertion order on ext4,
	// hash order elsewhere — and it flows straight through to `written[]` and the `/setup` Step 8
	// summary an operator reads. Plain `.sort()` on purpose: it orders by UTF-16 code unit, so the
	// result is identical on macOS, Windows and Linux. `localeCompare` would not be — it depends on
	// the runtime's ICU data.
	const names = readdirFn(sourceDir)
		.filter((name) => BOX_WORKFLOW_NAME_PATTERN.test(name))
		.sort()
	const header = renderGeneratedHeader({ pluginVersion })
	const files = names.map((name) => ({
		name,
		contents: header + readFileFn(join(sourceDir, name)),
	}))
	return {
		kind: 'named',
		destinationDir: join(repoRoot, '.archon', 'workflows'),
		namePattern: BOX_WORKFLOW_NAME_PATTERN,
		files,
	}
}

/**
 * @typedef {Object} InstallBoxWorkflowsOptions
 * @property {string} pluginRoot
 * @property {string} repoRoot
 * @property {string} pluginVersion
 * @property {(path: string) => string[]} [readdirFn]
 * @property {(path: string) => string} [readFileFn]
 * @property {(path: string, options: { recursive: boolean, force: boolean }) => void} [rmFn]
 * @property {(path: string, options: { recursive: boolean }) => void} [mkdirFn]
 * @property {(path: string, contents: string) => void} [writeFileFn]
 * @property {(path: string) => boolean} [existsFn]
 */

/**
 * `previousVersion` is the version that wrote the Boxes already installed, or null when this run
 * cannot name one — a fresh Consumer, a file with no generated header, a header with no `@version`.
 *
 * @typedef {InstallArtefactsResult & { previousVersion: string | null }} InstallBoxWorkflowsResult
 */

/**
 * The version stamped on the Boxes already in the Consumer's `.archon/workflows/`, read **before**
 * anything is written — after the install every header names the version being installed, so this
 * value only exists ahead of the write loop (#295).
 *
 * One file is read: the first name in sorted order that this run both ships and finds on disk. Headers
 * are never cross-checked between files — they disagree only after a partially failed install, which
 * Step 6 already reports as a failure. A missing directory, an unreadable file and an unparseable
 * header are all the same answer here — null — because the summary line this feeds says
 * `upgraded from: unknown`, and no caller acts on which of the three it was.
 *
 * @param {NamedEntry} entry
 * @param {{ readdirFn: (path: string) => string[], readFileFn: (path: string) => string, existsFn: (path: string) => boolean }} fns
 * @returns {string | null}
 */
function readInstalledBoxVersion(entry, { readdirFn, readFileFn, existsFn }) {
	if (!existsFn(entry.destinationDir)) return null
	/** @type {string[]} */
	let existingNames
	try {
		existingNames = readdirFn(entry.destinationDir)
	} catch {
		return null
	}
	const present = new Set(existingNames)
	const first = entry.files
		.map((file) => file.name)
		.sort()
		.find((name) => present.has(name))
	if (!first) return null
	try {
		return parseGeneratedHeaderVersion(readFileFn(join(entry.destinationDir, first)))
	} catch {
		return null
	}
}

/**
 * Discover and install the Box workflow YAMLs into the Consumer's `.archon/workflows/`.
 *
 * The destination directory is listed twice — once here for the header read, once inside
 * {@link installArtefacts} for its own `existingNames`. That is accepted rather than avoided: folding
 * the two would move the header parse inside the engine, which knows nothing about Box versions
 * (#295 D2).
 *
 * @param {InstallBoxWorkflowsOptions} options
 * @returns {InstallBoxWorkflowsResult}
 */
export function installBoxWorkflows({
	pluginRoot,
	repoRoot,
	pluginVersion,
	readdirFn,
	readFileFn,
	rmFn,
	mkdirFn,
	writeFileFn,
	existsFn,
}) {
	const entry = discoverBoxWorkflowEntry({ pluginRoot, repoRoot, pluginVersion, readdirFn, readFileFn })
	const previousVersion = readInstalledBoxVersion(entry, {
		readdirFn: readdirFn ?? ((path) => readdirSync(path)),
		readFileFn: readFileFn ?? ((path) => readFileSync(path, 'utf8')),
		existsFn: existsFn ?? ((path) => existsSync(path)),
	})
	const result = installArtefacts({ entries: [entry], rmFn, mkdirFn, readdirFn, readFileFn, writeFileFn, existsFn })
	return { ...result, previousVersion }
}
