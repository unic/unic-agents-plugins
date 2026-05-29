// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later

/** @type {RegExp[]} */
export const GUARDED = [
	/^scripts\/.+\.mjs$/,
	/^commands\/.+\.md$/,
	/^\.claude-plugin\/plugin\.json$/,
	/^\.claude-plugin\/marketplace\.json$/,
	/^CLAUDE\.md$/,
	/^README\.md$/,
]

/**
 * @param {string[]} changedFiles - plugin-relative paths
 * @param {RegExp[]} guardedPatterns
 * @returns {boolean}
 */
export function isBumpRequired(changedFiles, guardedPatterns) {
	return changedFiles.some((f) => guardedPatterns.some((re) => re.test(f)))
}

/**
 * @typedef {{ ok: boolean, code: string, message: string }} GateVerdict
 */

/**
 * @param {{ changedFiles: string[], guardedPatterns: RegExp[], headVersion: string, baseVersion: string, changelog: string }} opts
 * @returns {GateVerdict}
 */
export function evaluateBumpGate({ changedFiles, guardedPatterns, headVersion, baseVersion, changelog }) {
	if (!isBumpRequired(changedFiles, guardedPatterns)) {
		return { ok: true, code: 'no-guarded-change', message: 'no guarded paths changed' }
	}
	if (headVersion === baseVersion) {
		return {
			ok: false,
			code: 'version-unchanged',
			message: `version in plugin.json was not bumped\n  current: ${headVersion} (same as base)\n  Run: pnpm bump <patch|minor|major>`,
		}
	}
	const sectionRe = new RegExp(
		`## \\[${headVersion.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|\\s*$)`
	)
	const sectionMatch = changelog.match(sectionRe)
	if (!sectionMatch) {
		return {
			ok: false,
			code: 'no-changelog-entry',
			message: `CHANGELOG.md has no entry for version ${headVersion}\n  Add bullets under [Unreleased] then run: pnpm bump`,
		}
	}
	const hasRealEntry = sectionMatch[1]
		.split('\n')
		.filter((l) => l.startsWith('- '))
		.some((l) => l !== '- (none)')
	if (!hasRealEntry) {
		return {
			ok: false,
			code: 'no-real-entries',
			message: `CHANGELOG.md section [${headVersion}] has no entries — only "(none)" placeholders found\n  Add bullets under [Unreleased] then re-run: pnpm bump`,
		}
	}
	const fromVersion = baseVersion || '(new)'
	return { ok: true, code: 'ok', message: `version ${fromVersion} → ${headVersion}` }
}
