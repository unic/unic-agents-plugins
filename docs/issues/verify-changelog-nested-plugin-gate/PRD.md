---
title: verify:changelog version-bump gate never fires for nested plugins
created: 2026-05-29
---

# PRD: `verify:changelog` version-bump gate never fires for nested plugins

**Status:** ready-for-agent
**Package:** `packages/release-tools`
**Issue:** [#162](https://github.com/unic/unic-agents-plugins/issues/162)
**Slices:** [#163](https://github.com/unic/unic-agents-plugins/issues/163)

---

## Problem Statement

As a maintainer of this monorepo, I rely on `pnpm --filter <plugin> verify:changelog` (and the same check in CI) to stop a PR that changes guarded plugin files — commands, scripts, the plugin manifest, `CLAUDE.md`, `README.md` — without bumping the plugin version and adding a CHANGELOG entry. In practice that enforcement does nothing for any plugin nested under `apps/claude-code/`. Every recent `unic-pr-review` PR has changed `commands/review-pr.md` without a version bump and passed the check clean, because the version-bump gate is silently skipped. The guardrail I think I have does not exist.

## Solution

`verify:changelog` should enforce the version-bump-and-changelog rule for nested plugins exactly as it claims to. When a guarded file inside a plugin changes between the diff base and HEAD, the check must require that the plugin's `plugin.json` version differ from the base version and that the CHANGELOG carry a real entry for the new version. The structural checks (Layer 1) already work and must keep working; only the diff-based gate (Layer 2) is broken.

## Root cause (discovered this session)

`verify-changelog.mjs` runs with `root = process.cwd()`, which under `pnpm --filter <plugin>` is the plugin directory. Layer 2 lists changed files with `git diff --name-only <base>...HEAD`. Git emits those paths **relative to the repository root** (e.g. `apps/claude-code/unic-pr-review/commands/review-pr.md`), but the `GUARDED` patterns are anchored to **plugin-relative** paths (`/^commands\/.+\.md$/`, `/^scripts\/.+\.mjs$/`, `/^\.claude-plugin\/plugin\.json$/`, etc.). The repo-root-relative paths never match, so `triggered` is always `false`, the gate short-circuits with "no guarded paths changed", and no bump is ever required. A plugin living at the repo root would match; every nested plugin silently does not.

The existing `verify-changelog.test.mjs` did not catch this because its fake-git shim is fed **already-relative** paths (`commands/...`), exercising the path shape the regexes expect rather than the repo-root-relative shape real git produces from a plugin cwd.

## User Stories

1. As a maintainer, I want `verify:changelog` to fail when a nested plugin's guarded file changes without a version bump, so that the rule documented in the root AGENTS.md is actually enforced.
2. As a maintainer, I want the same enforcement whether the check runs locally via `pnpm --filter <plugin> verify:changelog` or in CI, so that local and CI behaviour agree.
3. As a maintainer, I want guarded-path detection to work identically for a plugin at the repo root and a plugin nested under `apps/claude-code/`, so that directory depth never changes the guarantee.
4. As a maintainer, I want a changed file outside the current plugin (e.g. another plugin's file appearing in a wide diff) to NOT trigger this plugin's bump gate, so that cross-plugin noise does not force spurious bumps.
5. As a maintainer, I want the Layer-1 structural checks (Unreleased section, required subsections, dated release headers) to keep passing unchanged, so that the fix does not regress existing behaviour.
6. As a maintainer, I want a documentation/markdown-only change to a guarded file (like the #161 doc fix) to still require a CHANGELOG bullet under the bumped version, so that user-facing doc corrections are recorded.
7. As a maintainer, I want the gate to require both a version difference AND a real (non-"(none)") CHANGELOG bullet for the new version, so that a bump without notes — or notes without a bump — is rejected.
8. As an AFK agent working in a plugin, I want a clear failure message telling me to run `pnpm bump <level>` when I forget, so that I can self-correct without human intervention.
9. As a maintainer, I want the decision logic extracted into a pure, injectable module, so that guarded-path matching can be unit-tested without spawning git or a real repository.
10. As a maintainer, I want a regression test that reproduces the original bug (repo-root-relative paths from a plugin cwd), so that this class of mismatch cannot silently return.
11. As a contributor, I want the check to remain cross-platform (macOS, Windows, Linux), so that path separators and git invocation differences do not break enforcement.
12. As a maintainer, I want the fix to leave the CI diff-base resolution (GITHUB_BASE_REF, `@{upstream}`, `HEAD~1` fallback) untouched, so that the only behavioural change is correct path matching.

## Implementation Decisions

- **Two modules.** Extract a new pure deep module `scripts/lib/changelog-gate.mjs`; keep `scripts/verify-changelog.mjs` as the thin I/O wrapper.
- **`changelog-gate.mjs` (new, deep module).** Exposes pure functions with no `process.exit`, no console writes, no filesystem or git access — they take data and return a verdict. Proposed surface:
  - `isBumpRequired(changedFiles, guardedPatterns) => boolean` — true when any changed path matches a guarded pattern. Inputs are plugin-relative paths.
  - A verdict function (e.g. `evaluateBumpGate({ changedFiles, guardedPatterns, headVersion, baseVersion, changelog }) => { ok: boolean, code, message }`) returning a structured result the wrapper renders. This mirrors `base-branch-resolver.mjs`, which returns a value and lets the CLI entrypoint own I/O and exit codes.
  - `GUARDED` patterns move into this module as the single source of truth.
- **The fix.** Ensure the changed-file list handed to the gate is plugin-relative. Add `--relative` to the `git diff --name-only` invocation so git strips the cwd prefix and only reports files within the plugin directory. This both fixes the prefix mismatch (story 3) and naturally excludes other plugins' files from this plugin's gate (story 4). If `--relative` proves insufficient cross-platform, the fallback is to compute the plugin's path prefix relative to the repo root and strip it before matching — but `--relative` is the preferred single-lever fix.
- **Wrapper responsibilities.** `verify-changelog.mjs` keeps: reading CHANGELOG.md and plugin.json, resolving the diff base (CI `GITHUB_BASE_REF` vs local `@{upstream}` vs `HEAD~1`), invoking git through the existing `gitCmd` helper (honouring the `_GIT_BIN` test shim), calling the pure gate, and translating the verdict into stdout/stderr + exit code. No change to diff-base resolution.
- **Layer 1 untouched.** Structural checks stay exactly as they are.
- **Failure message preserved.** Keep the existing actionable wording ("version in plugin.json was not bumped … Run: pnpm bump <patch|minor|major>") so agents and humans get the same guidance.
- **Scope of enforcement unchanged.** The set of guarded paths and the "version differs AND real changelog bullet exists" rule are not being redefined — only made to actually fire for nested plugins.

## Testing Decisions

- **What makes a good test here:** assert external behaviour — given a set of changed files (in the shape git really produces) and a version/CHANGELOG state, does the check pass or fail with the right exit code and message? Do not assert on internal regex objects or private helpers beyond the documented module surface.
- **`changelog-gate.mjs` — unit tests (pure, no git):**
  - guarded plugin-relative path → bump required; unguarded path (e.g. `tests/foo.test.mjs`, `docs/adr/0001.md`) → not required.
  - each guarded category represented (command `.md`, script `.mjs`, `plugin.json`, `marketplace.json`, `CLAUDE.md`, `README.md`).
  - verdict logic: version unchanged + guarded change → fail; version bumped but no real changelog bullet → fail; bumped + real bullet → ok.
  - empty changed-file list → not triggered.
- **`verify-changelog` — end-to-end regression:** extend the existing fake-git harness so the shim emits **repo-root-relative** paths (`apps/claude-code/<plugin>/commands/review-pr.md`) while the script runs from a plugin cwd, and assert the bump gate now fires (exit 1, bump message). This is the test that would have caught the original bug; before the fix it must fail, after it must pass. Add the symmetric case: a guarded change WITH a proper bump + changelog bullet exits 0.
- **Prior art:** `packages/release-tools/scripts/verify-changelog.test.mjs` (existing fake-git `_GIT_BIN` shim, temp CHANGELOG swap) for the end-to-end shape; `apps/claude-code/unic-pr-review/tests/base-branch-resolver.test.mjs` for the injectable-pure-function unit-test pattern.

## Out of Scope

- Issue #161 itself (the `--base` doc fix) — already resolved this session; this PRD is the underlying enforcement bug.
- Redefining which paths are guarded or what counts as a valid CHANGELOG entry.
- Changing the bump command, tag scheme, or release workflow.
- The Layer-1 structural checks.
- Back-bumping versions for plugins that merged guarded changes while the gate was broken — a separate maintenance decision, not part of fixing the gate.
- Any change to `apps/claude-code/pr-review/` (v1, deprecated and hook-protected).

## Further Notes

- This was discovered while resolving #161: a "doc-only" change to `unic-pr-review/commands/review-pr.md` passed `verify:changelog` with no bump, which is correct per current (broken) behaviour but wrong per intent.
- Once fixed, expect the next guarded change in any nested plugin to start requiring a bump — communicate this so it is not mistaken for a new regression.
- Keep the cross-platform requirement front of mind: git path output and `--relative` behaviour are consistent across platforms, but the test harness must continue to avoid real shell/git assumptions (the `_GIT_BIN` Node shim pattern already handles this).
