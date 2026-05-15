// @ts-check
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @typedef {Object} FilePresence
 * @property {boolean} present
 * @property {string | null} content
 */

/**
 * @typedef {Object} ProjectSnapshot
 * @property {string | null} gitRemote  - origin URL or null if absent / not a git repo
 * @property {FilePresence} claudeMd
 * @property {FilePresence} contextMd
 * @property {FilePresence} contextMapMd
 * @property {string[]} adrFiles        - basenames of .md files in docs/adr/
 * @property {boolean} archonConfigPresent
 * @property {string | null} existingConfig  - raw JSON string if present, else null
 */

/**
 * @param {string} filePath
 * @returns {FilePresence}
 */
function readOptional(filePath) {
	if (!existsSync(filePath)) return { present: false, content: null }
	try {
		return { present: true, content: readFileSync(filePath, 'utf8') }
	} catch (err) {
		// Re-throw unexpected errors (e.g. EACCES, EISDIR) so callers are not
		// silently misled into thinking the file is merely absent.
		const code = /** @type {NodeJS.ErrnoException} */ (err).code
		if (code === 'ENOENT') return { present: false, content: null }
		throw err
	}
}

/**
 * Reads project state without throwing on missing files.
 * @param {string} projectDir - absolute path to the target project root
 * @returns {Promise<ProjectSnapshot>}
 */
export async function exploreProject(projectDir) {
	let gitRemote = null
	try {
		const raw = execFileSync('git', ['remote', 'get-url', 'origin'], {
			cwd: projectDir,
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout: 5000,
		})
			.toString()
			.trim()
		gitRemote = raw || null
	} catch (err) {
		// Expected: not a git repo, no 'origin' remote, or git not on PATH.
		// These all produce a non-zero exit code / ENOENT and are non-fatal.
		// Re-throw genuinely unexpected errors (timeouts surface as ETIMEDOUT,
		// but execFileSync wraps them in a plain Error — we rely on the timeout
		// option to keep the window short and accept those as non-fatal too).
		const code = /** @type {NodeJS.ErrnoException} */ (err).code
		// ENOENT = git binary absent; status != 0 = no remote / not a git repo
		// Anything else (e.g. ENOMEM, EPERM) is truly unexpected — log and continue
		// rather than silently swallowing, so operators see the warning.
		if (code !== undefined && code !== 'ENOENT') {
			process.stderr.write(
				`[unic-archon-dlc] Warning: unexpected error reading git remote (${code}): ${/** @type {Error} */ (err).message}\n`
			)
		}
		// gitRemote stays null — callers handle this gracefully
	}

	const claudeMd = readOptional(join(projectDir, 'CLAUDE.md'))
	const contextMd = readOptional(join(projectDir, 'CONTEXT.md'))
	const contextMapMd = readOptional(join(projectDir, 'CONTEXT-MAP.md'))

	let adrFiles = /** @type {string[]} */ ([])
	try {
		adrFiles = readdirSync(join(projectDir, 'docs', 'adr')).filter((f) => f.endsWith('.md'))
	} catch (err) {
		// Only tolerate a missing docs/adr directory; re-throw permission or other I/O errors.
		const code = /** @type {NodeJS.ErrnoException} */ (err).code
		if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err
		// docs/adr absent — treat as empty
	}

	const archonConfig = readOptional(join(projectDir, '.archon', 'unic-dlc.config.json'))

	return {
		gitRemote,
		claudeMd,
		contextMd,
		contextMapMd,
		adrFiles,
		archonConfigPresent: archonConfig.present,
		existingConfig: archonConfig.present ? archonConfig.content : null,
	}
}
