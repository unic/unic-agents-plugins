// @ts-check
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @typedef {Object} PrdValidationResult
 * @property {boolean} valid - true if every required heading is present
 * @property {string[]} missingSections - headings that were not found
 */

/**
 * The seven canonical PRD section headings — the default `validatePrdSections` heading-set (the
 * validation contract) used when the caller passes no explicit headings. These match the `##`
 * headings in `DEFAULT_PRD_TEMPLATE` (config-schema.mjs) — keep the two in sync.
 * @type {readonly string[]}
 */
export const DEFAULT_PRD_HEADINGS = [
	'Problem Statement',
	'Solution',
	'User Stories',
	'Implementation Decisions',
	'Testing Decisions',
	'Out of Scope',
	'Further Notes',
]

/**
 * Resolve the PRD directory for a slug: `<artifactsDir>/<slug>/`.
 * @param {string} projectDir
 * @param {string} slug
 * @param {string} artifactsDir
 * @returns {string}
 */
function prdDir(projectDir, slug, artifactsDir) {
	return join(projectDir, artifactsDir, slug)
}

/**
 * Write already-shaped PRD content to `<artifactsDir>/<slug>/PRD.md`, creating the directory if
 * absent and overwriting any existing PRD.md. The template lives in config (`templates.prd`,
 * ADR-0018) and `/specs` renders it — this function only persists the final string.
 * @param {string} projectDir
 * @param {string} slug
 * @param {string} content - the full rendered PRD markdown
 * @param {string} [artifactsDir] - config `artifacts_dir` (default `'workflows'`)
 */
export function writePrd(projectDir, slug, content, artifactsDir = 'workflows') {
	const dir = prdDir(projectDir, slug, artifactsDir)
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, 'PRD.md'), content)
}

/**
 * Read PRD.md for the given slug. Returns null if the file does not exist.
 * @param {string} projectDir
 * @param {string} slug
 * @param {string} [artifactsDir] - config `artifacts_dir` (default `'workflows'`)
 * @returns {string | null}
 */
export function readPrd(projectDir, slug, artifactsDir = 'workflows') {
	const prdPath = join(prdDir(projectDir, slug, artifactsDir), 'PRD.md')
	if (!existsSync(prdPath)) return null
	return readFileSync(prdPath, 'utf8')
}

/**
 * Validate that a PRD string carries every required section as a real markdown heading. Generic:
 * the caller passes the headings to enforce (derived from the active `templates.prd`), defaulting
 * to the seven canonical PRD headings. Matches ATX heading lines (`^#{1,6} <heading>$`) rather than
 * a bare substring, so body prose that merely mentions "Solution" does not satisfy the gate.
 * @param {string} content
 * @param {readonly string[]} [requiredHeadings]
 * @returns {PrdValidationResult}
 */
export function validatePrdSections(content, requiredHeadings = DEFAULT_PRD_HEADINGS) {
	const present = new Set(
		content
			.split(/\r?\n/)
			.map((line) => line.match(/^#{1,6}\s+(.+?)\s*$/))
			.filter((m) => m !== null)
			.map((m) => /** @type {RegExpMatchArray} */ (m)[1])
	)
	const missingSections = requiredHeadings.filter((heading) => !present.has(heading))
	return {
		valid: missingSections.length === 0,
		missingSections,
	}
}
