// @ts-check
import { createHash } from 'node:crypto'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parse as parseYaml } from 'yaml'
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
 * Check that every manifest entry has its `SKILL.md` in the bundle.
 *
 * This is the check that replaced the `skills.matt_suite` probe. A miss means the shipped Plugin is
 * incomplete — a Plugin bug, not a Consumer gap — so the caller stops rather than degrading.
 *
 * @param {VerifyBundleOptions} options
 * @returns {VerifyBundleResult}
 */
export function verifyBundle({ bundleRoot, existsFn = existsSync }) {
	const missing = METHODS_MANIFEST.map((entry) => entry.upstreamPath).filter(
		(upstreamPath) => !existsFn(join(bundleRoot, upstreamPath))
	)
	if (missing.length > 0) return { ok: false, missing }
	return { ok: true }
}

/**
 * @typedef {Object} VerifyLicenceOptions
 * @property {string} bundleRoot - absolute path to `vendor/mattpocock-skills`
 * @property {(path: string) => Buffer | string} [readFileFn] - injectable for tests
 */

/**
 * @typedef {{ ok: true, sha256: string } | { ok: false, code: 'missing' | 'mismatch', message: string }} VerifyLicenceResult
 */

/**
 * Verify the vendored `LICENSE` is byte-identical to upstream's at the bundled tag.
 *
 * An absent file returns `code: 'missing'` and tells the caller to warn the maintainer. It must
 * never be auto-created: `LICENSE` files in this repository are maintainer-owned (AGENTS.md).
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
		return {
			ok: false,
			code: 'missing',
			message:
				`Cannot read the vendored licence at ${licencePath} (${/** @type {Error} */ (err).message}). ` +
				`Stop and ask the maintainer to add ${METHODS_BUNDLE.repo}'s ${METHODS_BUNDLE.licence} LICENSE ` +
				'at that path — an agent must never create a LICENSE file.',
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
 * Install the bundle into `<repoRoot>/.archon/methods/<name>/`, replacing whatever was there.
 *
 * Clean-replace, not merge: a Method dropped from the manifest in a later version must not linger on
 * disk, where `resolveMethod` would keep resolving it at the `bundle` tier. `rmSync` needs both
 * options spelled out — `recursive` defaults to `false`, and `force` defaults to `false`, so a
 * first-ever install with no `.archon/methods/` yet would throw instead of no-op'ing.
 *
 * The installed tree is flat, keyed by canonical Method name, because that is what `resolveMethod`
 * reads; only the vendored source mirrors upstream's category directories.
 *
 * `.archon/methods.local/` is never touched (that tier is the operator's uncommitted working copy).
 *
 * @param {InstallMethodsOptions} options
 * @returns {{ ok: true, installed: string[] }}
 */
export function installMethods({ bundleRoot, repoRoot, rmFn = rmSync, cpFn = cpSync }) {
	rmFn(join(repoRoot, INSTALL_DIR), { recursive: true, force: true })
	const installed = METHODS_MANIFEST.map((entry) => {
		cpFn(join(bundleRoot, dirname(entry.upstreamPath)), join(repoRoot, INSTALL_DIR, entry.name), { recursive: true })
		return entry.name
	})
	return { ok: true, installed }
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
