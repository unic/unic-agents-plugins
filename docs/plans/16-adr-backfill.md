# 16. Back-fill ADRs from existing specs and tooling

**Priority:** P2
**Effort:** L
**Version impact:** none
**Depends on:** none
**Touches:** `docs/adr/`, `apps/claude-code/auto-format/docs/adr/`, `apps/claude-code/pr-review/docs/adr/`, `apps/claude-code/unic-confluence/docs/adr/`

## Context

The repo adopted Matt Pocock's engineering skills (`grill-with-docs`, `improve-codebase-architecture`, `diagnose`, `tdd`). Several skills consult `docs/adr/` to avoid re-litigating past decisions and to ground architectural suggestions. Today zero ADRs exist, yet ~74 Ralph specs plus tooling in `packages/`, CI in `.github/workflows/`, and process docs in `docs/process/` collectively encode ~54 architectural decisions worth surfacing.

Without this back-fill the skills operate without grounding and may propose refactors that contradict already-accepted decisions.

`docs/plans/` (forward-looking Ralph specs) and `docs/adr/` (backward-looking decision records) are different artefacts; this spec adds a parallel tree without touching any existing file.

Format: **MADR-lite** — `# NN. Title` / `**Status:** Accepted (YYYY-MM)` / `## Context` / `## Decision` / `## Consequences`.

## Current behaviour

```
docs/
└── plans/   ← specs only; no adr/ directory
apps/claude-code/
├── auto-format/docs/    ← plans/ only
├── pr-review/docs/      ← plans/ only
└── unic-confluence/docs/← plans/ only
```

No `CONTEXT-MAP.md` or `CONTEXT.md` files exist (created lazily later via `/grill-with-docs`).

## Target behaviour

```
docs/
├── adr/
│   ├── README.md
│   ├── 0001-pnpm-workspaces-no-turborepo.md
│   ├── 0002-shared-unic-packages.md
│   ├── 0003-jsdoc-tsc-nocheck-no-compile.md
│   ├── 0004-biome-prettier-split.md
│   ├── 0005-indentation-policy.md
│   ├── 0006-cross-platform-node-only-scripts.md
│   ├── 0007-release-tools-bin-commands.md
│   ├── 0008-tag-scheme-plugin-at-version.md
│   ├── 0009-plugin-json-version-source-of-truth.md
│   ├── 0010-pnpm-filter-bump-only-version-path.md
│   ├── 0011-plugin-migration-via-git-filter-repo.md
│   ├── 0012-license-files-manually-managed.md
│   ├── 0013-single-root-marketplace.md
│   ├── 0014-ci-matrix-three-os-two-node.md
│   ├── 0015-ci-paths-filter-changed-packages.md
│   ├── 0016-root-checks-unconditional.md
│   ├── 0017-verify-changelog-pr-only.md
│   ├── 0018-release-on-merge-tag-existence.md
│   ├── 0019-gpg-signing-opt-in.md
│   ├── 0020-per-plugin-ralph-loops.md
│   ├── 0021-conventional-commits-package-scope.md
│   ├── 0022-semver-per-plugin.md
│   ├── 0023-spec-template-format.md
│   └── 0024-ralph-atomic-iteration.md
└── plans/   ← unchanged
apps/claude-code/
├── auto-format/docs/adr/
│   ├── README.md
│   ├── 0001-hook-always-exits-zero.md
│   ├── 0002-zero-runtime-dependencies.md
│   ├── 0003-consumer-owns-formatters.md
│   ├── 0004-per-project-config-merge.md
│   ├── 0005-spawnsync-timeout-kill-signal.md
│   ├── 0006-posix-path-normalization-windows.md
│   ├── 0007-ci-creates-tags-automatically.md
│   └── 0008-jsdoc-types-ts-check.md
├── pr-review/docs/adr/
│   ├── README.md
│   ├── 0001-canonical-bot-signature.md
│   ├── 0002-signature-based-prior-review-detection.md
│   ├── 0003-target-latest-pr-iteration.md
│   ├── 0004-incremental-diff-baseline.md
│   ├── 0005-four-state-thread-classification.md
│   ├── 0006-reply-not-duplicate-auto-resolve.md
│   ├── 0007-summary-rewritten-not-appended.md
│   └── 0008-soft-dependency-pr-review-toolkit.md
└── unic-confluence/docs/adr/
    ├── README.md
    ├── 0001-refuse-publish-without-markers.md
    ├── 0002-three-strategy-injection-priority.md
    ├── 0003-structured-macro-for-code-blocks.md
    ├── 0004-dry-run-read-only.md
    ├── 0005-ping-check-auth-over-per-page-verify.md
    ├── 0006-hard-http-timeout.md
    ├── 0007-clierror-class.md
    ├── 0008-pure-functions-lib-with-tests.md
    ├── 0009-bare-integer-page-id-schema.md
    ├── 0010-no-catalog-for-runtime-deps.md
    ├── 0011-alias-auto-population.md
    └── 0012-do-not-add-scope-guard.md
```

## Affected files

| File | Change |
| ---- | ------ |
| `docs/adr/README.md` | Create |
| `docs/adr/0001-*.md` … `0024-*.md` | Create (24 files) |
| `apps/claude-code/auto-format/docs/adr/README.md` | Create |
| `apps/claude-code/auto-format/docs/adr/0001-*.md` … `0008-*.md` | Create (8 files) |
| `apps/claude-code/pr-review/docs/adr/README.md` | Create |
| `apps/claude-code/pr-review/docs/adr/0001-*.md` … `0008-*.md` | Create (8 files) |
| `apps/claude-code/unic-confluence/docs/adr/README.md` | Create |
| `apps/claude-code/unic-confluence/docs/adr/0001-*.md` … `0012-*.md` | Create (12 files) |

## Implementation steps

### Phase 1 — Scaffold

**1.1** Create `docs/adr/README.md`:

```markdown
# Architectural Decision Records

Back-filled from existing specs and tooling in 2025-05. Format: MADR-lite.

## Format

~~~markdown
# NNNN. Title

**Status:** Accepted (YYYY-MM)

## Context

Why this decision had to be made.

## Decision

What was decided.

## Consequences

- Bullet list of implications for future contributors.
~~~

## Numbering

Files are named `NNNN-slug.md`, zero-padded to 4 digits, per directory.
Numbers are assigned in the order decisions were recorded, not by importance.

## Amending records

- Never delete an ADR.
- If a decision is superseded, update the original status to `Superseded by ADR-NNNN` and create a new ADR.
```

**1.2** Create `apps/claude-code/auto-format/docs/adr/README.md`:

```markdown
# ADRs — auto-format plugin

Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root.
See the root `docs/adr/README.md` for format and numbering conventions.
```

**1.3** Create `apps/claude-code/pr-review/docs/adr/README.md`:

```markdown
# ADRs — pr-review plugin

Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root.
See the root `docs/adr/README.md` for format and numbering conventions.
```

**1.4** Create `apps/claude-code/unic-confluence/docs/adr/README.md`:

```markdown
# ADRs — unic-confluence plugin

Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root.
See the root `docs/adr/README.md` for format and numbering conventions.
```

---

### Phase 2 — Repo-wide ADRs

**2.1** Create `docs/adr/0001-pnpm-workspaces-no-turborepo.md`:

```markdown
# 0001. pnpm 10 workspaces — no Turborepo or Nx

**Status:** Accepted (2025-04)

## Context

A new monorepo needed a package manager strategy. Options included Turborepo, Nx, and plain pnpm workspaces. The repo contains a small number of plugins and shared packages; build orchestration overhead was undesirable.

## Decision

Use pnpm 10 in workspace mode. `pnpm --filter` is the sole dispatch mechanism. A workspace `catalog:` handles shared version pinning. No Turborepo, Nx, or other build orchestrator.

## Consequences

- Adding a new package requires a new directory + `package.json`; no pipeline registration step.
- CI fan-out is handled by `dorny/paths-filter` rather than task-graph inference.
- Turborepo caching and remote-cache features are not available.
- Contributors need pnpm 10; `package.json#packageManager` enforces this.
```

**2.2** Create `docs/adr/0002-shared-unic-packages.md`:

```markdown
# 0002. Shared tooling extracted into @unic/* workspace packages

**Status:** Accepted (2025-04)

## Context

Multiple plugins share the same lint rules, TypeScript config, and release scripts. Copying these per plugin leads to drift.

## Decision

Extract shared tooling into three `packages/` workspace members:

- `@unic/biome-config` — Biome 2 rules and formatter config
- `@unic/tsconfig` — base `tsconfig.json` for `tsc --checkJs`
- `@unic/release-tools` — `unic-bump`, `unic-sync-version`, `unic-tag`, `unic-verify-changelog` bin commands

Plugins depend on these via `workspace:*`. The packages are private (not published).

## Consequences

- Lint and type-checking rules evolve in one place.
- Adding a new plugin means consuming `workspace:*` deps, not copying scripts.
- Changes to shared tooling must not break any plugin; cross-plugin test runs are required.
```

**2.3** Create `docs/adr/0003-jsdoc-tsc-nocheck-no-compile.md`:

```markdown
# 0003. JSDoc + tsc --checkJs --noEmit — no TypeScript compilation

**Status:** Accepted (2025-04)

## Context

Plugin scripts must be runnable by Node directly (no build step). TypeScript provides type safety but the compilation output would be redundant for `.mjs` source.

## Decision

Use `// @ts-check` + JSDoc annotations in `.mjs` files. Run `tsc --checkJs --noEmit` for type-checking. No `tsc` compilation to JS; source files are the runtime artefacts.

## Consequences

- Zero-build deployments: Claude Code installs and runs source directly.
- Type errors surface at dev time via `pnpm typecheck`, not at deploy time.
- Some TypeScript features (decorators, enums, `as` casts in body) are unavailable.
- Contributors unfamiliar with JSDoc types need a brief onboarding.
```

**2.4** Create `docs/adr/0004-biome-prettier-split.md`:

```markdown
# 0004. Biome 2 for code/JSON; Prettier reserved for Markdown

**Status:** Accepted (2025-04)

## Context

Biome 2 is fast and unifies linting + formatting for JS/TS/JSON. However, Biome does not format Markdown well. Prettier handles Markdown natively.

## Decision

- Biome 2: lint and format `.mjs`, `.js`, `.ts`, `.json`, `.jsonc`
- Prettier: format `.md` only

Both tools run in `pnpm check` / `pnpm format` at the workspace root.

## Consequences

- Contributors need both `biome` and `prettier` dev dependencies.
- Markdown formatting is Prettier-governed (2-space indent, 80-col prose wrap by default).
- Any new file type must be explicitly assigned to one tool to avoid gaps.
```

**2.5** Create `docs/adr/0005-indentation-policy.md`:

```markdown
# 0005. Indentation policy: tabs for code, 2-space for data files

**Status:** Accepted (2025-04)

## Context

Mixed indentation across contributors and editors causes noisy diffs. A single explicit policy prevents this.

## Decision

- `.mjs`, `.js`, `.ts`: **tabs**
- `.json`, `.jsonc`, `.yml`, `.yaml`: **2 spaces**
- `.md`: Prettier default (2 spaces in lists, no tab indent)

Enforced by `@unic/biome-config` and Prettier config at the repo root.

## Consequences

- `editorconfig` at the root mirrors these rules for editor support.
- Biome and Prettier enforce them in CI; non-conforming files fail `pnpm check`.
```

**2.6** Create `docs/adr/0006-cross-platform-node-only-scripts.md`:

```markdown
# 0006. Cross-platform scripting via Node.js APIs — no shell commands

**Status:** Accepted (2025-04)

## Context

CI runs on macOS, Ubuntu, and Windows. Shell-based scripts (`#!/bin/bash`, `cp`, POSIX paths) fail on Windows or require WSL.

## Decision

All release scripts, hooks, and tooling use Node.js built-in APIs (`node:fs`, `node:path`, `node:child_process`, `node:os`) exclusively. No `bash`, `sh`, `cp`, `mv`, or POSIX path separators in scripts.

## Consequences

- Scripts run identically on all three OSes without a shell layer.
- `node:path.join` + `path.sep` replace POSIX path literals.
- `child_process.spawnSync` replaces shell pipelines; arguments are passed as arrays.
- Any future contributor adding a shell-based script must propose an ADR amendment.
```

**2.7** Create `docs/adr/0007-release-tools-bin-commands.md`:

```markdown
# 0007. Release scripts exposed as bin commands; cwd-relative, no --package flag

**Status:** Accepted (2025-04)

## Context

Release scripts (`bump`, `sync-version`, `tag`, `verify-changelog`) must work identically for any plugin. Two conventions were considered: (a) accept a `--package <name>` flag, (b) read `process.cwd()` and be invoked via `pnpm --filter`.

## Decision

Scripts are registered as `bin` entries in `@unic/release-tools/package.json` (`unic-bump`, `unic-sync-version`, `unic-tag`, `unic-verify-changelog`). They read `process.cwd()` as the package root. Consumers invoke them via `pnpm --filter <name> bump patch`, which sets cwd automatically.

## Consequences

- Plugin `package.json#scripts` entries are short (`"bump": "unic-bump"`).
- Scripts are reusable across any pnpm-filtered package without extra flags.
- Scripts will break if invoked outside of a `pnpm --filter` context (they'll read the wrong cwd).
```

**2.8** Create `docs/adr/0008-tag-scheme-plugin-at-version.md`:

```markdown
# 0008. Tag scheme: <plugin-name>@<version>

**Status:** Accepted (2025-04)

## Context

A single monorepo releases N plugins independently. A repo-wide `vX.Y.Z` tag cannot distinguish which plugin was released. Namespaced tags (e.g. `auto-format@0.5.5`) allow per-plugin release detection.

## Decision

Every release tag follows the pattern `<plugin-name>@<version>` (e.g. `auto-format@0.5.5`, `pr-review@1.2.0`). The plugin name matches the directory name under `apps/claude-code/`.

## Consequences

- `unic-tag` must construct the tag name from the plugin directory name + `plugin.json` version.
- The release workflow detects new releases by checking tag existence, not by diffing `HEAD~1`.
- Standard tools expecting `vX.Y.Z` tags (GitHub Releases auto-title, semantic-release) need configuration.
```

**2.9** Create `docs/adr/0009-plugin-json-version-source-of-truth.md`:

```markdown
# 0009. plugin.json is the single source of truth for plugin version

**Status:** Accepted (2025-04)

## Context

Each plugin has three files that carry a version: `.claude-plugin/plugin.json`, `marketplace.json`, and `package.json`. Manual edits to all three cause drift.

## Decision

`.claude-plugin/plugin.json` is the authoritative version field. `unic-sync-version` propagates the value to `marketplace.json` and `package.json` after every bump. Humans must only edit `plugin.json`.

## Consequences

- `pnpm --filter <name> bump <type>` is the only sanctioned version-change path.
- `marketplace.json` must never be hand-edited (enforced by convention; no file lock exists).
- The sync script must be run before tagging; `unic-tag` calls it defensively.
```

**2.10** Create `docs/adr/0010-pnpm-filter-bump-only-version-path.md`:

```markdown
# 0010. pnpm --filter <name> bump <type> is the only sanctioned version-change path

**Status:** Accepted (2025-04)

## Context

Version bumps must be atomic: increment the version, update CHANGELOG, sync derived files, and validate the result. Doing these steps ad hoc leads to inconsistency.

## Decision

`pnpm --filter <name> bump <patch|minor|major>` is the only way to change a plugin version. The `unic-bump` script: (1) validates a clean working tree, (2) increments `plugin.json`, (3) runs `unic-sync-version`. Contributors must not hand-edit version fields.

## Consequences

- CI's `verify:changelog` gate catches version bumps that were not accompanied by a changelog entry.
- `unic-bump` will exit non-zero on a dirty working tree, preventing mixed commits.
```

**2.11** Create `docs/adr/0011-plugin-migration-via-git-filter-repo.md`:

```markdown
# 0011. Plugin migration into the monorepo uses git filter-repo (subdirectory rewrite)

**Status:** Accepted (2025-04)

## Context

Three plugins were previously maintained in separate repositories. Moving them to the monorepo while preserving full commit history required a strategy. Options: (a) copy files + squash history, (b) `git filter-repo` to rewrite paths + merge with `--allow-unrelated-histories`.

## Decision

Use `git filter-repo --to-subdirectory-filter apps/claude-code/<plugin>` on the source repo, then merge into the monorepo with `git merge --allow-unrelated-histories`. This preserves every commit from the original repo, rewritten under the monorepo subdirectory path.

## Consequences

- Full per-plugin commit history is visible inside the monorepo via `git log -- apps/claude-code/<plugin>`.
- `git blame` works at the per-plugin level.
- The migration is one-time; future work happens entirely in the monorepo.
- `git filter-repo` must be installed locally (not part of standard git).
```

**2.12** Create `docs/adr/0012-license-files-manually-managed.md`:

```markdown
# 0012. LICENSE files are maintained manually by the repo owner

**Status:** Accepted (2025-04)

## Context

LICENSE files are legal artefacts. Automated tooling (Ralph, Claude) creating, copying, or deleting them could accidentally relicense packages or create inconsistencies that require legal review.

## Decision

LICENSE files in every package and plugin directory are managed manually by the maintainer. Ralph specs and Claude must never create, copy, or delete LICENSE files. If a spec step requires a LICENSE file to exist, the spec must include a note directing the maintainer to add it manually.

## Consequences

- `AGENTS.md` explicitly prohibits automated LICENSE file changes.
- Reviewers should reject PRs that add or remove LICENSE files via automation.
```

**2.13** Create `docs/adr/0013-single-root-marketplace.md`:

```markdown
# 0013. Single root marketplace.json listing all plugins

**Status:** Accepted (2025-04)

## Context

Claude Code discovers plugins via a marketplace manifest. With N plugins in one repo, users could either: (a) add N separate plugin sources, or (b) add one monorepo-level source that lists all plugins.

## Decision

Maintain a single `marketplace.json` at the repo root that lists every plugin. `unic-sync-version` updates the relevant plugin entry automatically. Users add one Claude Code source URL.

## Consequences

- Adding a new plugin requires adding its entry to the root `marketplace.json` template.
- All plugins are installed as a bundle when a user adds the source; individual opt-out is not supported.
- `marketplace.json` must never be hand-edited (it is derived from plugin manifests).
```

**2.14** Create `docs/adr/0014-ci-matrix-three-os-two-node.md`:

```markdown
# 0014. CI matrix: Ubuntu × macOS × Windows, Node 22 × Node 24

**Status:** Accepted (2025-04)

## Context

Plugins must run on all major operating systems (AGENTS.md cross-platform requirement) and must not break when users upgrade Node. Testing on the matrix asserts the cross-platform contract in CI rather than relying on convention.

## Decision

The per-package test job runs a 3×2 matrix: `ubuntu-latest`, `macos-latest`, `windows-latest` × Node 22 LTS, Node 24 LTS.

Windows installs run with `--ignore-scripts` because Windows postinstall scripts are unreliable in CI.

## Consequences

- CI cost and duration scale with 6 environments per changed package.
- Any script that uses OS-specific APIs will fail on at least one runner.
- Node version support policy: current LTS + next LTS.
```

**2.15** Create `docs/adr/0015-ci-paths-filter-changed-packages.md`:

```markdown
# 0015. CI uses paths-filter to scope test jobs to changed packages

**Status:** Accepted (2025-04)

## Context

Running all package tests on every push is expensive as the repo grows. Most pushes touch one plugin or one shared package.

## Decision

Use `dorny/paths-filter` in the CI workflow to detect which packages changed. Only changed packages fan out into the OS × Node matrix. The root checks job (Biome, Prettier) is unconditional and always runs.

## Consequences

- A push touching only `apps/claude-code/auto-format/` does not run `pr-review` or `unic-confluence` tests.
- A push touching `packages/release-tools/` should ideally trigger all plugins, but the paths filter must be kept up to date manually as new plugins are added.
- Documentation-only changes may skip the matrix entirely; `pnpm format` still runs.
```

**2.16** Create `docs/adr/0016-root-checks-unconditional.md`:

```markdown
# 0016. Root checks (Biome + Prettier) always run, regardless of changed files

**Status:** Accepted (2025-04)

## Context

Formatting is a repo-wide hygiene concern. A paths-filter on root checks would allow unformatted files to land if the change set appeared documentation-only.

## Decision

The `root-checks` CI job (Biome lint+format, Prettier on Markdown) runs on every push and every PR, unconditionally. It runs once on `ubuntu-latest` / Node 24 only (formatting is OS-independent).

## Consequences

- Every push pays the cost of a root check (~10–20 s).
- Contributors cannot bypass the formatter by touching only `docs/` files.
```

**2.17** Create `docs/adr/0017-verify-changelog-pr-only.md`:

```markdown
# 0017. verify:changelog runs on PR events only, not on push to main

**Status:** Accepted (2025-04)

## Context

`unic-verify-changelog` enforces that every version bump is accompanied by a dated CHANGELOG entry. Running it on push to `main` would block merges that were already validated on the originating PR.

## Decision

`verify:changelog` is a PR-only gate. It does not run on push to `develop` or `main`. The enforcement happens at review time, not at merge time.

## Consequences

- Direct pushes to `develop` (which are allowed by Gitflow for some maintainers) bypass the changelog gate.
- The gate relies on PR discipline; it cannot catch hotfixes pushed directly.
```

**2.18** Create `docs/adr/0018-release-on-merge-tag-existence.md`:

```markdown
# 0018. Releases triggered automatically on main by tag-existence check

**Status:** Accepted (2025-05) — supersedes HEAD~1 diff approach (spec 14)

## Context

The release workflow must create a `<plugin>@<version>` tag when a new version lands on `main`. Two approaches were considered: (a) diff `plugin.json` against `HEAD~1`, (b) check whether the tag `<plugin>@<version>` already exists.

The HEAD~1 diff approach fails when multiple commits are pushed together (the version bump may not be in the topmost commit). Tag-existence is idempotent and survives re-runs.

## Decision

For each plugin, the release workflow reads the current version from `plugin.json` and checks whether `<plugin>@<version>` already exists as a git tag. If the tag is absent, it creates it (with optional GPG signing). If the tag exists, it skips silently.

## Consequences

- Re-running the release workflow on the same commit is safe (idempotent).
- Downgrading a plugin version would not create a tag, which is the correct behaviour.
- The workflow must iterate over all plugins on every push to `main`.
```

**2.19** Create `docs/adr/0019-gpg-signing-opt-in.md`:

```markdown
# 0019. GPG tag signing is opt-in via UNIC_SIGN_TAGS repository secret

**Status:** Accepted (2025-04)

## Context

Signed git tags provide provenance guarantees but require GPG keys to be set up in the CI environment. Mandatory signing would block contributors who have not configured GPG.

## Decision

`unic-tag` and the release workflow sign tags only when the `UNIC_SIGN_TAGS` environment variable / repository secret is set to a truthy value. When absent, tags are created unsigned.

## Consequences

- Local `pnpm --filter <name> tag` runs without GPG by default.
- CI can be configured to sign by adding the `UNIC_SIGN_TAGS` secret to the GitHub repository.
- Verifying tag signatures requires the public key to be distributed separately.
```

**2.20** Create `docs/adr/0020-per-plugin-ralph-loops.md`:

```markdown
# 0020. Each plugin has its own Ralph loop with its own ralph.yml and PROMPT.md

**Status:** Accepted (2025-04)

## Context

Ralph Orchestrator implements specs one at a time in a loop. A single monorepo-wide loop would mix plugin-specific specs with workspace specs, making iteration focus unclear.

## Decision

Two levels of Ralph loops exist:

1. **Monorepo root loop** (`pnpm ralph` at repo root): implements `docs/plans/` specs (workspace structure, shared packages, CI).
2. **Per-plugin loop** (`pnpm --filter <name> ralph`): implements `apps/claude-code/<plugin>/docs/plans/` specs.

Each level has its own `ralph.yml` and `PROMPT.md`.

## Consequences

- Adding a new plugin requires creating its own `ralph.yml` and `PROMPT.md`.
- Running the root loop does not touch plugin-specific specs and vice versa.
- Status markers (`**Status: done**`) are scoped per loop level.
```

**2.21** Create `docs/adr/0021-conventional-commits-package-scope.md`:

```markdown
# 0021. Conventional Commits with package or spec scope

**Status:** Accepted (2025-04)

## Context

With multiple plugins and shared packages in one repo, commit messages without scope make changelogs and `git log` noisy. Conventional Commits with a scope field allow per-package filtering.

## Decision

Commit messages follow Conventional Commits with a mandatory scope:

- Plugin work: `feat(auto-format): …`, `fix(pr-review): …`, `chore(unic-confluence): …`
- Spec progress: `chore(spec-NN): …`
- Shared packages: `chore(release-tools): …`, `chore(biome-config): …`
- Workspace-level: `chore(workspace): …`

## Consequences

- `git log --grep="(auto-format)"` filters to one plugin's history.
- Release notes can be generated per-plugin by filtering on the scope.
- Reviewers should reject commits without a scope.
```

**2.22** Create `docs/adr/0022-semver-per-plugin.md`:

```markdown
# 0022. SemVer per plugin, not per monorepo

**Status:** Accepted (2025-04)

## Context

Plugins are independently released and consumed. A monorepo-level version would conflate unrelated changes across plugins.

## Decision

Each plugin maintains its own SemVer version in `.claude-plugin/plugin.json`. The versioning contract:

- **major**: breaking change to the plugin's CLI interface, exit codes, or file schema
- **minor**: new feature that is backwards-compatible
- **patch**: bug fix, documentation update, or internal refactor with no behaviour change

Shared packages (`@unic/*`) are internal and unversioned for external consumers.

## Consequences

- A breaking change in `unic-confluence` does not affect `auto-format` or `pr-review` versioning.
- Changelogs are per-plugin (`CHANGELOG.md` inside each plugin directory).
- There is no monorepo-wide version or combined release notes.
```

**2.23** Create `docs/adr/0023-spec-template-format.md`:

```markdown
# 0023. Spec template format for Ralph-executable specs

**Status:** Accepted (2025-04)

## Context

Ralph Orchestrator needs specs to be unambiguous enough to execute deterministically. An ad hoc format leads to missing context, Ralph pausing for clarification, or incorrect implementations.

## Decision

All specs follow `docs/process/spec-template.md`, which mandates:

- A header block: `Priority`, `Effort`, `Version impact`, `Depends on`, `Touches`
- `## Current behaviour` with exact before-state snapshots (code or CLI output)
- `## Target behaviour` with exact after-state
- `## Implementation steps` with explicit before→after diffs or full file content
- `## Verification` with shell commands and their expected output
- `## Acceptance criteria` as checkboxes
- `## Out of scope` bounding the change

## Consequences

- Specs are longer to write but faster for Ralph to execute without back-and-forth.
- The "Out of scope" section prevents scope creep during automated implementation.
- Specs that deviate from the template may cause Ralph to pause or implement incorrectly.
```

**2.24** Create `docs/adr/0024-ralph-atomic-iteration.md`:

```markdown
# 0024. Ralph implements one spec per iteration, then commits and stops

**Status:** Accepted (2025-04)

## Context

Batching multiple specs into one Ralph iteration makes commits hard to review, complicates revert, and makes it harder to resume after a failure.

## Decision

Ralph's loop implements exactly one spec per run, creates one commit, and stops. Loop resumption reads `**Status: done**` markers in spec files to determine the next spec to implement. The loop never modifies `PROMPT.md` or `ralph.yml` to batch specs.

## Consequences

- Each PR from a Ralph run contains one logical unit of work.
- The commit message references the spec number and title.
- Resuming after a failed Ralph run is mechanical: remove the `**Status: done**` marker from the partially-implemented spec and restart.
```

---

### Phase 3 — auto-format plugin ADRs

**3.1** Create `apps/claude-code/auto-format/docs/adr/0001-hook-always-exits-zero.md`:

```markdown
# 0001. Hook script always exits 0

**Status:** Accepted (2025-04)

## Context

The auto-format hook runs as a Claude Code `PostToolUse` hook after every file edit. If the hook exits non-zero, Claude Code treats the tool call as failed and may retry or abort the session.

## Decision

The hook script always exits 0, even when a formatter fails. Formatter errors are reported to stderr (visible in Claude Code's hook output) but do not block the tool flow.

## Consequences

- Formatter failures are surfaced as warnings, not as tool failures.
- Claude Code sessions are never blocked by a misconfigured formatter.
- Silent failures are possible if the user does not monitor hook output; this is an accepted trade-off.
```

**3.2** Create `apps/claude-code/auto-format/docs/adr/0002-zero-runtime-dependencies.md`:

```markdown
# 0002. Zero runtime dependencies in the hook script

**Status:** Accepted (2025-04)

## Context

The hook script is installed into users' Claude Code environments. Every runtime dependency adds install time, version pinning concerns, and potential breakage. The repo guideline is "zero runtime deps unless truly essential."

## Decision

The hook script uses only Node.js built-in modules (`node:child_process`, `node:fs`, `node:path`, `node:os`). No third-party packages are listed in `dependencies`.

## Consequences

- Install is instant (`npm install` / `pnpm install` fetches no extra packages).
- The hook cannot use convenience libraries (e.g. `glob`, `chalk`); all logic is hand-rolled.
- devDependencies (Biome, TypeScript) are allowed and are not installed in production.
```

**3.3** Create `apps/claude-code/auto-format/docs/adr/0003-consumer-owns-formatters.md`:

```markdown
# 0003. The plugin orchestrates; the consumer project owns its formatters

**Status:** Accepted (2025-04)

## Context

Bundling Prettier, ESLint, or Biome inside the plugin would lock consumers to specific versions and prevent them from customising formatter config. Detecting and invoking formatters already installed in the consumer project avoids this.

## Decision

The hook script detects which formatters are available in the consumer project (`prettier`, `eslint`, `biome`) by checking `node_modules/.bin` and `package.json` scripts. It invokes whatever it finds. The plugin never bundles or installs formatters.

## Consequences

- Consumers must have their formatters installed; the hook silently skips missing tools.
- Formatter version and config are always the consumer's own.
- The plugin works with any combination of Prettier, ESLint, and Biome without code changes.
```

**3.4** Create `apps/claude-code/auto-format/docs/adr/0004-per-project-config-merge.md`:

```markdown
# 0004. Per-project config merges over plugin defaults

**Status:** Accepted (2025-04)

## Context

Some projects need to disable specific formatters or file extensions. Without an override mechanism, users would have to fork the plugin.

## Decision

The plugin reads an optional `.claude-auto-format.json` (or equivalent key in `package.json`) in the consumer project root. Settings in this file merge over the plugin defaults, allowing users to opt out of specific tools or add extension sets without modifying the plugin.

## Consequences

- The plugin behaviour is customisable per project without a fork.
- The config schema must be documented and versioned.
- The hook must validate the consumer config and fail gracefully on schema errors.
```

**3.5** Create `apps/claude-code/auto-format/docs/adr/0005-spawnsync-timeout-kill-signal.md`:

```markdown
# 0005. spawnSync calls include a timeout and killSignal on every formatter invocation

**Status:** Accepted (2025-04)

## Context

A hung formatter (e.g. Prettier on a circular require, ESLint on a very large file) would freeze Claude Code's edit loop indefinitely. A timeout guard is necessary.

## Decision

Every `spawnSync` call in the hook script includes `timeout` (configurable, defaulting to 10 000 ms) and `killSignal: 'SIGTERM'`. If the timeout expires, the process is killed and the hook logs a warning to stderr and exits 0.

## Consequences

- Formatters that take longer than the timeout are killed; the file is left unformatted.
- The timeout is configurable via per-project config (see ADR-0004).
- SIGTERM may not stop all processes on Windows; `killSignal` is best-effort there.
```

**3.6** Create `apps/claude-code/auto-format/docs/adr/0006-posix-path-normalization-windows.md`:

```markdown
# 0006. Normalize Windows paths to POSIX before extension/glob matching

**Status:** Accepted (2025-04)

## Context

Claude Code passes file paths to hooks using the OS path separator. On Windows, paths use backslashes (`\`). Extension matching and glob patterns in the hook script assume POSIX separators.

## Decision

The hook script normalises all incoming file paths to POSIX format (`/`) using `path.normalize` + `.replace(/\\/g, '/')` before any extension or glob matching. Normalization is applied once at entry.

## Consequences

- Extension sets and glob patterns are written as POSIX strings throughout the script.
- The normalization step adds negligible overhead.
- Paths passed to `spawnSync` are re-normalized to the OS separator for the subprocess.
```

**3.7** Create `apps/claude-code/auto-format/docs/adr/0007-ci-creates-tags-automatically.md`:

```markdown
# 0007. Release tags are created automatically by CI, not manually

**Status:** Accepted (2025-04)

## Context

Manual tagging (`pnpm --filter auto-format tag && git push --follow-tags`) is error-prone and easy to forget. The tag is the trigger for the release workflow.

## Decision

The monorepo-level release workflow (`.github/workflows/release.yml`) creates `auto-format@<version>` automatically when `plugin.json` contains a version that has no corresponding git tag. Contributors never run `unic-tag` manually.

## Consequences

- Every version bump merged to `main` is automatically released.
- Local `unic-tag` is available but not part of the normal release flow.
- Reverting a version bump after the tag is created requires a manual `git tag -d` + push.
```

**3.8** Create `apps/claude-code/auto-format/docs/adr/0008-jsdoc-types-ts-check.md`:

```markdown
# 0008. JSDoc types and tsc --checkJs for type safety without compilation

**Status:** Accepted (2025-04)

## Context

Consistent with the monorepo-wide decision (repo ADR-0003). Recorded here for plugin-local reference.

## Decision

Hook script files use `// @ts-check` and JSDoc annotations. Type checking runs via `pnpm typecheck` (`tsc --checkJs --noEmit`). No TypeScript compilation occurs.

## Consequences

- Same as repo-level ADR-0003.
- Plugin contributors need to write JSDoc for new function parameters and return types.
```

---

### Phase 4 — pr-review plugin ADRs

**4.1** Create `apps/claude-code/pr-review/docs/adr/0001-canonical-bot-signature.md`:

```markdown
# 0001. Canonical bot signature is the session identity contract

**Status:** Accepted (2025-04)

## Context

The plugin posts review comments on pull requests. Subsequent runs must distinguish their own prior comments from human comments to avoid duplication, enable incremental reviews, and rewrite the summary comment rather than appending.

## Decision

Every comment posted by the plugin ends with a fixed signature line (e.g. `Reviewed by Claude Code`). This exact string is the identity contract: future runs detect prior reviews and comments by substring-matching on this signature.

## Consequences

- The signature string must never change between plugin versions (breaking change).
- Human reviewers who accidentally include the signature string in their comments will be misidentified as bot comments.
- The signature is the only identity mechanism; there is no API-level "bot author" field.
```

**4.2** Create `apps/claude-code/pr-review/docs/adr/0002-signature-based-prior-review-detection.md`:

```markdown
# 0002. Prior review detected by signature substring match, not by API metadata

**Status:** Accepted (2025-04)

## Context

Azure DevOps does not expose a first-class "bot author" field on comments. Alternatives to signature matching (author ID, comment type) are either unavailable or unreliable across ADO versions.

## Decision

The plugin detects a prior review by fetching all PR comments and checking whether any contains the canonical bot signature (see ADR-0001). If found, the run is classified as a re-review.

## Consequences

- Detection is O(N) in the number of PR comments.
- Works across all ADO versions without API-level bot identity.
- A human who includes the signature string in a comment will trigger a false re-review detection.
```

**4.3** Create `apps/claude-code/pr-review/docs/adr/0003-target-latest-pr-iteration.md`:

```markdown
# 0003. Always target the latest PR iteration, not iterationId=1

**Status:** Accepted (2025-04)

## Context

Azure DevOps tracks PR changes as numbered iterations. Inline comments must anchor to lines that exist in the current diff. Comments anchored to `iterationId=1` reference lines from the original push and may become invalid after force-push or rebase.

## Decision

The plugin always fetches the latest iteration ID for the PR and uses it when posting inline comments. `iterationId=1` is never used.

## Consequences

- Comments posted during a re-review anchor to the latest iteration's diff.
- If a re-review runs between two push events, the iteration ID may change mid-review; comments from the first half of the review may reference a stale iteration. This is an accepted edge case.
```

**4.4** Create `apps/claude-code/pr-review/docs/adr/0004-incremental-diff-baseline.md`:

```markdown
# 0004. Incremental diff baseline = prior iteration's sourceRefCommit

**Status:** Accepted (2025-04)

## Context

Re-reviewing a PR that has already been reviewed should focus on what changed since the last review, not re-analyse the entire diff. The baseline for "what changed" must be the commit that was HEAD when the previous review was posted.

## Decision

When a prior review is detected, the baseline commit is read from the prior review iteration's `sourceRefCommit.commitId`. Only files changed between that commit and the current HEAD are passed to the review agents.

## Consequences

- Re-review cost and noise are proportional to the delta since the last review.
- If the PR was rebased and the baseline commit is no longer in the history, the plugin falls back to a full diff.
```

**4.5** Create `apps/claude-code/pr-review/docs/adr/0005-four-state-thread-classification.md`:

```markdown
# 0005. Existing threads classified into four states: addressed, disputed, pending, obsolete

**Status:** Accepted (2025-04)

## Context

A re-review must handle existing comment threads intelligently: resolving issues that were fixed, escalating issues that were disputed, and carrying forward issues still outstanding. A shared taxonomy is needed for the reply and summary phases to make consistent decisions.

## Decision

Each existing bot thread is classified into one of four states:

- **addressed**: the issue was fixed in the new diff
- **disputed**: the reviewer replied disagreeing with the bot comment
- **pending**: no action taken; issue still exists in the new diff
- **obsolete**: the relevant code was deleted or moved; the comment no longer applies

## Consequences

- The classification taxonomy must remain stable across plugin versions.
- Adding a fifth state is a minor version bump (new feature, backwards-compatible).
- Classification accuracy depends on the review agent's analysis; false classifications are possible.
```

**4.6** Create `apps/claude-code/pr-review/docs/adr/0006-reply-not-duplicate-auto-resolve.md`:

```markdown
# 0006. Reply to existing threads instead of opening duplicates; auto-resolve addressed threads

**Status:** Accepted (2025-04)

## Context

Re-reviews that open duplicate comments for already-noted issues create noise and make PR conversations hard to follow. Addressed issues should be resolved to signal progress.

## Decision

- For **pending** and **disputed** threads: post a reply noting whether the issue persists or has been escalated.
- For **addressed** threads: post a reply confirming the fix and resolve the thread.
- Never open a new thread for an issue that already has an active thread.

## Consequences

- PR comment threads remain linear and readable.
- Addressed threads are automatically resolved, reducing the reviewer's manual work.
- Incorrectly classified threads (e.g. false "addressed") will be auto-resolved; the reviewer may need to reopen them.
```

**4.7** Create `apps/claude-code/pr-review/docs/adr/0007-summary-rewritten-not-appended.md`:

```markdown
# 0007. Summary comment is rewritten on re-review, not appended

**Status:** Accepted (2025-04)

## Context

A PR that goes through multiple review cycles accumulates stale summary comments if each run appends a new one. A single living summary is easier to read and tracks the current state of the review.

## Decision

The plugin maintains exactly one summary comment (identified by the bot signature). On re-review, the existing summary comment is edited (rewritten) with the updated issue count, severity breakdown, and outstanding items. No new summary comment is posted.

## Consequences

- The PR always shows one summary comment, not a stack of historical ones.
- The GitHub/ADO comment edit timestamp shows when the summary was last updated.
- If the summary comment is deleted by a human, the next re-review creates a new one.
```

**4.8** Create `apps/claude-code/pr-review/docs/adr/0008-soft-dependency-pr-review-toolkit.md`:

```markdown
# 0008. Soft dependency on pr-review-toolkit — abort with install instructions, never vendor

**Status:** Accepted (2025-04)

## Context

The pr-review plugin uses specialised sub-agents from `pr-review-toolkit`. Bundling the toolkit inside pr-review would couple their release cycles and inflate the plugin size.

## Decision

`pr-review` declares a soft dependency on `pr-review-toolkit`. On startup, the plugin checks whether the toolkit is installed. If not, it aborts and prints installation instructions. It never vendors or copies toolkit code.

## Consequences

- Users must install `pr-review-toolkit` separately.
- Toolkit upgrades (new agent types, improved prompts) are available to pr-review without a pr-review release.
- The startup check adds a small latency on every invocation.
```

---

### Phase 5 — unic-confluence plugin ADRs

**5.1** Create `apps/claude-code/unic-confluence/docs/adr/0001-refuse-publish-without-markers.md`:

```markdown
# 0001. Refuse to publish a page that has no markers; require --replace-all to overwrite

**Status:** Accepted (2025-04)

## Context

Publishing to Confluence without placement markers would silently overwrite hand-written page content. This is a destructive operation with no undo in the standard Confluence UI history for non-admins.

## Decision

The publish script refuses to process a Markdown file that contains no placement markers (e.g. `<!-- confluence:start -->` / `<!-- confluence:end -->`). To overwrite an entire page unconditionally, the caller must pass `--replace-all` explicitly.

## Consequences

- Authors must add markers to any Markdown file they intend to publish.
- The `--replace-all` flag is a deliberate escape hatch; it should not be used in automated pipelines.
- The guard prevents accidental destruction of Confluence page content.
```

**5.2** Create `apps/claude-code/unic-confluence/docs/adr/0002-three-strategy-injection-priority.md`:

```markdown
# 0002. Three-strategy injection with explicit priority: markers → anchor macros → append

**Status:** Accepted (2025-04)

## Context

Authors need different levels of precision when placing Markdown content into a Confluence page. A single strategy cannot satisfy all cases.

## Decision

The injection engine tries three strategies in priority order:

1. **Plain markers** (`<!-- confluence:start -->` / `<!-- confluence:end -->`): highest precision; replaces exactly the bounded section.
2. **Anchor macros**: places content relative to a named Confluence anchor macro.
3. **Append**: appends to the end of the page as a last resort.

The first matching strategy wins.

## Consequences

- Authors choose precision vs. convenience by adding the appropriate markers.
- The engine is deterministic: the same Markdown + same page always produces the same result.
- Adding a fourth strategy is a minor version bump.
```

**5.3** Create `apps/claude-code/unic-confluence/docs/adr/0003-structured-macro-for-code-blocks.md`:

```markdown
# 0003. ac:structured-macro for code blocks instead of <pre>

**Status:** Accepted (2025-04)

## Context

Confluence Storage Format supports both `<pre>` (plain preformatted text) and `ac:structured-macro name="code"` (the native Confluence Code macro). The Code macro provides syntax highlighting, a copy button, and a collapse option; `<pre>` provides none of these and loses formatting on Confluence editor reload.

## Decision

All fenced code blocks in Markdown are converted to `ac:structured-macro name="code"` elements in the Confluence Storage Format output. The language attribute is mapped to the macro's `language` parameter.

## Consequences

- Published code blocks look and behave like natively-authored Confluence code blocks.
- The conversion must handle unknown language identifiers gracefully (fall back to `text`).
- `<pre>` is never emitted by the converter.
```

**5.4** Create `apps/claude-code/unic-confluence/docs/adr/0004-dry-run-read-only.md`:

```markdown
# 0004. --dry-run is purely read-only: never sends a PUT to Confluence

**Status:** Accepted (2025-04)

## Context

`--dry-run` is used in CI smoke tests and pre-commit checks to validate that a Markdown file would publish correctly without actually modifying Confluence.

## Decision

When `--dry-run` is passed, the script performs all parsing, conversion, and marker injection steps but never calls the Confluence API's PUT endpoint. It logs what it would have done and exits 0.

## Consequences

- `--dry-run` is safe to run in any CI context, including production pipelines.
- The dry run validates the full conversion pipeline but not the Confluence API connection.
- A successful dry run does not guarantee a successful publish (API auth, page permissions may differ).
```

**5.5** Create `apps/claude-code/unic-confluence/docs/adr/0005-ping-check-auth-over-per-page-verify.md`:

```markdown
# 0005. --ping / --check-auth replaces per-page --verify for auth probing

**Status:** Accepted (2025-04)

## Context

An earlier design included a `--verify` flag that fetched N pages to confirm they were accessible. This was slow (N Confluence API round-trips) and gave a vague failure signal when one of N pages was inaccessible.

## Decision

Replace per-page verification with a single `--ping` / `--check-auth` flag that calls a lightweight Confluence API endpoint (e.g. `GET /rest/api/user/current`). One round-trip confirms auth and connectivity.

## Consequences

- Auth check is O(1) regardless of the number of pages configured.
- The check does not verify page-level access (read/write permissions per page).
- CI pipelines should run `--check-auth` on startup rather than `--verify`.
```

**5.6** Create `apps/claude-code/unic-confluence/docs/adr/0006-hard-http-timeout.md`:

```markdown
# 0006. Hard HTTP timeout on every Confluence API request

**Status:** Accepted (2025-04)

## Context

Corporate proxy configurations sometimes cause HTTP requests to stall indefinitely. A hung publish script blocks the user's terminal and any CI pipeline it runs in.

## Decision

Every HTTP request to the Confluence API is wrapped with a hard timeout (configurable, defaulting to 30 000 ms). If the timeout elapses, the request is aborted and the script exits with an error.

## Consequences

- Publish operations fail fast on network issues rather than hanging.
- The timeout must be configurable for slow enterprise networks.
- Node's `fetch` API with `AbortController` / `AbortSignal.timeout` implements this without extra dependencies.
```

**5.7** Create `apps/claude-code/unic-confluence/docs/adr/0007-clierror-class.md`:

```markdown
# 0007. CliError class instead of console.error + process.exit

**Status:** Accepted (2025-04)

## Context

Scattering `console.error(msg); process.exit(1)` throughout the script makes unit testing impossible (process.exit terminates the test runner) and makes error handling inconsistent.

## Decision

All user-facing fatal errors are thrown as `CliError` instances (a custom `Error` subclass with an optional `exitCode` field). The top-level entry point catches `CliError`, prints its message to stderr, and calls `process.exit` exactly once.

## Consequences

- Pure functions in `lib/` can throw `CliError` without calling `process.exit`.
- Tests can catch `CliError` and assert on its message and exit code without spawning a subprocess.
- Non-`CliError` exceptions bubble up to the top-level handler as unexpected errors (exit code 1, stack trace printed).
```

**5.8** Create `apps/claude-code/unic-confluence/docs/adr/0008-pure-functions-lib-with-tests.md`:

```markdown
# 0008. Pure functions extracted into lib/ and covered by node:test

**Status:** Accepted (2025-04)

## Context

Markdown → Confluence Storage Format conversion and marker injection are deterministic, input→output functions. Keeping them in the main script file makes them hard to test in isolation.

## Decision

All conversion and injection logic lives in `lib/` as pure functions (no I/O, no side effects). The main script imports from `lib/` and handles only I/O. Tests in `test/` use `node:test` to exercise `lib/` functions directly.

## Consequences

- The most complex logic (conversion, injection) is fully covered by unit tests.
- I/O paths (file reads, HTTP calls) remain thin and are not unit-tested.
- `lib/` functions must never import from `node:fs`, `node:http`, etc.
```

**5.9** Create `apps/claude-code/unic-confluence/docs/adr/0009-bare-integer-page-id-schema.md`:

```markdown
# 0009. confluence-pages.json values are bare integer page IDs

**Status:** Accepted (2025-04)

## Context

`confluence-pages.json` maps local file paths to Confluence page identifiers. An object value (e.g. `{ "id": 123, "space": "ENG" }`) would allow richer metadata but would complicate every read path and invite multi-space scope creep.

## Decision

Values in `confluence-pages.json` are bare integers (Confluence page IDs). No object schema, no space key, no title field. Human-readable aliases (slugified titles) are written alongside the ID as a comment-like key (see ADR-0011).

## Consequences

- Every read path is `config[path]` — no destructuring, no optional field access.
- The schema cannot be widened to an object without a major version bump.
- Multi-space support (different Confluence instances for different pages) is explicitly out of scope.
```

**5.10** Create `apps/claude-code/unic-confluence/docs/adr/0010-no-catalog-for-runtime-deps.md`:

```markdown
# 0010. Runtime dependencies must not use the pnpm catalog: protocol

**Status:** Accepted (2025-04)

## Context

pnpm workspace `catalog:` references are resolved at install time from `pnpm-workspace.yaml`. When a plugin is installed via `git+https://` (Claude Code's install method), there is no `pnpm-workspace.yaml` in scope and catalog refs break resolution.

## Decision

`dependencies` in `package.json` must use exact version strings or semver ranges — never `catalog:`. `devDependencies` may use `catalog:` because they are not installed in the user's environment.

## Consequences

- Runtime dependencies are pinned or ranged explicitly in `package.json`.
- Any PR that adds a `catalog:` entry to `dependencies` must be rejected.
- devDependencies (Biome, TypeScript) continue to use `catalog:` for consistency across the workspace.
```

**5.11** Create `apps/claude-code/unic-confluence/docs/adr/0011-alias-auto-population.md`:

```markdown
# 0011. Aliases auto-populate in confluence-pages.json on first publish by numeric ID

**Status:** Accepted (2025-04)

## Context

`confluence-pages.json` is initially configured with bare page IDs, which are not human-readable. Requiring authors to manually add slugified aliases is tedious.

## Decision

On the first successful publish of a page identified by its numeric ID, the script fetches the page title from Confluence, slugifies it, and writes an alias key back into `confluence-pages.json`. Subsequent publishes can reference the page by either the numeric ID or the alias.

## Consequences

- `confluence-pages.json` becomes progressively more readable as pages are published.
- The script must have write access to `confluence-pages.json` at publish time.
- An alias collision (two pages with the same slugified title) must be detected and rejected.
```

**5.12** Create `apps/claude-code/unic-confluence/docs/adr/0012-do-not-add-scope-guard.md`:

```markdown
# 0012. Explicit "Do not add" scope guard in CLAUDE.md prevents feature creep

**Status:** Accepted (2025-04)

## Context

The unic-confluence plugin has a narrow, well-defined scope: publish local Markdown to Confluence pages using markers. Several adjacent features were proposed and explicitly rejected during design: image upload, page creation, multi-instance support, MCP integration, watch mode, and recursive publish.

## Decision

A `## Do not add` section in the plugin's `CLAUDE.md` pre-rejects these features with brief reasons. Any contributor or automated agent (Ralph, Claude) encountering one of these features must reject the request and refer to this section rather than implementing it.

## Consequences

- Future contributors have a clear signal that these features are not oversight omissions.
- The ADR system supplements the CLAUDE.md guard: if a feature is re-proposed with new justification, the ADR can be amended rather than the scope guard silently overridden.
- The scope guard must be reviewed when the plugin reaches 1.0 — some restrictions may be relaxed.
```

## Verification

Run from the repo root after implementation:

```sh
# Confirm total file count: 4 READMEs + 24 + 8 + 8 + 12 = 56 files
find docs/adr apps/claude-code/auto-format/docs/adr apps/claude-code/pr-review/docs/adr apps/claude-code/unic-confluence/docs/adr -name '*.md' | wc -l
# Expected: 56

# Confirm all ADR files have the required sections
grep -rL '## Context' docs/adr apps/claude-code/*/docs/adr
# Expected: only README.md files (no content ADRs should be missing ## Context)

# Confirm Prettier passes on all new Markdown
pnpm format --check
# Expected: exit 0
```

## Acceptance criteria

- [ ] `docs/adr/` exists and contains `README.md` + 24 numbered ADR files
- [ ] `apps/claude-code/auto-format/docs/adr/` exists and contains `README.md` + 8 numbered ADR files
- [ ] `apps/claude-code/pr-review/docs/adr/` exists and contains `README.md` + 8 numbered ADR files
- [ ] `apps/claude-code/unic-confluence/docs/adr/` exists and contains `README.md` + 12 numbered ADR files
- [ ] All ADR files follow MADR-lite format: status line, `## Context`, `## Decision`, `## Consequences`
- [ ] `pnpm format --check` passes (Prettier on all new Markdown)
- [ ] No existing spec files, source files, or config files were modified

## Out of scope

- Editing existing specs (`docs/plans/`) to cross-link to ADRs
- Creating `CONTEXT.md` or `CONTEXT-MAP.md` (deferred to `/grill-with-docs`)
- Re-evaluating or amending any of the recorded decisions
- Adding ADRs for decisions not yet captured in specs or tooling
- Updating `docs/agents/domain.md` (it already references `docs/adr/` correctly)
