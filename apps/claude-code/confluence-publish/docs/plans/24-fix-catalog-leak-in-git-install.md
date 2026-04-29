# 24. Fix `catalog:` specifier leak in git-install consumers
**Status: done — 2026-04-27**

**Priority:** P0
**Effort:** S
**Version impact:** patch
**Depends on:** none (orthogonal to spec 23)
**Touches:** `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `CHANGELOG.md`, `docs/plans/README.md`

## Context

A downstream project (`agentic-delivery-model`) tries to install this plugin as an npm dep via the documented git-URL install path:

```sh
pnpm install -w -D git+ssh://git@github.com:unic/unic-claude-code-confluence
```

…and crashes immediately:

```
ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER  marked@catalog: isn't supported by any available resolver.

This error happened while installing the dependencies of unic-confluence@0.0.0

An external package outside of the pnpm workspace declared a dependency using
the catalog protocol. This is likely a bug in that external package. Only
packages within the pnpm workspace may use catalogs. Usages of the catalog
protocol are replaced with real specifiers on 'pnpm publish'.
```

Root cause: `unic-confluence` ships `"marked": "catalog:"` in its runtime `dependencies` (`package.json:26`). The `catalog:` protocol is a pnpm workspace-internal feature. When the package is consumed via `pnpm publish` it is rewritten to a concrete version automatically; when consumed via a git URL (the install path documented in `README.md:121,127,224,227`), pnpm clones the repo verbatim and reads `package.json` as-is — so the literal string `catalog:` reaches the downstream resolver, which has no workspace catalog to consult and aborts the install. `npm install <git-url>` fails the same way (npm has no catalog support at all).

This repo never publishes to npm. Evidence:

- `package.json#private: true` (`package.json:3`)
- no `"files"`, no `"publishConfig"`, no `"main"`/`"bin"`/`"exports"` field
- no `prepare` / `prepack` / `publish` script in `package.json#scripts`
- no `npm publish` / `pnpm publish` step in `.github/workflows/ci.yml`
- README "Install as npm package" section instructs consumers to use `git+ssh://…` (`README.md:121,127`)

The only supported install path is the git URL. Therefore runtime dependency specifiers must be valid in isolation — they cannot rely on workspace context that consumers do not share.

**Why not just adopt `pnpm publish`?** That is the canonical fix recommended by the pnpm error itself, but the change surface is much larger: drop `private: true`, define a `"files"` allowlist plus `"publishConfig"`, add a release job with an `NPM_TOKEN` secret, change README install instructions, coordinate the consumer migration. Track separately as a future spec; this one unblocks the consumer today with a one-line dep change.

**Why not a `prepare` script that rewrites `catalog:` at install time?** pnpm and npm do run `prepare` for git deps, but the rewrite would need a YAML parser to read `pnpm-workspace.yaml` (and that parser itself can't be `catalog:`), would mutate `package.json` mid-install, and would behave inconsistently across npm/pnpm/yarn. The complexity exceeds the benefit when the actual workspace has exactly one runtime dep.

**Why is keeping devDeps on `catalog:` safe?** Downstream `pnpm install <git-url>` only resolves the package's `dependencies` (and `peerDependencies` / `optionalDependencies`). `devDependencies` are skipped for non-root packages. Local development still happens inside the workspace, so `catalog:` continues to resolve normally for devDeps. The leak is strictly a runtime-dep problem.

## Current behaviour

`package.json:25-33`:

```json
"dependencies": {
    "marked": "catalog:"
},
"devDependencies": {
    "@biomejs/biome": "catalog:",
    "@ralph-orchestrator/ralph-cli": "catalog:",
    "@types/node": "catalog:",
    "typescript": "catalog:"
}
```

`pnpm-workspace.yaml:7-12`:

```yaml
catalog:
  "@biomejs/biome": 2.4.0
  "@ralph-orchestrator/ralph-cli": 2.9.2
  "@types/node": 24.12.2
  marked: 17.0.5
  typescript: 5.8.3
```

Result: any downstream `pnpm install git+ssh://...unic-claude-code-confluence` (or the `npm install` equivalent) fails at the resolver step with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER  marked@catalog:`. The plugin is unconsumable as an npm dependency.

## Target behaviour

### A. Runtime deps pinned directly, not via catalog

`package.json#dependencies.marked` becomes the exact version string `17.0.5` (the value previously held in the catalog). The catalog entry is removed because no other package references it (this repo is a single-package workspace).

After the change, downstream `pnpm install git+ssh://...` resolves `marked@17.0.5` straight from npm — no workspace context required.

### B. devDeps stay on `catalog:`

`@biomejs/biome`, `@ralph-orchestrator/ralph-cli`, `@types/node`, and `typescript` keep their `catalog:` specifiers. Consumers don't install transitive devDeps, so the leak doesn't reach them. Local development continues to use the catalog as the single source of truth for devDep versions.

### C. Ground rule prevents regression

`docs/plans/README.md` "Ground rules" section gains a bullet stating that `dependencies`, `peerDependencies`, and `optionalDependencies` MUST use concrete pinned versions (never `catalog:` or `workspace:`), because the package is consumed via git URL. Only `devDependencies` may use `catalog:`.

This converts the one-off fix into an enforceable convention so a future contributor doesn't reintroduce the same leak the next time a runtime dep is added.

### D. CHANGELOG records the fix

A bullet under `## [Unreleased]` → `### Fixed` documents the unblock for downstream consumers in user-facing language. `pnpm bump patch` promotes it under a new dated heading.

## Affected files

| File | Change |
|---|---|
| `package.json` | Replace `"marked": "catalog:"` with `"marked": "17.0.5"` in `dependencies` |
| `pnpm-workspace.yaml` | Remove the `marked: 17.0.5` line from the `catalog:` block |
| `pnpm-lock.yaml` | Regenerated automatically by `pnpm install` after the edits — commit the diff |
| `CHANGELOG.md` | Add `### Fixed` bullet under `## [Unreleased]`; promoted by `pnpm bump patch` |
| `docs/plans/README.md` | Append row 24 to the execution-order table; add a ground-rule bullet about runtime-dep pinning |

No source under `scripts/` is touched — `scripts/push-to-confluence.mjs` continues to `import { marked } from 'marked'` with zero behaviour change.

## Implementation steps

### Step 1 — De-catalog `marked` in `package.json`

Read the current catalog value first (do not assume `17.0.5` if the catalog has drifted by the time this spec runs):

```sh
grep -E "^\s+marked:" pnpm-workspace.yaml
```

Then edit `package.json:25-27`. Replace:

```json
"dependencies": {
    "marked": "catalog:"
},
```

with (substituting the catalog value you just read):

```json
"dependencies": {
    "marked": "17.0.5"
},
```

`package.json` indentation is **two spaces** (project convention for `.json` regardless of `.editorconfig`'s tab default — match the existing file).

### Step 2 — Remove `marked` from the catalog

Edit `pnpm-workspace.yaml`. Remove the line:

```yaml
  marked: 17.0.5
```

from the `catalog:` block (lines 7-12). The remaining four catalog entries (`@biomejs/biome`, `@ralph-orchestrator/ralph-cli`, `@types/node`, `typescript`) stay untouched and pinned exactly. Indentation in this file is two spaces (YAML convention) — preserve it.

### Step 3 — Refresh the lockfile

```sh
pnpm install
```

This rewrites `pnpm-lock.yaml` to record `marked@17.0.5` as a direct registry dep instead of a catalog-resolved one. Commit the updated lockfile alongside `package.json` and `pnpm-workspace.yaml`.

### Step 4 — Add CHANGELOG entry

Open `CHANGELOG.md`. Under `## [Unreleased]` → `### Fixed`, replace `- (none)` (or append, if other entries already exist) with:

```markdown
- Pin `marked` directly in `package.json#dependencies` instead of `catalog:` so the plugin can be installed via git URL by external pnpm/npm projects (was failing with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER  marked@catalog:` because `catalog:` is a pnpm workspace-internal feature that only `pnpm publish` rewrites, and this plugin is consumed via git URL, not the registry)
```

### Step 5 — Update `docs/plans/README.md`

5a. After the row for spec 23 in the "Execution order" table, append:

```markdown
| 24 | [Fix `catalog:` leak in git-install consumers](./24-fix-catalog-leak-in-git-install.md) | P0 | — |
```

5b. In the "Ground rules" section, immediately after the existing `- **Dep versioning**: …` bullet, insert:

```markdown
- **Runtime dep specifiers**: `dependencies`, `peerDependencies`, and `optionalDependencies` in `package.json` MUST use exact pinned versions (e.g. `"marked": "17.0.5"`) — never `catalog:` or `workspace:`. The plugin is consumed via git URL (`git+ssh://...`), so consumers don't share our pnpm workspace and cannot resolve catalog specifiers; pnpm only rewrites `catalog:` at `pnpm publish` time, which this repo does not run. `devDependencies` may continue to use `catalog:` because consumers don't install transitive devDeps. To bump a runtime dep: edit `package.json` directly; do not add it to the catalog.
```

This bullet is the regression guard. Without it, the next runtime dep added to the project will reintroduce the same break.

### Step 6 — Local verification mirroring downstream

```sh
# 6a. Finishing-your-work sequence (per CONTRIBUTING.md)
pnpm install --frozen-lockfile
pnpm format          # write any formatting fixes
pnpm check           # biome lint + format check (must be clean before bump)
pnpm test            # full test suite
pnpm typecheck       # JSDoc / @ts-check

# 6b. Simulate a downstream git-URL consumer to confirm the leak is fixed.
#     Use a clean tmpdir so we don't pollute the workspace.
repo=$(git -C /Users/oriol.torrent/Sites/UNIC/unic-claude-code-confluence rev-parse --show-toplevel)
tmp=$(mktemp -d) && cd "$tmp"
pnpm init >/dev/null
pnpm add -D "git+file://$repo"
# Expected:
#   - install succeeds (no ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER)
#   - node_modules/unic-confluence/package.json#dependencies.marked === "17.0.5"
#   - node_modules/marked exists
node -e "console.log(require('./node_modules/unic-confluence/package.json').dependencies)"
test -d node_modules/marked && echo OK
cd - && rm -rf "$tmp"
```

### Step 7 — Bump, mark done, and commit

```sh
pnpm bump patch                 # increments plugin.json, mirrors marketplace.json, promotes CHANGELOG
pnpm verify:changelog           # confirms version bump + CHANGELOG entry coherent
```

Then prepend the H1 of this spec with `**Status: done — <YYYY-MM-DD>**` and stage all changed files:

```sh
git add package.json pnpm-workspace.yaml pnpm-lock.yaml \
        CHANGELOG.md docs/plans/README.md \
        docs/plans/24-fix-catalog-leak-in-git-install.md \
        .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "fix(spec-24): pin marked directly so git-URL consumers can install (vX.Y.Z)"
```

Replace `X.Y.Z` with the version output by `pnpm bump`.

## Test cases

| Scenario | Action | Expected outcome |
|---|---|---|
| Local install in workspace | `pnpm install --frozen-lockfile` | Lockfile honoured; `marked@17.0.5` resolves directly from registry |
| Local lint/test/typecheck | `pnpm ci:check && pnpm test && pnpm typecheck` | All pass; `scripts/push-to-confluence.mjs` still imports `marked` correctly |
| Downstream pnpm git install | `pnpm add git+ssh://git@github.com:unic/unic-claude-code-confluence` from a non-workspace project | Install succeeds; `marked` resolves to `17.0.5` in the consumer's `node_modules` |
| Downstream npm git install | `npm install git+ssh://git@github.com:unic/unic-claude-code-confluence` | Install succeeds (npm previously also broke on `catalog:`; pinning fixes both) |
| Real `agentic-delivery-model` install | Re-run `pnpm install -w -D git+ssh://…` in `~/Sites/UNIC/agentic-delivery-model` | No `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER` |
| devDep `catalog:` still works locally | `pnpm exec biome --version`, `pnpm exec tsc --version` | Versions match `pnpm-workspace.yaml#catalog` entries |
| Ground-rule visible to future contributors | `grep "Runtime dep specifiers" docs/plans/README.md` | One match in "Ground rules" section |
| Markdown rendering still works | Run `pnpm confluence --dry-run <key> README.md` against any page | `marked` converts MD → HTML as before |

## Verification

```sh
# 1. Confirm marked is pinned directly
grep -n '"marked"' package.json
# Expected: "marked": "17.0.5",   (no `catalog:`)

# 2. Confirm marked is NOT in the catalog anymore
grep -nE "^\s+marked:" pnpm-workspace.yaml
# Expected: no matches

# 3. Confirm devDeps still use catalog (count of remaining `catalog:` literals in package.json)
grep -c '"catalog:"' package.json
# Expected: 4 (the four devDep entries; runtime deps no longer use catalog:)

# 4. Confirm lockfile reflects the change
grep -nE "^\s+marked:" pnpm-lock.yaml | head
# Expected: an entry under `importers > .` listing marked at 17.0.5 from the registry, not via catalog

# 5. Confirm CHANGELOG entry exists under Unreleased > Fixed
sed -n '/## \[Unreleased\]/,/## \[/p' CHANGELOG.md | grep -i "catalog"
# Expected: at least one match describing the fix

# 6. Confirm execution-order row added
grep -n "24 |" docs/plans/README.md
# Expected: row pointing at ./24-fix-catalog-leak-in-git-install.md

# 7. Confirm ground-rule bullet added
grep -n "Runtime dep specifiers" docs/plans/README.md
# Expected: one match in the "Ground rules" section

# 8. End-to-end: simulate a git-URL consumer in a tmpdir
repo=$(git -C /Users/oriol.torrent/Sites/UNIC/unic-claude-code-confluence rev-parse --show-toplevel)
tmp=$(mktemp -d) && cd "$tmp" && pnpm init >/dev/null && \
  pnpm add -D "git+file://$repo" && \
  node -e "console.log(require('./node_modules/unic-confluence/package.json').dependencies.marked)" && \
  test -d node_modules/marked && cd - && rm -rf "$tmp"
# Expected: prints "17.0.5"; node_modules/marked exists; whole script exits 0

# 9. Verify the actual downstream consumer
cd /Users/oriol.torrent/Sites/UNIC/agentic-delivery-model && pnpm install
# Expected: no ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER

# 10. CI smoke after push
gh run watch --exit-status
# Expected: green on both Node 22 and Node 24 legs
```

## Acceptance criteria

- [ ] `package.json#dependencies.marked` is a concrete version string (matching the value previously in the catalog), not `"catalog:"`.
- [ ] `pnpm-workspace.yaml#catalog` block no longer contains a `marked` entry.
- [ ] `pnpm-lock.yaml` reflects `marked` resolved as a direct registry dep, regenerated by `pnpm install`.
- [ ] All four devDeps (`@biomejs/biome`, `@ralph-orchestrator/ralph-cli`, `@types/node`, `typescript`) still use `"catalog:"` and resolve via the catalog.
- [ ] `CHANGELOG.md` has a `### Fixed` bullet describing the unblock (promoted by `pnpm bump patch` to a dated section).
- [ ] `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` versions match and are one patch above the previous release.
- [ ] `docs/plans/README.md` execution-order table has a row 24 for this spec.
- [ ] `docs/plans/README.md` "Ground rules" section has a bullet declaring that runtime-dep specifiers MUST be concrete versions (never `catalog:`/`workspace:`) because consumers install via git URL.
- [ ] `pnpm install --frozen-lockfile`, `pnpm ci:check`, `pnpm test`, `pnpm typecheck`, and `pnpm verify:changelog` all pass locally.
- [ ] A clean tmpdir consumer running `pnpm add git+file://<repo>` succeeds and prints `17.0.5` for `marked`.
- [ ] `cd ~/Sites/UNIC/agentic-delivery-model && pnpm install` succeeds (the original failure mode is gone).
- [ ] No source code under `scripts/` is modified; `scripts/push-to-confluence.mjs` continues to `import { marked } from 'marked'` with no behaviour change.

## Out of scope

- **Migrate to real `pnpm publish` / npm registry.** Recommended long-term path: drop `private: true`, add `"files"` and `"publishConfig"`, add a `release.yml` workflow that runs `pnpm publish --access public` on tag push (which auto-resolves `catalog:`), update README install instructions to `pnpm add unic-confluence`. This is the canonical fix per pnpm's own error message but it is a multi-touch change involving secrets (`NPM_TOKEN`), package metadata, file allowlist auditing, and consumer migration. Track in a separate spec (e.g. `25-publish-to-npm-registry.md`).
- **`prepare`-script-based catalog rewrite.** Adding a script that runs at consumer-install time to materialise resolved versions in `package.json` was considered and rejected: it requires a YAML parser, mutates `package.json` mid-install, and behaves inconsistently across npm/pnpm/yarn. The benefit (keep `marked` in the catalog for symmetry) is not worth the complexity for one runtime dep.
- **Convert `marked` to a peerDependency.** Making consumers install `marked` themselves would dodge the catalog issue but breaks the plugin's "drop in and run" promise and changes the consumer contract. Out of scope.
- **Add `pnpm pack` smoke check to CI.** A workflow step that runs `pnpm pack` and inspects the tarball's `package.json` for `catalog:` strings would catch future regressions, but the ground-rule bullet plus existing reviewer attention should keep regressions cheap. Track separately if a regression actually occurs.
- **Bump `marked` itself.** Stay on `17.0.5` (whatever the catalog currently holds at execution time). A version bump is a separate decision with separate risk.
- **Audit other transitive `catalog:` leaks.** This spec verifies the only runtime dep (`marked`). If a future spec adds `peerDependencies` or `optionalDependencies`, the new ground rule covers them — no preemptive audit needed.

_Ralph: append findings here._
