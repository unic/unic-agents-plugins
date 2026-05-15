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
	} catch {
		return { present: false, content: null }
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
	} catch {
		// not a git repo, no remote, or git not on PATH
	}

	const claudeMd = readOptional(join(projectDir, 'CLAUDE.md'))
	const contextMd = readOptional(join(projectDir, 'CONTEXT.md'))
	const contextMapMd = readOptional(join(projectDir, 'CONTEXT-MAP.md'))

	let adrFiles = /** @type {string[]} */ ([])
	try {
		adrFiles = readdirSync(join(projectDir, 'docs', 'adr')).filter((f) => f.endsWith('.md'))
	} catch {
		// docs/adr absent or unreadable — treat as empty
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
