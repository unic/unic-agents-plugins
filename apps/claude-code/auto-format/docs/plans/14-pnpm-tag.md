# 14. `pnpm tag` for git tagging
**Status: done — 2026-04-27**

**Priority:** P2
**Effort:** S
**Version impact:** minor
**Depends on:** spec-13
**Touches:** `scripts/tag.mjs` (new), `package.json`, `docs/plans/README.md`, `CLAUDE.md`

## Context

Spec-07 explicitly listed `pnpm tag` as out of scope: "not needed for development
phase." That decision made sense when the plugin was being built from scratch; the
priority was to land the core hook and tooling without scope creep.

The situation has changed: you plan to install `unic-claude-code-format` into client
projects (starting with `unic-claude-code-confluence`) via a git URL. Consumer repos
that pin to a specific commit or tag benefit from tagged releases — they can reference
`git+https://...#v1.2.3` instead of a bare commit SHA, which makes upgrades
traceable and changelog-readable.

`../unic-claude-code-confluence/scripts/tag.mjs` already does exactly this. This spec
ports it, relying on `sync-version.mjs` (spec-13) for the idempotent safety sync
before tagging.

## Current behaviour

After spec-13: `pnpm bump`, `pnpm sync-version`, and `pnpm verify:changelog` exist.
No `pnpm tag`. To release, you would manually run `git tag v<version>`.

## Target behaviour

- `scripts/tag.mjs` exists.
- `pnpm tag` runs it.
- Behaviour:
  1. Reads `plugin.json#version`.
  2. Runs `scripts/sync-version.mjs` (idempotent; ensures derived files are in sync
     before the commit is tagged).
  3. Runs `git tag v<version>`.
  4. If the tag already exists, `git tag` exits non-zero → script exits 1 with a
     clear message.
  5. On success, prints: `Tagged v<version>. Run: git push --follow-tags`
- Does **not** push. That remains a manual step.

## Implementation steps

### Step 1 — Create `scripts/tag.mjs`

```js
#!/usr/bin/env node
/**
 * pnpm tag
 * Tags the current commit with v<version> from .claude-plugin/plugin.json.
 * Runs sync-version first (idempotent safety check).
 * Does not push — run: git push --follow-tags
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

const pluginPath = resolve(ROOT, '.claude-plugin/plugin.json')
let pluginJson
try {
	pluginJson = JSON.parse(readFileSync(pluginPath, 'utf8'))
} catch (err) {
	process.stderr.write(`tag: cannot read ${pluginPath}: ${err.message}\n`)
	process.exit(1)
}

const version = pluginJson.version
if (!version || typeof version !== 'string') {
	process.stderr.write(`tag: .version is missing or not a string in ${pluginPath}\n`)
	process.exit(1)
}

// Safety sync before tagging (idempotent)
spawnSync('node', [resolve(ROOT, 'scripts/sync-version.mjs')], { stdio: 'inherit' })

const tagResult = spawnSync('git', ['tag', `v${version}`], { stdio: 'inherit' })
if (tagResult.status !== 0) {
	process.stderr.write(`tag: git tag failed — v${version} may already exist\n`)
	process.exit(1)
}

process.stdout.write(`Tagged v${version}. Run: git push --follow-tags\n`)
```

### Step 2 — Add `tag` to `package.json` scripts

```json
"scripts": {
	"test": "node --test tests/format-hook.test.mjs",
	"bump": "node scripts/bump.mjs",
	"sync-version": "node scripts/sync-version.mjs",
	"tag": "node scripts/tag.mjs",
	"verify:changelog": "node scripts/verify-changelog.mjs"
}
```

### Step 3 — Update `docs/plans/README.md`

Add a versioning workflow note to the ground rules section:

> **Release workflow**: `pnpm bump <patch|minor|major>` → commit → `pnpm tag` → `git push --follow-tags`

Update the execution table to include spec 14.

### Step 4 — Update `CLAUDE.md` commands section

Add `pnpm tag` after `pnpm sync-version`:

```md
pnpm tag                  # Create git tag v<version> (run git push --follow-tags after)
```

### Step 5 — Commit

```sh
git add scripts/tag.mjs package.json docs/plans/README.md CLAUDE.md
git commit -m "feat(spec-14): add pnpm tag for creating git version tags"
```

## Test cases

| Command | Expected |
|---|---|
| `pnpm tag` (first time for current version) | Exits 0; `vX.Y.Z` tag created; sync-version output visible |
| `pnpm tag` (same version again) | Exits 1: "git tag failed — v… may already exist" |
| `pnpm tag` when `plugin.json` unreadable | Exits 1 with descriptive message |
| `pnpm tag` when `plugin.json#version` is missing | Exits 1: ".version is missing or not a string" |

## Acceptance criteria

- `scripts/tag.mjs` exists and is valid ESM.
- `pnpm tag` creates a `vX.Y.Z` lightweight tag on the current commit.
- Second `pnpm tag` at the same version exits 1.
- `pnpm tag` does NOT push.
- Script output includes "Run: git push --follow-tags".

## Verification

```sh
# 1. Create the tag
pnpm tag
# expect: "Tagged v0.X.Y. Run: git push --follow-tags"

# 2. Verify tag exists
git tag --list "v$(node -p "require('./.claude-plugin/plugin.json').version")"
# expect: the tag is printed

# 3. Second run fails cleanly
pnpm tag
# expect: exit 1 "may already exist"

# 4. Clean up
git tag -d "v$(node -p "require('./.claude-plugin/plugin.json').version")"
```

## Out of scope

- Annotated tags (`git tag -a`). Lightweight tags are sufficient for git-URL pinning.
- Pushing (always manual: `git push --follow-tags`).
- Release notes generation.
- CI automation for tagging.

_Ralph: append findings here._
