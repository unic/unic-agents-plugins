# 23. Backfill historical git tags

**Status: done — 2026-04-28**

**Priority:** P2
**Effort:** S
**Version impact:** patch
**Depends on:** spec-14
**Touches:** `scripts/backfill-tags.mjs` (new), `package.json`, `docs/plans/README.md`

## Context

Spec 14 landed `pnpm tag`, which tags the *current* HEAD. But the repo now has 23+
committed version bumps (from `v0.1.0` through `v0.5.2`) with no git tags at all.
Consumer repos that pin via a git URL reference bare commit SHAs rather than
human-readable tags, making changelog navigation and upgrade traceability harder.

A one-time backfill script walks the full git history, detects every commit where
`.claude-plugin/plugin.json#version` first appeared or changed, and creates a
lightweight `v{version}` tag at that commit. Subsequent runs are idempotent (skips
tags that already exist).

## Current behaviour

`git tag --list` returns nothing. All 23+ version bump commits are untagged.

## Target behaviour

- `scripts/backfill-tags.mjs` exists and is valid ESM.
- `pnpm backfill-tags` runs it.
- For every distinct version encountered while walking git history oldest-to-newest,
  a lightweight `v{version}` tag is created at the first commit that introduced that
  version in `.claude-plugin/plugin.json`.
- If a tag already exists it is skipped with a `skip` log line (idempotent).
- Script ends with: `Done. Run: git push --tags`
- Does **not** push. Push remains a manual step.

## Implementation steps

### Step 1 — Create `scripts/backfill-tags.mjs`

```js
#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process'

const log = spawnSync('git', ['log', '--reverse', '--format=%H'], { encoding: 'utf8' })
if (log.status !== 0) {
	process.stderr.write('backfill-tags: git log failed\n')
	process.exit(1)
}

const commits = log.stdout.trim().split('\n').filter(Boolean)
let lastVersion = null

for (const hash of commits) {
	const show = spawnSync('git', ['show', `${hash}:.claude-plugin/plugin.json`], { encoding: 'utf8' })
	if (show.status !== 0) continue

	let version
	try {
		version = JSON.parse(show.stdout).version
	} catch {
		continue
	}

	if (!version || version === lastVersion) {
		lastVersion = version
		continue
	}

	lastVersion = version
	const tagName = `v${version}`

	const existing = spawnSync('git', ['tag', '-l', tagName], { encoding: 'utf8' })
	if (existing.stdout.trim()) {
		process.stdout.write(`  skip  ${tagName} (already exists)\n`)
		continue
	}

	const result = spawnSync('git', ['tag', tagName, hash], { stdio: 'inherit' })
	if (result.status === 0) {
		process.stdout.write(`tagged  ${tagName} → ${hash.slice(0, 7)}\n`)
	} else {
		process.stderr.write(`  FAIL  ${tagName} → ${hash.slice(0, 7)}\n`)
		process.exit(1)
	}
}

process.stdout.write('Done. Run: git push --tags\n')
```

### Step 2 — Add `backfill-tags` to `package.json` scripts

```json
"scripts": {
	"backfill-tags": "node scripts/backfill-tags.mjs",
	"bump": "node scripts/bump.mjs",
	"ralph": "ralph run -c ralph.yml -H builtin:code-assist",
	"sync-version": "node scripts/sync-version.mjs",
	"tag": "node scripts/tag.mjs",
	"test": "node --test 'tests/*.test.mjs'",
	"typecheck": "tsc --noEmit --allowJs --checkJs --strict --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/*.mjs scripts/lib/*.mjs tests/*.mjs",
	"verify:changelog": "node scripts/verify-changelog.mjs"
}
```

### Step 3 — Update `docs/plans/README.md` execution table

Add row:

```
| 23 | [Backfill historical git tags](./23-backfill-tags.md) | P2 | S | todo |
```

Add dependency note to cross-cutting dependencies:

> **`23` → `14`**: backfill-tags.mjs relies on the same tag-naming convention as tag.mjs.

### Step 4 — Commit

```sh
git add scripts/backfill-tags.mjs package.json docs/plans/README.md
git commit -m "feat(spec-23): add pnpm backfill-tags to tag historical version commits"
```

## Test cases

| Scenario | Expected |
|---|---|
| First run (no tags exist) | Tags created for every distinct version in history; exit 0 |
| Second run (all tags exist) | All lines print `skip …`; exit 0 |
| Partial run (some tags exist) | Missing tags created; existing skipped; exit 0 |
| Repo has no `plugin.json` in history | Script exits 0; no tags created; no crash |

## Acceptance criteria

- `scripts/backfill-tags.mjs` is valid ESM with `// @ts-check`.
- `pnpm backfill-tags` creates one `vX.Y.Z` tag per distinct version in git history.
- Re-running is idempotent: skips existing tags, exits 0.
- Script does **not** push.
- Output ends with "Run: git push --tags".

## Verification

```sh
# 1. Run backfill
pnpm backfill-tags
# expect: "tagged  vX.Y.Z → <hash>" lines, then "Done. Run: git push --tags"

# 2. Confirm tags exist
git tag --list | sort -V
# expect: v0.1.0 through v0.5.2 (or whatever versions are in history)

# 3. Confirm idempotent
pnpm backfill-tags
# expect: all lines say "skip  vX.Y.Z (already exists)"

# 4. Optionally push
git push --tags
```

## Out of scope

- Annotated tags. Lightweight tags match spec-14 convention.
- Pushing (always manual).
- Validation that every bump commit has a matching tag (CI gate is spec-24).

_Ralph: append findings here._
