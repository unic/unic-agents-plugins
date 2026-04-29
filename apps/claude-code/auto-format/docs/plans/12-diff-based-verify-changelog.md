# 12. Diff-based `verify:changelog` enforcement
**Status: done — 2026-04-27**

**Priority:** P1
**Effort:** S
**Version impact:** minor
**Depends on:** spec-08, spec-10
**Touches:** `scripts/verify-changelog.mjs`

## Context

The current `pnpm verify:changelog` (spec-08) is a structural check: it confirms
that CHANGELOG.md is well-formed (Unreleased section, subsections, dated releases).
It does **not** enforce that a version bump happened.

You can modify `scripts/format-hook.mjs`, push, and CI passes without bumping
`plugin.json`. This breaks the contract stated in `docs/plans/README.md`:
"`.claude-plugin/plugin.json` is the single source of truth for the version number."

`../unic-claude-code-confluence/scripts/verify-changelog.mjs` solves this with a
diff-based gate: when guarded paths change in a branch, the script requires that
`plugin.json`'s version was also bumped AND that CHANGELOG.md has a real entry for
that version. If only non-guarded files change (e.g. plain docs) the gate skips
silently, avoiding noise.

This spec layers the diff-based gate on top of the existing structural checks so
both are enforced.

## Current behaviour

After spec-08 and spec-10: `pnpm verify:changelog` runs three structural checks
(Unreleased section, Breaking/Added/Fixed subsections, dates on versioned releases).
It exits 0 on a well-formed CHANGELOG regardless of whether guarded paths changed
without a version bump.

## Target behaviour

`pnpm verify:changelog` runs two layers:

**Layer 1 — Structural (unchanged):**
- `## [Unreleased]` section must exist.
- `## [Unreleased]` must contain `### Breaking`, `### Added`, `### Fixed`.
- Every `## [X.Y.Z]` section must have a date suffix (` - YYYY-MM-DD`).

**Layer 2 — Diff-based gate (NEW):**
- Compute changed files since the base branch (`origin/main` in CI, `@{upstream}` or
  `HEAD~1` locally). If `git diff` is unavailable (e.g. shallow clone), skip silently.
- Guarded paths:

  ```
  scripts/.+\.mjs
  tests/.+\.mjs
  \.claude-plugin/(plugin|marketplace)\.json
  CLAUDE\.md
  README\.md
  docs/plans/.+\.md
  ```

- If **no** guarded paths changed → `verify:changelog: ok (no guarded paths changed)`.
- If guarded paths changed:
  - Read `plugin.json#version` at HEAD and at the base commit.
  - If versions are equal → exit 1: `"version in plugin.json was not bumped"`.
  - If version was bumped → check that `CHANGELOG.md` has `## [<headVersion>] - YYYY-MM-DD`
    with at least one non-`(none)` bullet.
  - If CHANGELOG entry missing or empty → exit 1.
  - Otherwise → `verify:changelog: ok — version X.Y.Z → A.B.C`.

**Important:** the date separator in this repo is `-` (hyphen) — `## [1.0.0] - 2026-04-27`.
The confluence reference uses `—` (em-dash). Do NOT copy the em-dash; keep the hyphen
that `scripts/bump.mjs` already produces.

## Implementation steps

### Step 1 — Replace `scripts/verify-changelog.mjs`

The new script adds `spawnSync` from `node:child_process` and a `GUARDED` array,
then appends the diff-based gate after the existing structural block. Tabs for
indentation throughout.

Key logic:

1. **Structural block** — identical to current `scripts/verify-changelog.mjs:1-62`
   (no changes needed).

2. **Diff-based block** — added after the structural `process.exit(1)` guard:

   ```
   git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
     → determines base ref (or HEAD~1 fallback)
   git('diff', '--name-only', `${base}...HEAD`)
     → lists changed files
   if none match GUARDED → exit 0 "ok (no guarded paths changed)"
   git('show', `${base}:.claude-plugin/plugin.json`)
     → reads base version
   compare headVersion vs baseVersion
   if equal → exit 1 "version not bumped"
   regex match CHANGELOG for `## [headVersion] - YYYY-MM-DD`
   check at least one `- ` line that isn't `- (none)`
   ```

3. **GUARDED regexes** (tab-indented array):

   ```js
   const GUARDED = [
     /^scripts\/.+\.mjs$/,
     /^tests\/.+\.mjs$/,
     /^\.claude-plugin\/(plugin|marketplace)\.json$/,
     /^CLAUDE\.md$/,
     /^README\.md$/,
     /^docs\/plans\/.+\.md$/,
   ]
   ```

4. **CHANGELOG section regex** — use hyphen, not em-dash:

   ```js
   new RegExp(
     `## \\[${headVersion.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|$)`
   )
   ```

Full replacement file (write verbatim, tabs not spaces):

```
#!/usr/bin/env node
/**
 * pnpm verify:changelog
 * Layer 1: structural checks (Unreleased section, subsections, dated releases).
 * Layer 2: diff-based gate — when guarded paths change, version must be bumped
 *           and CHANGELOG must have a real entry for the new version.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

/** Paths that trigger version-bump enforcement when changed */
const GUARDED = [
	/^scripts\/.+\.mjs$/,
	/^tests\/.+\.mjs$/,
	/^\.claude-plugin\/(plugin|marketplace)\.json$/,
	/^CLAUDE\.md$/,
	/^README\.md$/,
	/^docs\/plans\/.+\.md$/,
]

// Layer 1: structural checks

const changelogPath = resolve(ROOT, 'CHANGELOG.md')
let changelog
try {
	changelog = readFileSync(changelogPath, 'utf8')
} catch {
	process.stderr.write('verify:changelog: CHANGELOG.md not found.\n')
	process.exit(1)
}

const errors = []

if (!changelog.includes('## [Unreleased]')) {
	errors.push('Missing ## [Unreleased] section.')
}

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

// Layer 2: diff-based version-bump gate

function git(...args) {
	const result = spawnSync('git', args, { encoding: 'utf8', cwd: ROOT })
	return { stdout: result.stdout ?? '', status: result.status ?? 1 }
}

const isCI = process.env.CI === 'true'
let base = 'origin/main'
if (!isCI) {
	const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
	base = upstream.status === 0 ? upstream.stdout.trim() : 'HEAD~1'
}

const diff = git('diff', '--name-only', `${base}...HEAD`)
if (diff.status !== 0) {
	process.stdout.write('verify:changelog: skipped (git diff unavailable)\n')
	process.exit(0)
}

const changedFiles = diff.stdout.trim().split('\n').filter(Boolean)
const triggered = changedFiles.some((f) => GUARDED.some((re) => re.test(f)))
if (!triggered) {
	process.stdout.write('verify:changelog: ok (no guarded paths changed)\n')
	process.exit(0)
}

const pluginPath = resolve(ROOT, '.claude-plugin/plugin.json')
let headPlugin
try {
	headPlugin = JSON.parse(readFileSync(pluginPath, 'utf8'))
} catch {
	process.stderr.write(`verify:changelog: cannot read ${pluginPath}\n`)
	process.exit(1)
}
const headVersion = headPlugin.version

const basePluginRaw = git('show', `${base}:.claude-plugin/plugin.json`)
let baseVersion = ''
if (basePluginRaw.status === 0) {
	try {
		baseVersion = JSON.parse(basePluginRaw.stdout).version
	} catch {
		// base does not have plugin.json yet — treat as empty
	}
}

if (headVersion === baseVersion) {
	process.stderr.write(
		`verify:changelog: version in plugin.json was not bumped\n` +
			`  current: ${headVersion} (same as ${base})\n` +
			`  Run: pnpm bump <patch|minor|major>\n`,
	)
	process.exit(1)
}

const sectionMatch = changelog.match(
	new RegExp(
		`## \\[${headVersion.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|$)`,
	),
)
if (!sectionMatch) {
	process.stderr.write(
		`verify:changelog: CHANGELOG.md has no entry for version ${headVersion}\n` +
			`  Add bullets under [Unreleased] then run: pnpm bump\n`,
	)
	process.exit(1)
}

const sectionBody = sectionMatch[1]
const hasRealEntry = sectionBody
	.split('\n')
	.filter((l) => l.startsWith('- '))
	.some((l) => l !== '- (none)')
if (!hasRealEntry) {
	process.stderr.write(
		`verify:changelog: CHANGELOG.md section [${headVersion}] has no real entries\n` +
			`  Add bullets under [Unreleased] then re-run: pnpm bump\n`,
	)
	process.exit(1)
}

process.stdout.write(`verify:changelog: ok — version ${baseVersion} → ${headVersion}\n`)
```

### Step 2 — Commit

```sh
git add scripts/verify-changelog.mjs
git commit -m "feat(spec-12): add diff-based verify:changelog version-bump gate"
```

## Test cases

| Scenario | Expected |
|---|---|
| Current repo HEAD, already on `main` | Layer 1 passes; layer 2: "ok (no guarded paths changed)" |
| Guarded path changed, version bumped, CHANGELOG entry present | "ok — version X → Y" |
| Guarded path changed, version NOT bumped | Exits 1: "version in plugin.json was not bumped" |
| Guarded path changed, version bumped, CHANGELOG entry missing | Exits 1: "has no entry for version Y" |
| Guarded path changed, version bumped, CHANGELOG entry only `(none)` | Exits 1: "no real entries" |
| Only non-guarded file changed (e.g. `.gitignore`) | Layer 1 passes; layer 2: "ok (no guarded paths changed)" |
| Malformed CHANGELOG (missing `[Unreleased]`) | Exits 1 from layer 1 |
| git diff unavailable (shallow clone) | "skipped (git diff unavailable)" |

## Acceptance criteria

- `pnpm verify:changelog` passes on the current clean repo.
- `pnpm verify:changelog` exits 1 when guarded files changed but `plugin.json` version is unchanged.
- `pnpm verify:changelog` exits 1 when CHANGELOG entry is missing or placeholder-only.
- `pnpm verify:changelog` exits 0 with "no guarded paths changed" when only non-guarded files differ.
- Structural failures (missing `[Unreleased]`) still exit 1 regardless of diff state.
- The CHANGELOG section regex uses `-` (hyphen) not `—` (em-dash).

## Verification

```sh
# 1. Passes on current repo
pnpm verify:changelog

# 2. Simulate guarded change without version bump (undo after)
git checkout -b test-verify-gate
echo "// test" >> scripts/format-hook.mjs
git add scripts/format-hook.mjs
git commit -m "test: trigger gate"
pnpm verify:changelog   # expect exit 1 "version not bumped"
git checkout main
git branch -D test-verify-gate

# 3. Structural check still fires independently
# Temporarily corrupt CHANGELOG, run pnpm verify:changelog — should exit 1 from layer 1
```

## Out of scope

- Auto-fixing the CHANGELOG or bumping automatically.
- Enforcing version bumps on non-guarded paths.
- Changing the CHANGELOG date separator (this repo uses `-`, keep it).

_Ralph: append findings here._
