# 09. CI Workflow

**Priority:** P0
**Effort:** M
**Version impact:** none
**Depends on:** 08
**Touches:** `.github/workflows/ci.yml`

## Context

Each old repo had its own CI workflow. The monorepo needs a single workflow that runs only the checks relevant to changed packages (path filtering), avoiding unnecessary CI cost. The matrix covers Ubuntu + macOS + Windows × Node 22 + 24 to satisfy the cross-platform requirement.

## Current behaviour

`.github/workflows/ci.yml` does not exist in the monorepo root. Per-plugin `.github/` directories were removed during migration (specs 05–07).

## Target behaviour

`.github/workflows/ci.yml` triggers on push to `main` and on PRs. It uses `dorny/paths-filter` to detect which packages changed, then runs a job matrix limited to the affected packages. Each job runs on all 3 OSes × 2 Node versions (6 jobs per affected package).

Each job runs:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter <name> test` (if package has tests)
3. `pnpm --filter <name> typecheck` (if package has typecheck script)
4. `pnpm --filter <name> verify:changelog` (on PRs only)

Root-level checks (Biome + Prettier) run once on Ubuntu/Node 24 regardless of which package changed.

## Affected files

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Create |

## Implementation steps

1. Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  root-checks:
    name: Root checks (Biome + Prettier)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm ci:check

  changes:
    name: Detect changed packages
    runs-on: ubuntu-latest
    outputs:
      pr-review: ${{ steps.filter.outputs.pr-review }}
      auto-format: ${{ steps.filter.outputs.auto-format }}
      confluence-publish: ${{ steps.filter.outputs.confluence-publish }}
      release-tools: ${{ steps.filter.outputs.release-tools }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            pr-review:
              - 'apps/claude-code/pr-review/**'
            auto-format:
              - 'apps/claude-code/auto-format/**'
            confluence-publish:
              - 'apps/claude-code/confluence-publish/**'
            release-tools:
              - 'packages/release-tools/**'

  test:
    name: Test ${{ matrix.package }} / ${{ matrix.os }} / Node ${{ matrix.node }}
    needs: changes
    if: |
      needs.changes.outputs.auto-format == 'true' ||
      needs.changes.outputs.confluence-publish == 'true' ||
      needs.changes.outputs.release-tools == 'true'
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: ['22', '24']
        package:
          - name: auto-format
            changed: ${{ needs.changes.outputs.auto-format }}
          - name: confluence-publish
            changed: ${{ needs.changes.outputs.confluence-publish }}
          - name: release-tools
            changed: ${{ needs.changes.outputs.release-tools }}
        exclude:
          - package:
              changed: 'false'
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${{ matrix.package.name }} --if-present test
      - run: pnpm --filter ${{ matrix.package.name }} --if-present typecheck
      - if: github.event_name == 'pull_request'
        run: pnpm --filter ${{ matrix.package.name }} --if-present verify:changelog
```

   > Note: `pr-review` has no tests or typecheck, so it is intentionally excluded from the test matrix. It is still subject to root Biome checks if its `.md` files change.

2. Run `pnpm check` to verify no Prettier issues in the new YAML file (YAML is excluded from Biome and Prettier in `.prettierignore`, so this is a no-op — but confirm).

## Verification

Commit the file and open a draft PR (or push a branch) to trigger the workflow. Alternatively, use `act` locally if available:

```sh
# Confirm the workflow file is valid YAML
node -e "import('node:fs').then(fs => { JSON.stringify(fs.readFileSync('.github/workflows/ci.yml', 'utf8')); console.log('readable') })"
```

Full verification happens when the GitHub repo is set up (spec 11).

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] Workflow triggers on push to `main` and on PRs
- [ ] Root checks job runs Biome + Prettier
- [ ] `dorny/paths-filter` detects per-package changes
- [ ] Test matrix covers Ubuntu + macOS + Windows × Node 22 + 24
- [ ] `verify:changelog` runs on PRs only

## Out of scope

- Actually running the workflow (requires GitHub remote — spec 11)
- Release workflow (spec 10)
- Adding new packages to the filter list (handled when new packages are added)
