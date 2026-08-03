// @ts-check
import { existsSync } from 'node:fs'
import { isAbsolute, resolve, sep } from 'node:path'
import { findMethod, resolveAlias } from './methods-manifest.mjs'

/**
 * Three-tier Method resolution. A Box asks for a Method by name; this module answers with the
 * `SKILL.md` the Harness should read, and says which tier answered.
 *
 * Tier order, first hit wins:
 *   1. `config`  — `methods.<name>.source` in `.archon/unic-dlc.config.yaml` (the team's own fork)
 *   2. `local`   — `.archon/methods.local/<name>/SKILL.md` (an uncommitted working override)
 *   3. `bundle`  — `.archon/methods/<name>/SKILL.md` (the vendored default, issue #284)
 *
 * Every return is a value, never a throw — mirroring `archon-check.mjs` and `config-schema.mjs`.
 */

/**
 * @typedef {Object} ResolvedMethod
 * @property {string} name - canonical Method name (an alias input is normalised away)
 * @property {string} path - absolute path to the resolved `SKILL.md`
 * @property {'config' | 'local' | 'bundle'} tier
 */

/**
 * @typedef {Object} ResolveError
 * @property {true} error
 * @property {string} name - canonical Method name, or the raw input when it matched no entry
 * @property {string} box - the Box that asked, so the operator knows which command to fix
 * @property {string} message
 */

/**
 * @typedef {(path: string) => boolean} ExistsFn
 */

/**
 * @typedef {Object} ResolveMethodOptions
 * @property {string} repoRoot - the Consumer repository root; every resolved path must sit inside it
 * @property {Record<string, any>} [config] - the loaded `.archon/unic-dlc.config.yaml` object
 * @property {string} [box] - the Box requesting the Method (used in error messages)
 * @property {ExistsFn} [existsFn] - injectable for tests, mirroring `checkArchon`'s `execFn`
 */

const CONFIG_TIER = 'config'
const LOCAL_TIER = 'local'
const BUNDLE_TIER = 'bundle'

/**
 * Why a candidate path may not be used, or null when it is safe.
 *
 * Backslashes are normalised before analysis so a Windows-style escape (`..\\..\\etc`) is caught on
 * POSIX too, where it would otherwise read as one harmless filename. Drive letters and UNC prefixes
 * are rejected explicitly for the same reason — `isAbsolute` on POSIX does not recognise them.
 *
 * @param {string} candidate - a repo-relative path as written by config or built by this module
 * @param {string} repoRoot
 * @returns {string | null}
 */
function unsafeReason(candidate, repoRoot) {
	const normalised = candidate.replace(/\\/g, '/')
	if (normalised.startsWith('~')) return 'points outside the repository via a home-directory reference'
	if (isAbsolute(candidate) || normalised.startsWith('/') || /^[A-Za-z]:/.test(normalised)) {
		return 'is an absolute path'
	}
	const root = resolve(repoRoot)
	const target = resolve(root, normalised)
	// The trailing separator matters: without it, `/repo-evil` passes a bare `/repo` prefix test.
	if (target !== root && !target.startsWith(root + sep)) return 'escapes the repository root'
	return null
}

/**
 * @param {string} name
 * @param {string} box
 * @param {string} message
 * @returns {ResolveError}
 */
function fail(name, box, message) {
	return { error: true, name, box, message }
}

/**
 * Resolve a Method name to the `SKILL.md` a Box should read.
 *
 * @param {string} name - canonical Method name or a legacy alias
 * @param {ResolveMethodOptions} options
 * @returns {ResolvedMethod | ResolveError}
 */
export function resolveMethod(name, { repoRoot, config, box = 'unknown', existsFn = existsSync }) {
	const canonical = resolveAlias(name)
	if (!findMethod(canonical)) {
		return fail(canonical, box, `Method "${canonical}" (requested by Box "${box}") is not in the Method manifest`)
	}

	// Tier 1 — config. A declared override is authoritative on declaration alone: falling through to
	// a bundled default because the operator's path is missing would silently ignore their choice,
	// which is the failure mode this whole slice exists to eliminate. An empty string is not a
	// declaration.
	const source = config?.methods?.[canonical]?.source
	if (typeof source === 'string' && source.trim() !== '') {
		const reason = unsafeReason(source, repoRoot)
		if (reason) {
			return fail(
				canonical,
				box,
				`Method "${canonical}" (requested by Box "${box}") has a ${CONFIG_TIER}-tier source "${source}" that ${reason}`
			)
		}
		return { name: canonical, path: resolve(repoRoot, source.replace(/\\/g, '/')), tier: CONFIG_TIER }
	}

	// Tiers 2 and 3 — fixed, repo-relative locations. They are guarded too: `repoRoot` itself is
	// caller-supplied, so the containment check is the only thing proving the result stays in-repo.
	const fsTiers = /** @type {const} */ ([
		[LOCAL_TIER, `.archon/methods.local/${canonical}/SKILL.md`],
		[BUNDLE_TIER, `.archon/methods/${canonical}/SKILL.md`],
	])

	for (const [tier, candidate] of fsTiers) {
		const reason = unsafeReason(candidate, repoRoot)
		if (reason) {
			return fail(
				canonical,
				box,
				`Method "${canonical}" (requested by Box "${box}") resolved to a ${tier}-tier path "${candidate}" that ${reason}`
			)
		}
		const absolute = resolve(repoRoot, candidate)
		if (existsFn(absolute)) return { name: canonical, path: absolute, tier }
	}

	return fail(canonical, box, `Method "${canonical}" (requested by Box "${box}") did not resolve at any tier`)
}
