# Context — spec-08: Version bump, README, CLAUDE.md

## Source

Spec file: `docs/plans/08-version-bump-and-docs.md`

## Summary

Finalises metadata, versioning, and documentation for the re-review feature (specs 01–07 are done). No logic changes — documentation and version only.

## Current state

- Current version: `0.7.0` (in `.claude-plugin/plugin.json` and `marketplace.json`)
- CHANGELOG.md has `## [Unreleased]` with empty placeholders (`(none)` under each subsection)
- CLAUDE.md line 37 still says old signature: `---\n🤖 *Reviewed by Claude Code*` (without `— Iteration N`)
- CLAUDE.md Roadmap section still has: `Re-review: detect existing Claude Code threads and update instead of duplicating`
- README.md has a Roadmap section listing Re-review as future work
- `.prettierignore` already has `**/CHANGELOG.md` — pre-flight guard passes

## Target version

`0.8.0` (minor bump from 0.7.0)

## Files to touch

1. `CHANGELOG.md` — add re-review feature entries under `## [Unreleased]`
2. `.claude-plugin/plugin.json` — bumped by script
3. `.claude-plugin/marketplace.json` — bumped by script (never hand-edit)
4. `CLAUDE.md` — update signature rule + remove roadmap line
5. `README.md` — add Re-review section, update comment format, update Roadmap

## Constraints

- Use `pnpm bump minor` (NOT `pnpm --filter pr-review bump minor` — run from plugin dir or use filter)
- Never hand-edit `marketplace.json`
- The bump script promotes `[Unreleased]` → dated section; CHANGELOG entries must be in `[Unreleased]` before running the bump

## Re-review feature summary (for docs)

Specs 01–07 deliver:

- Normalize signature with `— Iteration N` suffix (01)
- Detect prior review threads (02)
- Target latest PR iteration (03)
- Incremental diff between commits (04)
- Classify prior threads as `addressed`/`disputed`/`pending`/`obsolete` (05)
- Reply to existing threads instead of duplicating (06)
- Delta summary reply (counts + new findings) on re-review; skip if nothing changed (07)

## New signature format

`---\n🤖 *Reviewed by Claude Code* — Iteration N`

## Acceptance criteria

- `cat .claude-plugin/plugin.json | jq -r .version` → `0.8.0`
- `pnpm --filter pr-review verify:changelog` → passes
- `grep -n 'Re-review' CLAUDE.md` → roadmap line gone; rule lines (signature, iteration) present
- `README.md` includes a Re-review section
- `grep -F '**/CHANGELOG.md' .prettierignore` → returns a match
- All changes in a single commit: `feat(spec-08): version bump, README, CLAUDE.md (v0.8.0)`
