# 20. `pnpm verify:changelog` — CI enforcement and pre-push hook
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** M
**Version impact:** minor
**Depends on:** spec 19 (`pnpm bump` tooling)
**Touches:** `scripts/verify-changelog.mjs` (create), `.githooks/pre-push` (create), `package.json`, `.github/workflows/ci.yml`, `README.md`

## Context

Spec 19 adds the `pnpm bump` command that atomically bumps the version and promotes `CHANGELOG.md`. But `pnpm bump` is only useful if developers (and Ralph) actually run it. Without enforcement, the pattern repeats: specs ship without bumps.

This spec adds two enforcement layers:

1. **CI check** (`pnpm verify:changelog`): a GitHub Actions step that fails PRs where source files changed but `plugin.json` version did not bump, or where the new version section in `CHANGELOG.md` is missing or empty. Gated to pull-request events so direct pushes to `main` (post-merge) don't re-fail.
2. **Local pre-push hook** (optional, opt-in): a committed `.githooks/pre-push` file that runs the same check. Users enable it with `git config core.hooksPath .githooks`.

Both layers run the same `scripts/verify-changelog.mjs` script so there is a single source of logic.

## Current behaviour

`package.json`: no `verify:changelog` script.
`.github/workflows/ci.yml`: runs `pnpm ci:check` and `pnpm test` only.
`.githooks/` directory: does not exist.
`scripts/verify-changelog.mjs`: does not exist.

## Target behaviour

### `scripts/verify-changelog.mjs`

Logic:

1. Determine the diff base:
   - In CI (env `CI=true`): `origin/main` (set via `git fetch --unshallow` already done by `actions/checkout@v4` with `fetch-depth: 0`).
   - Locally: `@{upstream}` if a tracking branch exists; fallback to `HEAD~1`.
2. Run `git diff --name-only <base>...HEAD` to get the list of changed files.
3. If **no changed files match** the guarded paths (see below), exit 0 silently (nothing to enforce).
4. **Guarded paths** (any match triggers enforcement):
   - `scripts/**/*.mjs`
   - `commands/**/*.md`
   - `.claude-plugin/plugin.json`
   - `.claude-plugin/marketplace.json`
   - `CLAUDE.md`
   - `README.md`
5. Read `plugin.json` version on HEAD and on base (via `git show <base>:.claude-plugin/plugin.json`).
6. Versions must differ. If they are the same, exit 1:
   ```
   verify:changelog: version in plugin.json was not bumped
     current: 2.0.0 (same as base)
     Run: pnpm bump <patch|minor|major>
   ```
7. Check `CHANGELOG.md` HEAD contains a section `## [<HEAD version>] — YYYY-MM-DD` with at least one non-`(none)` bullet. If not, exit 1:
   ```
   verify:changelog: CHANGELOG.md has no entry for version 2.1.0
     Add bullets under [Unreleased] then run: pnpm bump minor
   ```
8. Exit 0 with a brief summary: `verify:changelog: ok — version 2.0.0 → 2.1.0`.

No runtime deps: `node:child_process` (`spawnSync`), `node:fs` (`readFileSync`), `node:path`.

### `.githooks/pre-push`

A committed, executable shell script that invokes `pnpm verify:changelog`. Users opt in by running:
```sh
git config core.hooksPath .githooks
```

### `.github/workflows/ci.yml`

Append one new step after the existing `pnpm test` step, gated to PRs:

```yaml
      - run: pnpm verify:changelog
        if: github.event_name == 'pull_request'
```

## Affected files

| File | Change |
|---|---|
| `scripts/verify-changelog.mjs` | Create |
| `.githooks/pre-push` | Create (executable) |
| `package.json` | Add `verify:changelog` script |
| `.github/workflows/ci.yml` | Append one step |
| `README.md` | The hook opt-in note is already added by spec 19; no additional README changes needed here |

## Implementation steps

### Step 1 — Create `scripts/verify-changelog.mjs`

```js
#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Paths that trigger enforcement when changed */
const GUARDED = [
	/^scripts\/.+\.mjs$/,
	/^commands\/.+\.md$/,
	/^\.claude-plugin\/plugin\.json$/,
	/^\.claude-plugin\/marketplace\.json$/,
	/^CLAUDE\.md$/,
	/^README\.md$/,
];

/**
 * @param {string[]} args
 * @returns {{ stdout: string, status: number }}
 */
function git(...args) {
	const result = spawnSync("git", args, { encoding: "utf8", cwd: root });
	return { stdout: result.stdout ?? "", status: result.status ?? 1 };
}

function fail(/** @type {string} */ msg) {
	console.error(`verify:changelog: ${msg}`);
	process.exit(1);
}

// Determine diff base
const isCI = process.env.CI === "true";
let base = "origin/main";
if (!isCI) {
	const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}");
	base = upstream.status === 0 ? upstream.stdout.trim() : "HEAD~1";
}

// List changed files
const diff = git("diff", "--name-only", `${base}...HEAD`);
if (diff.status !== 0) {
	// If diff fails (e.g. on a shallow clone), skip silently
	console.log("verify:changelog: skipped (git diff unavailable)");
	process.exit(0);
}

const changedFiles = diff.stdout.trim().split("\n").filter(Boolean);
const triggered = changedFiles.some((f) => GUARDED.some((re) => re.test(f)));
if (!triggered) {
	console.log("verify:changelog: ok (no guarded paths changed)");
	process.exit(0);
}

// Read HEAD version
const pluginPath = path.join(root, ".claude-plugin/plugin.json");
/** @type {{ version: string }} */
let headPlugin;
try {
	headPlugin = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, "utf8")));
} catch {
	fail(`cannot read ${pluginPath}`);
	process.exit(1); // unreachable — satisfies TS
}
const headVersion = headPlugin.version;

// Read base version
const basePluginRaw = git("show", `${base}:.claude-plugin/plugin.json`);
let baseVersion = "";
if (basePluginRaw.status === 0) {
	try {
		baseVersion = /** @type {{ version: string }} */ (JSON.parse(basePluginRaw.stdout)).version;
	} catch {
		// base doesn't have plugin.json yet — treat as empty
	}
}

if (headVersion === baseVersion) {
	fail(
		`version in plugin.json was not bumped\n  current: ${headVersion} (same as base)\n  Run: pnpm bump <patch|minor|major>`,
	);
}

// Check CHANGELOG has a section for headVersion with at least one real bullet
let changelog;
try {
	changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
} catch {
	fail("cannot read CHANGELOG.md");
	process.exit(1);
}

const sectionMatch = changelog.match(
	new RegExp(`## \\[${headVersion.replace(/\./g, "\\.")}\\] — \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|$)`),
);
if (!sectionMatch) {
	fail(
		`CHANGELOG.md has no entry for version ${headVersion}\n  Add bullets under [Unreleased] then run: pnpm bump`,
	);
}

const sectionBody = sectionMatch[1];
const hasRealEntry = sectionBody
	.split("\n")
	.filter((l) => l.startsWith("- "))
	.some((l) => l !== "- (none)");
if (!hasRealEntry) {
	fail(
		`CHANGELOG.md section [${headVersion}] has no entries — only "(none)" placeholders found\n  Add bullets under [Unreleased] then re-run: pnpm bump`,
	);
}

console.log(`verify:changelog: ok — version ${baseVersion} → ${headVersion}`);
```

### Step 2 — Create `.githooks/pre-push` (executable)

Create the directory `.githooks/` in the repo root and create the file `.githooks/pre-push`:

```sh
#!/bin/sh
pnpm verify:changelog
```

Make it executable:
```sh
chmod +x .githooks/pre-push
```

The file must be executable in git's index too:
```sh
git update-index --chmod=+x .githooks/pre-push
```

### Step 3 — Add `verify:changelog` to `package.json`

In the `"scripts"` block, add after `"tag"`:

```json
"verify:changelog": "node scripts/verify-changelog.mjs",
```

### Step 4 — Append step to `.github/workflows/ci.yml`

In `.github/workflows/ci.yml`, find the final `- run: pnpm test` step and append immediately after:

```yaml
      - run: pnpm verify:changelog
        if: github.event_name == 'pull_request'
```

**Before** (end of file):
```yaml
      - run: pnpm ci:check
      - run: pnpm test
```

**After**:
```yaml
      - run: pnpm ci:check
      - run: pnpm test
      - run: pnpm verify:changelog
        if: github.event_name == 'pull_request'
```

## Test cases

| Scenario | Setup | Expected |
|---|---|---|
| Source changed + version bumped + CHANGELOG entry | `scripts/*.mjs` in diff, version different, CHANGELOG section present with real bullet | Exit 0: `verify:changelog: ok — version X.Y.Z → X.Y+1.Z` |
| Source changed, version NOT bumped | `scripts/*.mjs` in diff, same version on HEAD and base | Exit 1: "version in plugin.json was not bumped" |
| Source changed, version bumped, CHANGELOG missing section | version changed but no `## [X.Y.Z]` in CHANGELOG | Exit 1: "CHANGELOG.md has no entry for version X.Y.Z" |
| Source changed, version bumped, CHANGELOG section all `(none)` | section exists but all bullets are `- (none)` | Exit 1: "section … has no entries" |
| Only docs-only changes outside guarded paths | e.g. only `docs/plans/*.md` changed | Exit 0: "no guarded paths changed" |
| README.md changed | `README.md` in diff, but version not bumped | Exit 1: "version … was not bumped" |
| No changes at all | empty diff | Exit 0: "no guarded paths changed" |

## Acceptance criteria

- [ ] `pnpm verify:changelog` exits 0 when guarded files changed AND version bumped AND CHANGELOG section with real entry exists.
- [ ] `pnpm verify:changelog` exits 1 with a clear message when version not bumped.
- [ ] `pnpm verify:changelog` exits 1 with a clear message when CHANGELOG section missing or all `(none)`.
- [ ] `pnpm verify:changelog` exits 0 silently when no guarded paths changed.
- [ ] `.github/workflows/ci.yml` has a new `pnpm verify:changelog` step gated to `pull_request` events.
- [ ] `.githooks/pre-push` exists, is executable, and runs `pnpm verify:changelog`.
- [ ] `git ls-files --stage .githooks/pre-push` shows mode `100755`.
- [ ] `pnpm typecheck` passes on the new script.
- [ ] `pnpm lint` passes.

## Verification

```sh
# 1. Typecheck + lint
pnpm typecheck
pnpm lint

# 2. Test: no guarded files changed (should pass)
# Reset to a clean state and run the check
git stash  # if any uncommitted changes
pnpm verify:changelog
# Expected: exit 0, "ok (no guarded paths changed)" or "ok — version ..."

# 3. Test: check that pre-push hook file is executable
ls -la .githooks/pre-push
# Expected: -rwxr-xr-x

# 4. Test: hook executable bit in git index
git ls-files --stage .githooks/pre-push
# Expected: 100755 ...

# 5. Confirm CI yaml has the new step
grep "verify:changelog" .github/workflows/ci.yml
# Expected: one match

# 6. Confirm verify:changelog is in package.json
grep "verify:changelog" package.json
# Expected: one match
```

## Out of scope

- Updating `PROMPT.md`, `CLAUDE.md`, or `docs/plans/README.md` to document this tool for Ralph — that is spec 21.
- Enforcing commit message format (conventional commits are a convention, not enforced by this script).
- Detecting force-pushes or rebased commits (the simple three-dot diff is sufficient).
- Adding `fetch-depth: 0` to the CI workflow — `actions/checkout@v4` with default settings does a shallow clone; the three-dot diff `origin/main...HEAD` works because CI fetches the PR ref with enough history. If it fails on a shallow clone, the script exits 0 silently (see Step 1 logic).

_Ralph: append findings here._
