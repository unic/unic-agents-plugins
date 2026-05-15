// @ts-check
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @typedef {'VALIDATED' | 'INVALIDATED' | 'PARTIAL'} VerdictType
 */

/**
 * @typedef {Object} SpikeVerdict
 * @property {string} title - Short title of the experiment
 * @property {VerdictType} verdict - Outcome: VALIDATED, INVALIDATED, or PARTIAL
 * @property {string} notes - Evidence or reason for the verdict
 */

const SECTION_HEADING = '## Spike verdicts'

/**
 * Build the Markdown block for the spike verdicts section.
 * @param {SpikeVerdict[]} verdicts
 * @returns {string}
 */
function buildSpikeVerdictsBlock(verdicts) {
	const entries = verdicts
		.map((v, i) => `### Experiment ${i + 1}: ${v.title}\n**Verdict:** ${v.verdict}\n${v.notes.trim()}`)
		.join('\n\n')
	return `${SECTION_HEADING}\n\n${entries}\n`
}

/**
 * Append (or replace) the `## Spike verdicts` section in findings.md.
 * If the section already exists it is replaced in-place — never duplicated.
 * @param {string} findingsDir - Directory containing findings.md
 * @param {SpikeVerdict[]} verdicts
 */
export function appendSpikeVerdicts(findingsDir, verdicts) {
	const filePath = join(findingsDir, 'findings.md')
	if (!existsSync(filePath)) {
		throw new Error(`appendSpikeVerdicts: findings.md not found at ${filePath}. Call writeFindingsMd() first.`)
	}
	const existing = readFileSync(filePath, 'utf8')

	const block = buildSpikeVerdictsBlock(verdicts)

	let updated
	if (existing.includes(SECTION_HEADING)) {
		// Replace from the existing section heading to end-of-file (or next ## heading)
		const idx = existing.indexOf(SECTION_HEADING)
		const afterSection = existing.slice(idx + SECTION_HEADING.length)
		const nextSectionMatch = afterSection.match(/\n(?=## )/)
		if (nextSectionMatch && nextSectionMatch.index !== undefined) {
			// There is a section after spike verdicts — preserve it
			const beforeBlock = existing.slice(0, idx)
			const afterBlock = afterSection.slice(nextSectionMatch.index)
			updated = `${beforeBlock}${block}${afterBlock}`
		} else {
			// Spike verdicts is the last section — replace to end
			updated = `${existing.slice(0, idx)}${block}`
		}
	} else {
		// No existing section — append (ensure a blank line separator)
		const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n'
		updated = `${existing}${separator}${block}`
	}

	writeFileSync(filePath, updated)
}

/**
 * Parse spike verdicts from findings.md content.
 * Returns an empty array if no `## Spike verdicts` section is present.
 * @param {string} content - Raw findings.md file content
 * @returns {SpikeVerdict[]}
 */
export function parseSpikeVerdicts(content) {
	const sectionIdx = content.indexOf(SECTION_HEADING)
	if (sectionIdx === -1) return []

	// Extract from section heading onward (stop at next top-level heading)
	const sectionBody = content.slice(sectionIdx + SECTION_HEADING.length)
	const nextSectionMatch = sectionBody.match(/\n(?=## )/)
	const body =
		nextSectionMatch && nextSectionMatch.index !== undefined
			? sectionBody.slice(0, nextSectionMatch.index)
			: sectionBody

	/** @type {SpikeVerdict[]} */
	const verdicts = []

	// Match each ### Experiment N: <title> block
	const experimentPattern =
		/###\s+Experiment\s+\d+:\s+(.+?)\n\*\*Verdict:\*\*\s+(VALIDATED|INVALIDATED|PARTIAL)\n([\s\S]*?)(?=\n###\s+Experiment|\s*$)/g
	for (const match of body.matchAll(experimentPattern)) {
		verdicts.push({
			title: match[1].trim(),
			verdict: /** @type {VerdictType} */ (match[2]),
			notes: match[3].trim(),
		})
	}

	return verdicts
}
