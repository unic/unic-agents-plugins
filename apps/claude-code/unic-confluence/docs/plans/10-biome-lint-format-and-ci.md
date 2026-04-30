# 10. Biome Lint, Format, and CI

**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** M
**Depends on:** spec 09 (test files must exist for `pnpm test` to run in CI)
**Touches:** `pnpm-workspace.yaml`, `package.json`, `biome.json` (new), `.github/workflows/ci.yml` (new), `scripts/push-to-confluence.mjs`

## Context

No linting or formatting enforcement exists today. The repo relies on the `.editorconfig` file for editor hints (tabs, LF, UTF-8) but nothing catches style drift in CI, and there is no automated way to verify that a contributor has not introduced bad patterns (unused variables, implicit any, loose equality) before a PR lands. Biome is chosen as a single tool covering both lint and format, avoiding the need to maintain both ESLint and Prettier configs. It understands ESM natively, runs fast enough to use as a pre-push gate, and its formatter is opinionated enough that it eliminates diffs caused by inconsistent quoting or comma styles. This spec also adds a GitHub Actions CI workflow that runs `biome ci` (non-destructive check) and `pnpm test` on Node 22 and 24 so regressions are caught on every push and pull request.

## Current behaviour

- `package.json` has no `"scripts"` field.
- `pnpm-workspace.yaml` exists (added in spec 00) with a `catalog:` entry for `marked` but no dev-dependency entries.
- There is no `biome.json`, no ESLint config, no Prettier config.
- There is no `.github/workflows/` directory.
- Running `pnpm lint` or `pnpm format` fails with `Missing script: lint` / `Missing script: format`.
- Indentation in `scripts/push-to-confluence.mjs` is already tabs. Quote style is already double-quote throughout. Trailing commas are present on multi-line argument lists.

**`pnpm-workspace.yaml` current content** (after spec 00):
```yaml
packages: []
catalog:
  marked: "catalog:"
```

Wait — spec 00 sets `marked: "17.0.5"` in the catalog section. Exact content after spec 00:
```yaml
packages: []
catalog:
  marked: "17.0.5"
```

**`package.json` current content** (after spec 00):
```json
{
  "name": "unic-confluence",
  "private": true,
  "license": "LGPL-3.0-or-later",
  "type": "module",
  "packageManager": "pnpm@10.x.x",
  "engines": { "node": ">=22" },
  "scripts": {
    "confluence": "node scripts/push-to-confluence.mjs",
    "sync-version": "node scripts/sync-version.mjs"
  },
  "dependencies": {
    "marked": "catalog:"
  }
}
```

(Exact versions of `packageManager` and other spec-00 additions may differ; what matters here is that no `devDependencies` key exists yet and the `scripts` object does not include `lint`, `format`, `check`, `ci:check`, or `test`.)

## Target behaviour

After this spec:

1. `pnpm lint` runs `biome lint .` — exits 0 on clean source, exits 1 with diagnostics on violations.
2. `pnpm format` runs `biome format --write .` — rewrites files in-place to match biome style.
3. `pnpm check` runs `biome check .` — combines lint + format check in one pass (does NOT write).
4. `pnpm ci:check` runs `biome ci .` — same as `check` but produces machine-readable output and always exits non-zero on any violation. Used in CI only.
5. `pnpm test` runs all test files via Node's built-in test runner (the exact glob comes from spec 09; this spec wires the script).
6. `.github/workflows/ci.yml` runs on every push to `main` and on every pull request. It installs dependencies, runs `pnpm ci:check`, and runs `pnpm test`, on both Node 22 and 24.
7. Existing source files are reformatted by `pnpm check --write` before committing — tabs preserved, double quotes enforced, trailing commas enforced, line width ≤ 100.

Biome version is pinned to the latest stable Biome 1.x at time of implementation. Do not upgrade mid-spec; pin once and move on.

## Implementation steps

### Step 1 — Add Biome to the catalog and devDependencies

Edit `pnpm-workspace.yaml` to add `@biomejs/biome` to the catalog:

```yaml
# BEFORE:
packages: []
catalog:
  marked: "17.0.5"

# AFTER:
packages: []
catalog:
  marked: "17.0.5"
  "@biomejs/biome": "1.9.4"   # Ralph: replace with latest stable Biome 1.x from https://biomejs.dev/guides/getting-started/
```

Edit `package.json` to add `devDependencies`:

```json
// BEFORE (relevant excerpt):
{
  "dependencies": {
    "marked": "catalog:"
  }
}

// AFTER:
{
  "dependencies": {
    "marked": "catalog:"
  },
  "devDependencies": {
    "@biomejs/biome": "catalog:"
  }
}
```

Run `pnpm install` to generate the updated `pnpm-lock.yaml`.

### Step 2 — Add scripts to package.json

The full `"scripts"` block after this spec (merges with whatever spec 00 and spec 09 introduced):

```json
"scripts": {
  "confluence": "node scripts/push-to-confluence.mjs",
  "sync-version": "node scripts/sync-version.mjs",
  "lint": "biome lint .",
  "format": "biome format --write .",
  "check": "biome check .",
  "ci:check": "biome ci .",
  "test": "node --test scripts/lib/inject.test.mjs scripts/lib/frontmatter.test.mjs scripts/lib/resolve.test.mjs"
}
```

Note: the `test` command lists spec-09 test files explicitly. If spec 09 uses a glob-based invocation instead (e.g. `node --test 'scripts/lib/*.test.mjs'`), defer to spec 09's choice — just ensure this spec's `test` script matches exactly what spec 09 defines.

### Step 3 — Create biome.json

Create `/Users/oriol.torrent/Sites/UNIC/unic-claude-code-confluence/biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineEnding": "lf",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  },
  "files": {
    "ignore": ["node_modules", ".history", "pnpm-lock.yaml"]
  }
}
```

Key decisions:
- `"indentStyle": "tab"` matches `.editorconfig` and existing source.
- `"quoteStyle": "double"` matches existing code — all string literals in `push-to-confluence.mjs` use double quotes.
- `"trailingCommas": "all"` matches the existing style on multi-line expressions.
- `"lineWidth": 100` gives enough room for the long error message strings in `handleHttpError` without wrapping them, while still catching runaway long lines.
- `"$schema"` pin: update this version string to match whatever Biome version you installed in step 1.

### Step 4 — Format all existing files in one pass

Run:
```sh
pnpm check --write
```

Review the diff carefully. This may reformat `push-to-confluence.mjs` (line endings, trailing commas, import ordering). Accept all formatting-only changes. Reject any change that alters logic (Biome's `--write` only applies safe formatter rewrites, but verify anyway).

Common changes to expect in `push-to-confluence.mjs`:
- Import block re-ordered alphabetically by `organizeImports`
- Trailing comma added to the last item in multi-line import lists
- Any `'single-quoted'` string literals converted to `"double-quoted"` (there should be none, but verify)

After the format pass, commit all changes to source files as part of this spec's PR, not as a separate "chore: format" commit. Keep them together so history is clean.

### Step 5 — Create the GitHub Actions CI workflow

Create `/Users/oriol.torrent/Sites/UNIC/unic-claude-code-confluence/.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    name: Lint, format, test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ["22", "24"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm ci:check
      - run: pnpm test
```

Notes:
- `pnpm/action-setup@v4` reads `packageManager` from `package.json` (set by spec 00) to match the pnpm version. The `version: 10` here is a fallback; if spec 00 sets `"packageManager": "pnpm@10.x.x"` the action uses that.
- `--frozen-lockfile` ensures CI fails fast if `pnpm-lock.yaml` is out of sync with `package.json`, which would indicate a missing `pnpm install` commit.
- `cache: pnpm` uses GitHub's built-in pnpm cache integration on the `setup-node` action, keyed to `pnpm-lock.yaml`. This shaves 30–60 s from warm CI runs.
- Matrix on `["22", "24"]` covers the current LTS and the upcoming LTS. Node 22 is the `engines` minimum defined in spec 00.

### Step 6 — Verify the workflow locally (optional but recommended)

If `act` is installed:
```sh
act push --job ci
```

Otherwise, push a branch and watch the Actions tab.

## Test cases

### TC-01: clean repo passes CI check
```sh
pnpm ci:check
# Expected: exit 0, no diagnostics
```

### TC-02: lint violation causes failure
Temporarily add an unused variable to `scripts/push-to-confluence.mjs`:
```js
const unused = 42;
```
```sh
pnpm lint
# Expected: exit 1
# Expected output includes: noUnusedVariables or similar diagnostic
```
Remove the line afterward.

### TC-03: format violation causes failure
Temporarily change a double-quoted string to single-quoted in `push-to-confluence.mjs`:
```js
const x = 'hello';
```
```sh
pnpm ci:check
# Expected: exit 1
# Expected output: "expected double quotes"
```
Run `pnpm format` to fix, verify `pnpm ci:check` exits 0 again.

### TC-04: tests pass
```sh
pnpm test
# Expected: exit 0, all test files report "pass"
```

### TC-05: GitHub Actions matrix
Push the branch to GitHub. Confirm both Node 22 and Node 24 jobs turn green in the Actions tab.

## Acceptance criteria

- `pnpm lint` exits 0 on the current codebase with no violations
- `pnpm format` rewrites files to match biome config without logic changes
- `pnpm ci:check` exits 0 on a clean repo, exits 1 when a lint or format violation is introduced
- `pnpm test` exits 0 (depends on spec 09 tests passing)
- `biome.json` exists at repo root with `indentStyle: tab`, `quoteStyle: double`, `trailingCommas: all`
- `.github/workflows/ci.yml` runs on push to `main` and on PRs
- CI matrix covers Node 22 and Node 24
- No `eslint`, `prettier`, or `@types/eslint` packages are introduced
- `pnpm-lock.yaml` is committed and up to date after `pnpm install`

## Verification

```sh
# Install dependencies (generates/updates pnpm-lock.yaml)
pnpm install

# Check all files pass biome (lint + format)
pnpm ci:check

# Run tests
pnpm test

# Confirm biome.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('biome.json', 'utf8')); console.log('biome.json OK')"

# Confirm CI workflow file parses as YAML
node -e "
  const fs = require('fs');
  // Just check it exists and is non-empty
  const s = fs.statSync('.github/workflows/ci.yml');
  console.log('.github/workflows/ci.yml exists, size:', s.size);
"
```

## Out of scope

- No TypeScript (`tsc`) in this spec — that is spec 14.
- No pre-commit hooks (Husky / lint-staged) — optional follow-up, not part of this spec.
- No `biome migrate` step — we are creating a fresh config, not migrating from ESLint.
- Do not change the Biome version after pinning. Pin once during implementation and leave it until a dedicated "upgrade Biome" task.
- Do not add `@typescript-eslint` or any ESLint package.
- Do not modify the logic in `push-to-confluence.mjs` — this spec only touches formatting.

## Follow-ups

- Add a pre-commit hook (Husky + lint-staged) that runs `biome check --write` on staged files before commit.
- Add `biome.json` schema version auto-update when Biome is upgraded (can be a Renovate/Dependabot rule).
- Add `"release"` script once spec 07 (release automation) is implemented.
