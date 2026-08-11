// @ts-check
import { createHash } from 'node:crypto'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { installArtefacts } from './artefact-install.mjs'
import { METHODS_BUNDLE, METHODS_MANIFEST } from './methods-manifest.mjs'

/**
 * The vendored Method bundle: verify it, install it, and report on Local overrides.
 *
 * `/setup` Step 6 is the only caller. Before this module, `/setup` probed the Consumer's separately
 * installed copy of Matt's skill suite and recorded `skills.matt_suite: { present, missing }` — a
 * question the Bundle now answers by construction, so the probe is replaced by an integrity check on
 * files this Plugin itself ships (`verifyLicence` + `verifyBundle`).
 *
 * Node APIs only, no shell: every filesystem operation must work on macOS, Windows and Linux. Every
 * return is a value, never a throw for an expected failure — mirroring `archon-check.mjs` and
 * `config-schema.mjs`.
 */

/** Where `installMethods` writes. The Local-override tier is never read or written from here. */
const INSTALL_DIR = '.archon/methods'

/** Read-only: `inspectLocalOverrides` reports on this tree, and nothing in this module writes to it. */
const LOCAL_DIR = '.archon/methods.local'

/**
 * @typedef {(path: string) => boolean} ExistsFn
 */

/**
 * @typedef {Object} VerifyBundleOptions
 * @property {string} bundleRoot - absolute path to `vendor/mattpocock-skills`
 * @property {ExistsFn} [existsFn] - injectable for tests, mirroring `checkArchon`'s `execFn`
 */

/**
 * @typedef {{ ok: true } | { ok: false, missing: string[] }} VerifyBundleResult
 */

/**
 * Every bundle-relative path a Method ships: its `SKILL.md`, then each declared sub-file.
 *
 * Built with forward slashes to match how `upstreamPath` is written; `join` normalises them per
 * platform at the point of use.
 *
 * @param {import('./methods-manifest.mjs').MethodEntry} entry
 * @returns {string[]}
 */
function methodFiles(entry) {
	const methodDir = dirname(entry.upstreamPath)
	return [entry.upstreamPath, ...entry.subFiles.map((file) => `${methodDir}/${file}`)]
}

/**
 * Check that every file every manifest entry declares is in the bundle.
 *
 * This is the check that replaced the `skills.matt_suite` probe. A miss means the shipped Plugin is
 * incomplete — a Plugin bug, not a Consumer gap — so the caller stops rather than degrading.
 *
 * Sub-files are checked, not just each `SKILL.md`. Several Methods read their own companion files
 * (`tdd` reads `tests.md`, `triage` reads `AGENT-BRIEF.md`), so a re-vendor that drops one would
 * otherwise install a Method whose text points at a file no longer on disk — and every existing test
 * would still pass, because the closure scan reads whatever files it finds rather than a fixed list.
 *
 * @param {VerifyBundleOptions} options
 * @returns {VerifyBundleResult}
 */
export function verifyBundle({ bundleRoot, existsFn = existsSync }) {
	const missing = METHODS_MANIFEST.flatMap(methodFiles).filter((path) => !existsFn(join(bundleRoot, path)))
	if (missing.length > 0) return { ok: false, missing }
	return { ok: true }
}

/**
 * @typedef {Object} VerifyLicenceOptions
 * @property {string} bundleRoot - absolute path to `vendor/mattpocock-skills`
 * @property {(path: string) => Buffer | string} [readFileFn] - injectable for tests
 */

/**
 * @typedef {{ ok: true, sha256: string } | { ok: false, code: 'missing' | 'unreadable' | 'mismatch', message: string }} VerifyLicenceResult
 */

/**
 * Verify the vendored `LICENSE` is byte-identical to upstream's at the bundled tag.
 *
 * An absent file returns `code: 'missing'` and tells the caller to warn the maintainer. It must
 * never be auto-created: `LICENSE` files in this repository are maintainer-owned (AGENTS.md). A file
 * that exists but can't be read (permissions, `EISDIR`, a transient FS error) returns `code:
 * 'unreadable'` instead — that is not a "please add it" situation.
 *
 * @param {VerifyLicenceOptions} options
 * @returns {VerifyLicenceResult}
 */
export function verifyLicence({ bundleRoot, readFileFn = readFileSync }) {
	const licencePath = join(bundleRoot, 'LICENSE')
	let contents
	try {
		contents = readFileFn(licencePath)
	} catch (err) {
		const code = /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT' ? 'missing' : 'unreadable'
		return {
			ok: false,
			code,
			message:
				code === 'missing'
					? `Cannot find the vendored licence at ${licencePath}. Stop and ask the maintainer to add ` +
						`${METHODS_BUNDLE.repo}'s ${METHODS_BUNDLE.licence} LICENSE at that path — an agent must never create a LICENSE file.`
					: `Cannot read the vendored licence at ${licencePath} (${/** @type {Error} */ (err).message}). ` +
						'This looks like a permissions or filesystem problem, not a missing file — investigate before assuming the LICENSE needs restoring.',
		}
	}
	const sha256 = createHash('sha256').update(contents).digest('hex')
	if (sha256 !== METHODS_BUNDLE.licenceSha256) {
		return {
			ok: false,
			code: 'mismatch',
			message:
				`The vendored licence at ${licencePath} is not the ${METHODS_BUNDLE.repo} licence at ` +
				`${METHODS_BUNDLE.tag}: expected sha256 ${METHODS_BUNDLE.licenceSha256}, got ${sha256}. ` +
				'Restore the upstream file rather than editing it.',
		}
	}
	return { ok: true, sha256 }
}

/**
 * @typedef {Object} InstallMethodsOptions
 * @property {string} bundleRoot - absolute path to `vendor/mattpocock-skills`
 * @property {string} repoRoot - the Consumer repository root
 * @property {(path: string, options: { recursive: boolean, force: boolean }) => void} [rmFn] - injectable for tests
 * @property {(from: string, to: string, options: { recursive: boolean }) => void} [cpFn] - injectable for tests
 */

/**
 * @typedef {{ ok: true, installed: string[] } | { ok: false, installed: string[], failed: string, message: string }} InstallMethodsResult
 */

/**
 * Install the bundle into `<repoRoot>/.archon/methods/<name>/`, replacing whatever was there.
 *
 * A thin, Method-specific wrapper over the generic `installArtefacts` engine (`lib/artefact-install.mjs`,
 * #294): it declares one whole-dir entry — Methods are entirely plugin-owned, so the whole
 * `.archon/methods/` directory is wiped and rebuilt, unlike the name-scoped Box-workflow entry that
 * engine also serves. `rmSync` needs both options spelled out — `recursive` defaults to `false`, and
 * `force` defaults to `false`, so a first-ever install with no `.archon/methods/` yet would throw
 * instead of no-op'ing.
 *
 * The installed tree is flat, keyed by canonical Method name, because that is what `resolveMethod`
 * reads; only the vendored source mirrors upstream's category directories.
 *
 * `.archon/methods.local/` is never touched (that tier is the operator's uncommitted working copy).
 *
 * A failure mid-copy (`EBUSY`/`ENOSPC`/`EACCES`) is caught per-item rather than left to propagate: the
 * `rmFn` above already ran, so the caller needs to know exactly which Methods made it to disk and which
 * didn't, not just that something threw.
 *
 * @param {InstallMethodsOptions} options
 * @returns {InstallMethodsResult}
 */
export function installMethods({ bundleRoot, repoRoot, rmFn = rmSync, cpFn = cpSync }) {
	const items = METHODS_MANIFEST.map((entry) => ({
		name: entry.name,
		sourcePath: join(bundleRoot, dirname(entry.upstreamPath)),
	}))
	const [result] = installArtefacts({
		entries: [{ name: 'methods', destDir: join(repoRoot, INSTALL_DIR), items, ownsWholeDir: true }],
		pluginName: 'unic-archon-dlc',
		rmFn,
		cpFn,
	})
	if (!result.ok) {
		return {
			ok: false,
			installed: result.installed,
			failed: result.failed,
			message:
				`Failed to install Method "${result.failed}" into ${INSTALL_DIR} (${result.error.message}). ` +
				`${result.installed.length} Method(s) installed before the failure; re-run /unic-archon-dlc:setup to retry — it clean-replaces the tree.`,
		}
	}
	return { ok: true, installed: result.installed }
}

/**
 * @typedef {Object} LocalOverride
 * @property {string} name - the override directory name, which is the Method name it shadows
 * @property {string | null} forkedFrom - the `forked_from` frontmatter value, or null when absent
 * @property {boolean} matchesBundle - whether `forkedFrom` equals the bundled tag
 */

/**
 * @typedef {Object} InspectLocalOverridesOptions
 * @property {string} repoRoot - the Consumer repository root
 * @property {ExistsFn} [existsFn] - injectable for tests
 * @property {(path: string) => string[]} [readdirFn] - injectable for tests; returns entry names
 * @property {(path: string) => string} [readFileFn] - injectable for tests
 */

/** The leading `---` … `---` YAML frontmatter fence of a `SKILL.md`. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/

/**
 * Read the `forked_from` frontmatter of a `SKILL.md`, or null when there is none to read.
 * @param {string} contents
 * @returns {string | null}
 */
function readForkedFrom(contents) {
	const match = contents.match(FRONTMATTER)
	if (!match) return null
	let parsed
	try {
		parsed = parseYaml(match[1])
	} catch {
		// Unparseable frontmatter is an unversioned override, which is exactly what gets flagged.
		return null
	}
	if (typeof parsed !== 'object' || parsed === null) return null
	const value = /** @type {Record<string, unknown>} */ (parsed).forked_from
	return typeof value === 'string' ? value : null
}

/**
 * Report every Local override and whether it was forked from the bundled tag.
 *
 * A missing `forked_from` is reported as `forkedFrom: null, matchesBundle: false`, never skipped: an
 * unversioned override is the case this check exists for. The value lives in the override's own
 * frontmatter rather than in config, because committed metadata about an uncommitted override drifts.
 *
 * @param {InspectLocalOverridesOptions} options
 * @returns {LocalOverride[]}
 */
export function inspectLocalOverrides({
	repoRoot,
	existsFn = existsSync,
	readdirFn = (path) => readdirSync(path),
	readFileFn = (path) => readFileSync(path, 'utf8'),
}) {
	const localRoot = join(repoRoot, LOCAL_DIR)
	if (!existsFn(localRoot)) return []

	/** @type {LocalOverride[]} */
	const overrides = []
	for (const name of readdirFn(localRoot)) {
		const skillPath = join(localRoot, name, 'SKILL.md')
		if (!existsFn(skillPath)) continue
		let forkedFrom = null
		try {
			forkedFrom = readForkedFrom(readFileFn(skillPath))
		} catch {
			// An unreadable override is still an override — report it as unversioned.
		}
		overrides.push({ name, forkedFrom, matchesBundle: forkedFrom === METHODS_BUNDLE.tag })
	}
	return overrides
}
