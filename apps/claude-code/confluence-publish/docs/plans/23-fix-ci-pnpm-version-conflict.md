# 23. Fix CI pnpm version conflict

**Priority:** P0
**Effort:** S
**Version impact:** patch
**Depends on:** spec 22 (last sequential entry; no real dependency)
**Touches:** `.github/workflows/ci.yml`, `CHANGELOG.md`, `docs/plans/README.md`

## Context

CI is currently broken on `feature/autopopulate-confluence-pages-aliases` (and will break on every PR / push to `main`) with:

```
Error: Error: Multiple versions of pnpm specified:
  - version 10 in the GITHUB_ACTION_INPUT_VERSION environment variable
  - version pnpm@10.24.0 in the package.json#packageManager
Remove one of these to continue.
```

Failing run: <https://github.com/unic/unic-claude-code-confluence/actions/runs/24897403641/job/72905826220>

The conflict came in implicitly: spec `00` set up `pnpm/action-setup@v4` with `version: 10`, and a later commit (around the spec-19/20 versioning work) added `"packageManager": "pnpm@10.24.0"` to `package.json`. `pnpm/action-setup@v4` ≥ June 2024 enforces "single source of truth" and errors out when both are declared, instead of silently picking one.

The right fix is to **drop the workflow `version` input** and let `package.json#packageManager` be the canonical pin. Reasons:

1. `package.json#packageManager` is the npm-defined, tool-agnostic standard (Corepack, Volta, Yarn, pnpm all read it).
2. It already exists in the repo, is exact-pinned (`10.24.0`), and is what local developers use.
3. `pnpm bump` and Renovate/dependabot bumps update `package.json` — keeping CI in sync with the workflow file would require a second update site.

`cache: pnpm` on `actions/setup-node@v4` is unaffected by this change — it only requires that pnpm is on `PATH` by the time `setup-node` runs, which `pnpm/action-setup` (without `version`) still guarantees.

## Current behaviour

`.github/workflows/ci.yml:16-23`:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: pnpm
```

`package.json:6` (single source of truth that the workflow conflicts with):

```json
"packageManager": "pnpm@10.24.0",
```

Result: every job in the matrix (`node-version: ["22", "24"]`) fails at the `pnpm/action-setup@v4` step before any install / lint / test runs.

## Target behaviour

### A. Workflow defers to `package.json#packageManager`

`.github/workflows/ci.yml` no longer passes a `version` input to `pnpm/action-setup@v4`. The action reads the version from `package.json#packageManager` (its documented fallback when no `version` is provided). The matrix job runs `pnpm install --frozen-lockfile`, `pnpm ci:check`, `pnpm test`, and (on PRs) `pnpm verify:changelog` to green.

### B. CHANGELOG records the fix

A bullet under `## [Unreleased]` → `### Fixed` documents the CI repair in user-facing language. After `pnpm bump patch` runs, the bullet is promoted under a new dated heading.

### C. Plan README execution table updated

`docs/plans/README.md` execution-order table gains a row 23 with the new spec's link and `P0` priority.

### D. Plan README ground rule prevents regression

`docs/plans/README.md` "Ground rules" section gains a bullet stating that `package.json#packageManager` is the single source of truth for the pnpm version, that CI workflows must NOT pass a `version` input to `pnpm/action-setup`, and that bumping pnpm is done by editing `packageManager` (after which `pnpm install` regenerates the lockfile). This converts the one-off fix into an enforceable convention so a future contributor doesn't reintroduce the conflict.

## Affected files

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Remove the `with: version: 10` block from the `pnpm/action-setup@v4` step |
| `CHANGELOG.md` | Add `### Fixed` bullet under `## [Unreleased]`; promoted by `pnpm bump patch` |
| `docs/plans/README.md` | Append row 23 to the execution-order table; add a ground-rule bullet about pnpm version pinning |

## Implementation steps

### Step 1 — Trim the workflow

Edit `.github/workflows/ci.yml`. Replace lines 17-19:

```yaml
      - uses: pnpm/action-setup@v4
        with:
          version: 10
```

with:

```yaml
      - uses: pnpm/action-setup@v4
```

Keep tabs/spaces consistent with the surrounding YAML (the existing file uses 2-space indentation inside `steps:` — match it; do **not** convert to tabs even though the repo's `.editorconfig` says tabs, because YAML in this file already uses spaces and a mid-file switch would break parsing).

The final shape of the `steps:` block must be exactly:

```yaml
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm ci:check
      - run: pnpm test
      - run: pnpm verify:changelog
        if: github.event_name == 'pull_request'
```

### Step 2 — Add CHANGELOG entry

Open `CHANGELOG.md`. Under `## [Unreleased]` → `### Fixed`, replace `- (none)` (or append, if other entries already exist) with:

```markdown
- CI: drop redundant `version: 10` from `pnpm/action-setup@v4` so `package.json#packageManager` is the single source of truth (CI was failing with "Multiple versions of pnpm specified")
```

### Step 3 — Update `docs/plans/README.md`

3a. After the row for spec 22 in the "Execution order" table, append:

```markdown
| 23 | [Fix CI pnpm version conflict](./23-fix-ci-pnpm-version-conflict.md) | P0 | — |
```

3b. In the "Ground rules" section, insert a new bullet immediately after the existing `**Package manager**:` bullet:

```markdown
- **pnpm version pinning**: `package.json#packageManager` (e.g. `pnpm@10.24.0`) is the single source of truth. CI workflows MUST NOT pass a `version` input to `pnpm/action-setup` — the action reads `packageManager` automatically. To bump pnpm: edit `packageManager` in `package.json`, run `pnpm install` to regenerate the lockfile, and commit both. Never declare the pnpm version in two places.
```

### Step 4 — Bump and verify

Run, in order:

```sh
pnpm install --frozen-lockfile     # sanity check that local install still works
pnpm ci:check                       # lint + format + typecheck (matches CI)
pnpm test                           # full suite
pnpm bump patch                     # increments plugin.json, mirrors marketplace.json, promotes CHANGELOG
pnpm verify:changelog               # confirms version bump + CHANGELOG entry are in sync
```

`pnpm bump patch` will turn the current `2.0.1` into `2.0.2` (or whatever the current head is — read `.claude-plugin/plugin.json` first; do not assume).

### Step 5 — Mark done and commit

Prepend the H1 with `**Status: done — <YYYY-MM-DD>**`, then:

```sh
git add .github/workflows/ci.yml CHANGELOG.md docs/plans/README.md \
        docs/plans/23-fix-ci-pnpm-version-conflict.md \
        .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "fix(spec-23): drop redundant pnpm version pin from CI (vX.Y.Z)"
```

Replace `X.Y.Z` with the version output by `pnpm bump`.

## Test cases

| Scenario | Action | Expected outcome |
|---|---|---|
| Push to feature branch | `git push` | CI workflow starts; `Setup pnpm` step succeeds (no "Multiple versions" error) |
| `cache: pnpm` still resolves | CI runs `actions/setup-node@v4` step | `setup-node` finds pnpm on PATH; cache key derived correctly |
| `pnpm install --frozen-lockfile` | CI runs install | Resolves with pnpm 10.24.0 (from `packageManager`); lockfile honoured |
| Node 22 matrix leg | CI runs full pipeline on Node 22 | `pnpm ci:check`, `pnpm test`, and (on PR) `pnpm verify:changelog` all pass |
| Node 24 matrix leg | CI runs full pipeline on Node 24 | Same as Node 22 leg |
| Local dev unaffected | Developer runs `pnpm install` locally | Uses pnpm 10.24.0 (from `packageManager`); no behaviour change |
| Future pnpm bump | Bump `packageManager` to e.g. `pnpm@10.25.0` | CI picks up the new version on next push without touching the workflow file |

## Verification

```sh
# 1. Confirm the version arg is gone from the workflow
grep -n "version: 10" .github/workflows/ci.yml
# Expected: no matches

grep -nA1 "pnpm/action-setup" .github/workflows/ci.yml
# Expected: the line "uses: pnpm/action-setup@v4" with no "with:" block beneath it

# 2. Confirm packageManager is still authoritative
grep -n "packageManager" package.json
# Expected: "packageManager": "pnpm@10.24.0",

# 3. Confirm CHANGELOG entry exists under Unreleased > Fixed
sed -n '/## \[Unreleased\]/,/## \[/p' CHANGELOG.md | grep -i "Multiple versions"
# Expected: at least one match

# 4. Confirm execution-order row added
grep -n "23 |" docs/plans/README.md
# Expected: a row pointing at ./23-fix-ci-pnpm-version-conflict.md

# 4b. Confirm ground-rule bullet added
grep -n "pnpm version pinning" docs/plans/README.md
# Expected: one match in the "Ground rules" section

# 5. Local mirror of CI
pnpm install --frozen-lockfile
pnpm ci:check
pnpm test
pnpm verify:changelog
# Expected: all four exit 0

# 6. After commit + push, confirm GH Actions green
gh run watch --exit-status
# Expected: workflow concludes with conclusion=success on both Node 22 and Node 24 legs
```

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` has no `version:` input under `pnpm/action-setup@v4`.
- [ ] `package.json#packageManager` remains `pnpm@10.24.0` (untouched).
- [ ] `CHANGELOG.md` has a `### Fixed` bullet describing the CI repair (promoted by `pnpm bump patch` to a dated section).
- [ ] `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` versions match and are one patch above the previous release.
- [ ] `docs/plans/README.md` execution-order table has a row 23 for this spec.
- [ ] `docs/plans/README.md` "Ground rules" section has a bullet declaring `package.json#packageManager` as the single source of truth for the pnpm version and forbidding a `version` input to `pnpm/action-setup`.
- [ ] `pnpm install --frozen-lockfile`, `pnpm ci:check`, `pnpm test`, and `pnpm verify:changelog` all pass locally.
- [ ] After push, the GitHub Actions run on this branch is green for both `node-version: 22` and `node-version: 24`.
- [ ] No source code under `scripts/` is modified.

## Out of scope

- **Pinning the action by SHA.** Switching `pnpm/action-setup@v4` to a SHA pin would harden supply-chain posture but is unrelated to the breakage and would expand the diff. Track separately if desired.
- **Bumping pnpm itself.** Stay on `10.24.0`. A pnpm minor/major bump is a separate decision with separate risk (lockfile churn, `pnpm-workspace.yaml` schema).
- **Migrating to Corepack-only setup.** Replacing `pnpm/action-setup` with `corepack enable` + `actions/setup-node`'s native pnpm support is viable but is a larger refactor and changes how `cache: pnpm` resolves. Out of scope.
- **Adding a Renovate / Dependabot config to keep `packageManager` fresh.** Useful, but a separate spec.
- **Changing the matrix.** `node-version: ["22", "24"]` stays as-is. Engines say `>=24`; 22 is kept as a forward-compat smoke test.

_Ralph: append findings here._
