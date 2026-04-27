#!/usr/bin/env node
/**
 * pnpm verify:changelog
 * Checks that CHANGELOG.md has the expected structure.
 * Exits 0 on success, 1 on failure.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const changelogPath = resolve(ROOT, 'CHANGELOG.md')

let changelog
try {
	changelog = readFileSync(changelogPath, 'utf8')
} catch {
	process.stderr.write('verify:changelog: CHANGELOG.md not found.\n')
	process.exit(1)
}

const errors = []

// 1. [Unreleased] section must exist
if (!changelog.includes('## [Unreleased]')) {
	errors.push('Missing ## [Unreleased] section.')
}

// 2. [Unreleased] must have all three subsections
const unreleasedIdx = changelog.indexOf('## [Unreleased]')
if (unreleasedIdx !== -1) {
	const nextReleaseIdx = changelog.indexOf('\n## [', unreleasedIdx + 1)
	const unreleasedBlock =
		nextReleaseIdx === -1
			? changelog.slice(unreleasedIdx)
			: changelog.slice(unreleasedIdx, nextReleaseIdx)
	for (const sub of ['### Breaking', '### Added', '### Fixed']) {
		if (!unreleasedBlock.includes(sub)) {
			errors.push(`[Unreleased] is missing subsection: ${sub}`)
		}
	}
}

// 3. Each versioned release must have a date
const releasePattern = /^## \[(\d+\.\d+\.\d+)\]/gm
let match
while ((match = releasePattern.exec(changelog)) !== null) {
	const end = changelog.indexOf('\n', match.index)
	const line = changelog.slice(match.index, end === -1 ? undefined : end)
	if (!/ - \d{4}-\d{2}-\d{2}/.test(line)) {
		errors.push(`Release section missing date: ${line.trim()}`)
	}
}

if (errors.length > 0) {
	process.stderr.write('verify:changelog failed:\n')
	errors.forEach((e) => process.stderr.write(`  - ${e}\n`))
	process.exit(1)
}

process.stdout.write('verify:changelog: OK\n')
