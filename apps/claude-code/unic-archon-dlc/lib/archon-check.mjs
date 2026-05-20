// @ts-check
import { execFileSync } from 'node:child_process'

// Populated as schema-incompatible Archon versions are observed
export const INCOMPATIBLE_ARCHON_VERSIONS = /** @type {string[]} */ ([])

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
 * @returns {ArchonCheckResult}
 */
export function checkArchon(execFn = /** @type {ExecFn} */ (/** @type {unknown} */ (execFileSync))) {
	try {
		const version = execFn('archon', ['--version'], {
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout: 5000,
		})
			.toString()
			.trim()

		if (INCOMPATIBLE_ARCHON_VERSIONS.includes(version)) {
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
		return {
			ok: false,
			code: 'other',
			message: `Failed to run archon: ${/** @type {Error} */ (err).message}`,
		}
	}
}
