# 07. Version bump, README, CLAUDE.md

**Status: pending**

- Priority: P1
- Effort: S
- Version impact: minor (cumulative roll-up)
- Depends on: 06
- Touches: `.claude-plugin/plugin.json`, `marketplace.json`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`, monorepo `.prettierignore`

## Context

Specs 00–06 ship behaviour; this spec finalises metadata, versioning, and documentation so the release is coherent. Spec 08 ships the test harness in the same release.

## Implementation steps

1. **Add CHANGELOG entries first.** Before running the bump script, add bullets under `## [Unreleased]` in `CHANGELOG.md` (it already exists). Add entries under the appropriate subsections (`### Added`, `### Fixed`, `### Breaking`). The bump script fails verification if the versioned section contains only `(none)` placeholders.

2. **Bump the version.** Run `pnpm --filter pr-review bump minor` (target: `0.X.0 → 0.(X+1).0`). This script updates both `.claude-plugin/plugin.json` and `marketplace.json` atomically. **Never hand-edit `marketplace.json`.**

3. **Check `.prettierignore`.** At the monorepo root, verify `**/CHANGELOG.md` is present in `.prettierignore`. Add it if absent. Prettier must not reformat CHANGELOG files — the em-dash date suffix (`— YYYY-MM-DD`) enforced by `verify:changelog` is fragile under Prettier's Markdown reflow.

4. **Update `CLAUDE.md`.** Remove the roadmap line: *"Re-review: detect existing Claude Code threads and update instead of duplicating."* The rules about signature format and iteration targeting (added by specs 00 and 02) should already be present.

5. **Add a "Re-review" section to `README.md`:**
   - Trigger: re-running `/unic-pr-review:review-pr` on a PR that already has Claude Code threads.
   - What changes: detection, thread reuse, delta summary reply, completion marker.
   - New signature format: `🤖 *Reviewed by Claude Code* — Iteration N`.
   - Limitations: force-push fallback to full diff; partial-run recovery via missing completion marker.

6. **Supersede ADR 0007.** ADR 0007 states the summary comment is "rewritten" on re-review. The implemented behaviour (spec 06) posts a reply to the existing summary thread instead of editing it. Create `docs/adr/0009-summary-delta-as-reply.md` with status Accepted, context referencing ADR 0007, and the decision to reply rather than rewrite.

## CHANGELOG format (enforced by `verify:changelog`)

```markdown
## [Unreleased]

### Breaking
- (none)

### Added
- Re-review: detect prior Claude Code threads and reply instead of duplicating
- …

### Fixed
- (none)
```

Versioned sections use an em-dash: `## [0.2.0] — YYYY-MM-DD`.

## Test cases

- `cat .claude-plugin/plugin.json | jq -r .version` → bumped minor version.
- `pnpm --filter pr-review verify:changelog` → passes.
- `grep -n 'Re-review' CLAUDE.md` → roadmap line gone; rule lines (signature, iteration) present.
- `README.md` includes the new Re-review section.
- `docs/adr/0009-summary-delta-as-reply.md` exists and references ADR 0007.
- Monorepo `.prettierignore` contains `**/CHANGELOG.md`.

## Acceptance criteria

- All files updated in a single commit.
- Versions match across `plugin.json` and `marketplace.json` (guaranteed by bump script).
- CI `verify:changelog` passes on the PR.

## Verification

- Run `pnpm --filter pr-review verify:changelog` locally before opening the PR.
- Open the plugin in Claude Code — `/help` shows the new version.

## Out of scope

- Marketplace publishing (separate manual step).

## Follow-ups

— none —
