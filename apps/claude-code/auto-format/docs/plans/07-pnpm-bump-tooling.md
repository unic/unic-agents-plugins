# 07. pnpm bump Tooling

**Priority:** P1
**Effort:** M
**Version impact:** patch
**Depends on:** spec-06
**Touches:** `scripts/bump.mjs`, `package.json`

## Context

Manually keeping `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `CHANGELOG.md` in sync is error-prone. `pnpm bump` (borrowed from `unic-claude-code-confluence`) atomically:

1. Increments the version in `package.json` and `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
2. Promotes the `## [Unreleased]` section in `CHANGELOG.md` to `## [NEW_VERSION] - YYYY-MM-DD`.

## Current behaviour

After spec `06`: no `pnpm bump` script. Version updates are manual.

`package.json` scripts section:
```json
"scripts": {
	"test": "echo 'No tests yet'"
}
```

## Target behaviour

- `scripts/bump.mjs` exists and accepts `patch`, `minor`, or `major` as first argument.
- `pnpm bump patch` / `pnpm bump minor` / `pnpm bump major` runs atomically.
- After running, `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` all have the new version.
- `CHANGELOG.md`'s `## [Unreleased]` is promoted to `## [NEW_VERSION] - TODAY`.
- A fresh empty `## [Unreleased]` section is inserted at the top.
- Script exits 1 with a clear message if the argument is missing or invalid.
- Script exits 1 if `## [Unreleased]` has no non-(none) entries (prevents empty release notes).

## Implementation steps

### Step 1 — Create `scripts/bump.mjs`

```js
#!/usr/bin/env node
/**
 * pnpm bump <patch|minor|major>
 * Atomically bumps version in package.json, plugin.json, marketplace.json
 * and promotes [Unreleased] in CHANGELOG.md.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'))
}

function writeJson(rel, obj) {
	writeFileSync(resolve(ROOT, rel), JSON.stringify(obj, null, '\t') + '\n', 'utf8')
}

function bumpVersion(version, type) {
	const [major, minor, patch] = version.split('.').map(Number)
	if (type === 'major') return `${major + 1}.0.0`
	if (type === 'minor') return `${major}.${minor + 1}.0`
	if (type === 'patch') return `${major}.${minor}.${patch + 1}`
	throw new Error(`Invalid bump type: ${type}`)
}

function today() {
	return new Date().toISOString().slice(0, 10)
}

const bumpType = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bumpType)) {
	process.stderr.write(`Usage: pnpm bump <patch|minor|major>\n`)
	process.exit(1)
}

const pkg = readJson('package.json')
const newVersion = bumpVersion(pkg.version, bumpType)

// Bump package.json
pkg.version = newVersion
writeJson('package.json', pkg)

// Bump .claude-plugin/plugin.json
const pluginJson = readJson('.claude-plugin/plugin.json')
pluginJson.version = newVersion
writeJson('.claude-plugin/plugin.json', pluginJson)

// Bump .claude-plugin/marketplace.json
const marketJson = readJson('.claude-plugin/marketplace.json')
marketJson.version = newVersion
writeJson('.claude-plugin/marketplace.json', marketJson)

// Promote CHANGELOG
const changelogPath = resolve(ROOT, 'CHANGELOG.md')
let changelog = readFileSync(changelogPath, 'utf8')

const unreleasedMatch = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=## \[|$)/)
if (!unreleasedMatch) {
	process.stderr.write('CHANGELOG.md does not have an [Unreleased] section.\n')
	process.exit(1)
}

const unreleasedBody = unreleasedMatch[1]
const hasEntries = unreleasedBody.split('\n').some((line) => {
	const trimmed = line.trim()
	return trimmed.startsWith('-') && !trimmed.includes('(none)')
})

if (!hasEntries) {
	process.stderr.write(`[Unreleased] has no entries. Add CHANGELOG entries before bumping.\n`)
	process.exit(1)
}

const newUnreleased = `## [Unreleased]\n\n### Breaking\n- (none)\n\n### Added\n- (none)\n\n### Fixed\n- (none)\n\n`
const newRelease = `## [${newVersion}] - ${today()}${unreleasedBody}`
changelog = changelog.replace(/## \[Unreleased\][\s\S]*?(?=## \[|$)/, newUnreleased + newRelease)

writeFileSync(changelogPath, changelog, 'utf8')

process.stdout.write(`Bumped to v${newVersion}\n`)
```

### Step 2 — Add `bump` script to `package.json`

Update `scripts`:
```json
"scripts": {
	"test": "echo 'No tests yet'",
	"bump": "node scripts/bump.mjs"
}
```

### Step 3 — Commit

```sh
git add scripts/bump.mjs package.json
git commit -m "feat(spec-07): add pnpm bump tooling for atomic version bumping"
```

## Test cases

| Command | Expected |
|---|---|
| `pnpm bump` (no args) | Exits 1 with usage message |
| `pnpm bump invalid` | Exits 1 with usage message |
| `pnpm bump patch` (no [Unreleased] entries) | Exits 1 with "no entries" message |
| `pnpm bump patch` (with entries) | Exits 0; versions bumped; [Unreleased] promoted |

## Acceptance criteria

- `scripts/bump.mjs` exists and is valid ESM.
- `pnpm bump patch` exits 0 when `[Unreleased]` has entries, bumps all three version files, and promotes CHANGELOG.
- `pnpm bump` (no args) exits 1.
- `pnpm bump` with empty `[Unreleased]` exits 1.

## Verification

```sh
# 1. Valid ESM
node --input-type=module <<< "import './scripts/bump.mjs'" 2>&1 | head -3

# 2. No-arg exits 1
pnpm bump; echo "exit=$?"   # Expect exit=1

# 3. Add an entry and dry-run bump on patch (then git restore)
# Manual test: add a bullet to [Unreleased] in CHANGELOG, run pnpm bump patch,
# verify versions all bumped, then git restore to undo.
```

## Out of scope

- `pnpm tag` (git tagging) — not needed for development phase.
- `pnpm publish` — not applicable (plugin distributed via git URL).
- `pnpm verify:changelog` (spec 08).

_Ralph: append findings here._
