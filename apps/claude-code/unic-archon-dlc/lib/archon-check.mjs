// @ts-check
import { execFileSync } from 'node:child_process'

// Populated as schema-incompatible Archon versions are observed
export const INCOMPATIBLE_ARCHON_VERSIONS = /** @type {readonly string[]} */ (Object.freeze([]))

/**
 * @typedef {{ ok: true, version: string }} ArchonOk
 * @typedef {{ ok: false, code: 'enoent' | 'incompatible' | 'other', message: string }} ArchonFail
 * @typedef {ArchonOk | ArchonFail} ArchonCheckResult
 */

/**
 * @typedef {(cmd: string, args: readonly string[], opts: object) => Buffer | string} ExecFn
 */

/**
 * Checks whether archon is on PATH and returns a result object — never calls process.exit().
 * Pass a custom execFn in tests to avoid requiring archon on PATH.
 *
 * @param {ExecFn} [execFn]
 * @param {readonly string[]} [incompatibleVersions]
 * @returns {ArchonCheckResult}
 */
export function checkArchon(
	execFn = /** @type {ExecFn} */ (/** @type {unknown} */ (execFileSync)),
	incompatibleVersions = INCOMPATIBLE_ARCHON_VERSIONS
) {
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
