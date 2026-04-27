# 13. Single source of truth + `sync-version.mjs`

**Priority:** P1
**Effort:** M
**Version impact:** patch
**Depends on:** spec-07
**Touches:** `scripts/sync-version.mjs` (new), `scripts/bump.mjs` (refactor), `package.json` (new script entry), `CLAUDE.md` (new command reference)

## Context

`docs/plans/README.md` ground rule:
> "`.claude-plugin/plugin.json` is the single source of truth for the version number.
> **Never hand-edit** `.claude-plugin/marketplace.json`."

In practice, `scripts/bump.mjs` writes the new version into `plugin.json`,
`marketplace.json`, AND `package.json` independently, in three parallel writes.
If any one of them diverges (manual edit, failed partial run), the trio is out
of sync with no recovery path.

`../unic-claude-code-confluence/scripts/sync-version.mjs` solves this by having a
single idempotent script that reads `plugin.json` and propagates to derived files.
`bump-version.mjs` only writes `plugin.json` and then delegates to `sync-version.mjs`.

This spec ports that pattern here. Because `package.json` carries a `version` field
in this repo (it is `private: true` but `pnpm` reads it), `sync-version.mjs` must
also propagate to `package.json` — a deliberate deviation from the confluence version.

The confluence repo uses two-space JSON indentation (Biome-formatted). This repo uses
tabs. **Keep tabs.** The deviation from CLAUDE.md ("2-space for .json") is documented
below under Deviations; fixing it is out of scope here.

## Current behaviour

After spec-07: `scripts/bump.mjs` writes `plugin.json`, `marketplace.json`, and
`package.json` in three separate `writeJson` calls within the same script. No
`sync-version.mjs` exists.

## Target behaviour

- `scripts/sync-version.mjs` exists.
  - Reads `.claude-plugin/plugin.json#version` (the single source of truth).
  - Writes that version into `.claude-plugin/marketplace.json#version`.
  - Writes that version into `package.json#version`.
  - Is idempotent: if a file's version already matches, logs "no change" and
    does not write.
  - `pnpm sync-version` invokes it (new `package.json` script entry).
- `scripts/bump.mjs` is refactored:
  - Still validates `[Unreleased]` first.
  - Computes the new version from `plugin.json`.
  - Writes **only** `plugin.json`.
  - Spawns `node scripts/sync-version.mjs` (inherit stdio); aborts on non-zero.
  - Promotes the CHANGELOG.
  - Final output: `Bumped to v<newVersion>`.
- Net result for `pnpm bump patch`: all three files updated to the same version
  (same as before), but via sync-version rather than three independent writes.

## Implementation steps

### Step 1 — Create `scripts/sync-version.mjs`

```js
#!/usr/bin/env node
/**
 * pnpm sync-version
 * Reads the version from .claude-plugin/plugin.json (single source of truth)
 * and propagates it to .claude-plugin/marketplace.json and package.json.
 * Idempotent — safe to run multiple times.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

const pluginPath = resolve(ROOT, '.claude-plugin/plugin.json')
let pluginJson
try {
	pluginJson = JSON.parse(readFileSync(pluginPath, 'utf8'))
} catch (err) {
	process.stderr.write(`sync-version: cannot read ${pluginPath}: ${err.message}\n`)
	process.exit(1)
}

const version = pluginJson.version
if (!version || typeof version !== 'string') {
	process.stderr.write(`sync-version: .version is missing or not a string in ${pluginPath}\n`)
	process.exit(1)
}

/**
 * Update version in a JSON file. Logs the transition (or no-op).
 * @param {string} filePath  Absolute path to the JSON file.
 */
function syncFile(filePath) {
	let obj
	try {
		obj = JSON.parse(readFileSync(filePath, 'utf8'))
	} catch (err) {
		process.stderr.write(`sync-version: cannot read ${filePath}: ${err.message}\n`)
		process.exit(1)
	}
	const rel = filePath.slice(ROOT.length + 1)
	const prev = obj.version
	if (prev === version) {
		process.stdout.write(`sync-version: ${rel} already at ${version} (no change)\n`)
		return
	}
	obj.version = version
	writeFileSync(filePath, JSON.stringify(obj, null, '\t') + '\n', 'utf8')
	process.stdout.write(`sync-version: ${rel} updated ${prev} → ${version}\n`)
}

syncFile(resolve(ROOT, '.claude-plugin/marketplace.json'))
syncFile(resolve(ROOT, 'package.json'))
```

### Step 2 — Refactor `scripts/bump.mjs`

Replace `scripts/bump.mjs` with the version below. The only structural change is:
- Remove the `writeJson` calls for `marketplace.json` and `package.json`.
- Replace with a `spawnSync` call to `sync-version.mjs`.

```js
#!/usr/bin/env node
/**
 * pnpm bump <patch|minor|major>
 * Bumps version in plugin.json (single source of truth), syncs to
 * marketplace.json + package.json via sync-version.mjs, and promotes
 * [Unreleased] in CHANGELOG.md.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

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

// Validate CHANGELOG before touching any files
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

// Bump plugin.json (single source of truth)
const pluginJson = readJson('.claude-plugin/plugin.json')
const newVersion = bumpVersion(pluginJson.version, bumpType)
pluginJson.version = newVersion
writeJson('.claude-plugin/plugin.json', pluginJson)

// Propagate to marketplace.json and package.json via sync-version
const syncResult = spawnSync('node', [resolve(ROOT, 'scripts/sync-version.mjs')], {
	stdio: 'inherit',
})
if (syncResult.status !== 0) {
	process.stderr.write(`bump: sync-version failed (exit ${syncResult.status ?? 'unknown'})\n`)
	process.exit(1)
}

// Promote CHANGELOG
const newUnreleased = `## [Unreleased]\n\n### Breaking\n- (none)\n\n### Added\n- (none)\n\n### Fixed\n- (none)\n\n`
const newRelease = `## [${newVersion}] - ${today()}${unreleasedBody}`
changelog = changelog.replace(/## \[Unreleased\][\s\S]*?(?=## \[|$)/, newUnreleased + newRelease)
writeFileSync(changelogPath, changelog, 'utf8')

process.stdout.write(`Bumped to v${newVersion}\n`)
```

### Step 3 — Add `sync-version` to `package.json` scripts

```json
"scripts": {
	"test": "node --test tests/format-hook.test.mjs",
	"bump": "node scripts/bump.mjs",
	"sync-version": "node scripts/sync-version.mjs",
	"verify:changelog": "node scripts/verify-changelog.mjs"
}
```

### Step 4 — Update `CLAUDE.md` commands section

Add `pnpm sync-version` after `pnpm bump major`:

```md
pnpm sync-version         # Propagate plugin.json version to marketplace.json + package.json
```

### Step 5 — Commit

```sh
git add scripts/sync-version.mjs scripts/bump.mjs package.json CLAUDE.md
git commit -m "refactor(spec-13): make plugin.json the single source of truth via sync-version.mjs"
```

## Test cases

| Command | Expected |
|---|---|
| `pnpm sync-version` (all files in sync) | "no change" for both derived files |
| Hand-edit `plugin.json` version, then `pnpm sync-version` | marketplace.json and package.json updated to match |
| `pnpm bump patch` with entries | All three files at new version; CHANGELOG promoted |
| `pnpm bump patch` without entries | Exits 1 "no entries" (unchanged from before) |
| `pnpm sync-version` when `marketplace.json` unreadable | Exits 1 with descriptive message |

## Acceptance criteria

- `scripts/sync-version.mjs` exists and is valid ESM.
- `pnpm sync-version` exits 0 and prints a summary for each file.
- `pnpm sync-version` is idempotent (second run prints "no change").
- `pnpm bump patch` (with CHANGELOG entries) updates all three version files and
  promotes CHANGELOG — same observable output as before.
- `scripts/bump.mjs` no longer contains `writeJson` calls for `marketplace.json`
  or `package.json`.

## Verification

```sh
# 1. Idempotent run
pnpm sync-version
# expect: both files report "no change"

# 2. Force a desync, then repair
node -e "
  const fs = require('fs')
  const p = fs.readFileSync('.claude-plugin/marketplace.json','utf8')
  const j = JSON.parse(p); j.version='0.0.0'
  fs.writeFileSync('.claude-plugin/marketplace.json', JSON.stringify(j,null,'\\t')+'\\n')
"
pnpm sync-version
# expect: marketplace.json updated X → current; package.json no change
git restore .claude-plugin/marketplace.json

# 3. Full bump (undo with git restore afterward)
# Add a bullet to [Unreleased]/### Fixed in CHANGELOG.md, then:
pnpm bump patch
# verify all three files share the same version:
node -e "
  const p = require('./.claude-plugin/plugin.json').version
  const m = require('./.claude-plugin/marketplace.json').version
  const k = require('./package.json').version
  if(p===m&&m===k) console.log('PASS',p); else console.error('MISMATCH',{p,m,k})
"
git restore .
```

## Deviations to document

- `sync-version.mjs` also updates `package.json#version`. The confluence reference
  does not do this because their `package.json` carries no version. This repo's
  `package.json` has `"version"` (legacy from spec-07's spec code), so we keep it
  synced to avoid pnpm warnings.
- CLAUDE.md says "2-space for .json" but the repo's JSON files already use tabs.
  This discrepancy predates this spec. Document it here; do not fix it under this
  spec (separate cleanup decision needed).

## Out of scope

- Changing JSON indentation (tabs → 2-space or vice versa).
- `pnpm tag` (spec-14).
- Removing `package.json#version` (would be a separate decision).

_Ralph: append findings here._
