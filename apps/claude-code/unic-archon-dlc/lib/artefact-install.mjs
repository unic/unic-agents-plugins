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
 * artefact it meant to retire is still on disk.
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
 * @typedef {{ ok: true, written: string[], deleted: string[], skipped: SkippedArtefact[] } | { ok: false, written: string[], deleted: string[], skipped: SkippedArtefact[], stage: string, failed: string, cause: string }} InstallArtefactsResult
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
					skipped,
					stage: 'named-readdir',
					failed: entry.destinationDir,
					cause: /** @type {Error} */ (err).message,
				}
			}
		}

		// Stale sweep, scoped strictly to namePattern. A stale match is deleted regardless of its
		// contents — ownership is decided by name alone. A match that cannot even be read is reported
		// in `skipped`, not silently left in place.
		for (const name of existingNames) {
			if (!entry.namePattern.test(name)) continue
			if (shippedNames.has(name)) continue
			const path = join(entry.destinationDir, name)
			try {
				readFileFn(path)
				rmFn(path, { recursive: false, force: false })
				deleted.push(path)
			} catch (err) {
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
			skipped,
			stage: 'stale-sweep',
			failed: skipped.map((entry) => entry.path).join(', '),
			cause: skipped.map((entry) => `${entry.path} (${entry.message})`).join('; '),
		}
	}

	return { ok: true, written, deleted, skipped }
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
	const names = readdirFn(sourceDir).filter((name) => BOX_WORKFLOW_NAME_PATTERN.test(name))
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
 * Discover and install the Box workflow YAMLs into the Consumer's `.archon/workflows/`.
 *
 * @param {InstallBoxWorkflowsOptions} options
 * @returns {InstallArtefactsResult}
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
	return installArtefacts({ entries: [entry], rmFn, mkdirFn, readdirFn, readFileFn, writeFileFn, existsFn })
}
