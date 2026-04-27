# 08. pnpm verify:changelog

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-07
**Touches:** `scripts/verify-changelog.mjs`, `package.json`

## Context

CI needs a way to enforce that `CHANGELOG.md` is properly formatted and that the `[Unreleased]` section is in the expected structure. `pnpm verify:changelog` is a lightweight script that checks these invariants without requiring an external CHANGELOG linting library.

## Current behaviour

After spec `07`: `package.json` has `"bump": "node scripts/bump.mjs"`. No `verify:changelog` script.

## Target behaviour

- `scripts/verify-changelog.mjs` exists.
- `pnpm verify:changelog` exits 0 if CHANGELOG is well-formed.
- `pnpm verify:changelog` exits 1 with a descriptive message if:
  - `## [Unreleased]` section is missing.
  - `## [Unreleased]` is missing `### Breaking`, `### Added`, or `### Fixed` subsections.
  - Any `## [X.Y.Z]` section is missing a date suffix (` - YYYY-MM-DD`).

## Implementation steps

### Step 1 — Create `scripts/verify-changelog.mjs`

```js
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
```

### Step 2 — Add `verify:changelog` to `package.json` scripts

Update scripts section to:
```json
"scripts": {
	"test": "echo 'No tests yet'",
	"bump": "node scripts/bump.mjs",
	"verify:changelog": "node scripts/verify-changelog.mjs"
}
```

### Step 3 — Commit

```sh
git add scripts/verify-changelog.mjs package.json
git commit -m "feat(spec-08): add pnpm verify:changelog for CI enforcement"
```

## Acceptance criteria

- `pnpm verify:changelog` exits 0 on the current well-formed CHANGELOG.
- `pnpm verify:changelog` exits 1 if `[Unreleased]` is missing.
- `pnpm verify:changelog` exits 1 if a versioned release is missing its date.

## Verification

```sh
# 1. Passes on current CHANGELOG
pnpm verify:changelog && echo "OK"
```

## Out of scope

- No CHANGELOG format migration.
- No auto-fix mode.

_Ralph: append findings here._
