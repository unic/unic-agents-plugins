// @ts-check
import { execFileSync } from 'node:child_process'

// Intentionally immutable; update this list in code as schema-incompatible Archon versions are identified.
// Tests and callers can pass overrides via checkArchon(..., { incompatibleVersions }).
export const INCOMPATIBLE_ARCHON_VERSIONS = /** @type {readonly string[]} */ (Object.freeze([]))

// Behavioural min-floor (ADR-0011/0019/0033): the key-discriminated schema — gates/loops/
// fresh-context — plus `evidence_policy` and `always_run` only run correctly on Archon >= 0.7.0.
// This replaces the fictional exact-version assertion.
export const MIN_ARCHON_VERSION = '0.7.0'

/**
 * @typedef {{ ok: true, version: string }} ArchonOk
 * @typedef {{ ok: false, code: 'enoent' | 'incompatible' | 'other', message: string }} ArchonFail
 * @typedef {ArchonOk | ArchonFail} ArchonCheckResult
 */

/**
 * @typedef {(cmd: string, args: readonly string[], opts: object) => Buffer | string} ExecFn
 */

/**
 * Parse a `major.minor.patch` triple out of an `archon --version` string (which may carry a
 * program-name prefix, a `v` prefix, or a pre-release suffix). Returns null when no triple is found.
 * @param {string} raw
 * @returns {[number, number, number] | null}
 */
export function parseVersion(raw) {
	const match = raw.match(/(\d+)\.(\d+)\.(\d+)/)
	if (!match) return null
	return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Returns true when `version` is strictly below `floor`. Unparseable versions are treated as
 * satisfying the floor (non-blocking — see ADR-0019 warn-and-degrade posture).
 * @param {string} version
 * @param {string} floor
 * @returns {boolean}
 */
function isBelow(version, floor) {
	const v = parseVersion(version)
	const f = parseVersion(floor)
	if (!v || !f) return false
	for (let i = 0; i < 3; i++) {
		if (v[i] < f[i]) return true
		if (v[i] > f[i]) return false
	}
	return false
}

/**
 * @typedef {Object} CheckArchonOptions
 * @property {readonly string[]} [incompatibleVersions] - exact version strings to reject outright
 * @property {string} [minVersion] - behavioural min-floor (default {@link MIN_ARCHON_VERSION})
 */

/**
 * Checks whether archon is on PATH and meets the behavioural min-floor — never calls process.exit().
 * Pass a custom execFn in tests to avoid requiring archon on PATH.
 *
 * @param {ExecFn} [execFn]
 * @param {CheckArchonOptions | readonly string[]} [options] - options object; a bare array is
 *   accepted as `incompatibleVersions` for backward compatibility.
 * @returns {ArchonCheckResult}
 */
export function checkArchon(execFn = /** @type {ExecFn} */ (/** @type {unknown} */ (execFileSync)), options = {}) {
	const opts = /** @type {CheckArchonOptions} */ (Array.isArray(options) ? { incompatibleVersions: options } : options)
	const incompatibleVersions = opts.incompatibleVersions ?? INCOMPATIBLE_ARCHON_VERSIONS
	const minVersion = opts.minVersion ?? MIN_ARCHON_VERSION

	try {
		const version = execFn('archon', ['--version'], {
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout: 5000,
		})
			.toString()
			.trim()

		if (incompatibleVersions.includes(version)) {
			return {
				ok: false,
				code: 'incompatible',
				message: `Archon ${version} has known schema incompatibilities with unic-archon-dlc. Please upgrade Archon.`,
			}
		}

		if (isBelow(version, minVersion)) {
			return {
				ok: false,
				code: 'incompatible',
				message: `Archon ${version} is below the minimum supported version ${minVersion}. The key-discriminated workflow schema (gates, loops, fresh-context, evidence_policy, always_run) requires Archon >= ${minVersion}. Please upgrade Archon.`,
			}
		}

		return { ok: true, version }
	} catch (err) {
		if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
			return {
				ok: false,
				code: 'enoent',
				message:
					'archon binary not found on PATH. Install Archon before using this plugin. See the README for instructions.',
			}
		}
		const spawnErr = /** @type {Error & { stderr?: Buffer }} */ (err)
		const stderrText = spawnErr.stderr ? spawnErr.stderr.toString().trim() : ''
		return {
			ok: false,
			code: 'other',
			message: `Failed to run archon: ${spawnErr.message}${stderrText ? ` (stderr: ${stderrText})` : ''}`,
		}
	}
}
