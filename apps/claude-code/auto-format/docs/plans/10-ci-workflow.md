# 10. CI Workflow

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-09
**Touches:** `.github/workflows/ci.yml`

## Context

A CI workflow on GitHub Actions ensures that every push/PR: (a) installs deps cleanly, (b) passes the smoke tests, and (c) passes `pnpm verify:changelog`. This is the safety net that catches regressions introduced between ralph iterations.

## Current behaviour

After spec `09`: `pnpm test` runs the smoke tests. No `.github/` directory exists.

## Target behaviour

- `.github/workflows/ci.yml` exists and runs on `push` and `pull_request`.
- Workflow steps: checkout → pnpm setup → node setup → `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm verify:changelog`.
- `pnpm/action-setup` reads `packageManager` from `package.json` (no explicit `version:` input — this is the UNIC convention per `docs/plans/README.md` ground rules).
- Node version is read from `pnpm-workspace.yaml`'s `useNodeVersion` field via `actions/setup-node` with `node-version-file: 'pnpm-workspace.yaml'`.

## Implementation steps

### Step 1 — Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        # reads packageManager from package.json — do not add version: here

      - uses: actions/setup-node@v4
        with:
          node-version-file: "pnpm-workspace.yaml"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Verify CHANGELOG
        run: pnpm verify:changelog
```

### Step 2 — Commit

```sh
git add .github/
git commit -m "ci(spec-10): add GitHub Actions CI workflow"
```

## Acceptance criteria

- `.github/workflows/ci.yml` is valid YAML.
- `pnpm/action-setup` has no `version:` input.
- `actions/setup-node` uses `node-version-file: "pnpm-workspace.yaml"`.
- Three job steps after install: `pnpm test`, `pnpm verify:changelog`.

## Verification

```sh
# 1. Valid YAML
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "OK: valid YAML"

# 2. No version: input in pnpm/action-setup block
grep -A5 "pnpm/action-setup" .github/workflows/ci.yml | grep "version:" && echo "FAIL: version: present" || echo "OK: no version:"
```

## Out of scope

- No release workflow (plugin is distributed via git URL).
- No matrix testing (single Node LTS version per `useNodeVersion`).
- No code coverage upload.

_Ralph: append findings here._
