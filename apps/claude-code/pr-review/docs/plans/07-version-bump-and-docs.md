# 07. Version bump, README, CLAUDE.md

**Status: pending**

- Priority: P1
- Effort: S
- Version impact: minor (cumulative roll-up)
- Depends on: 06
- Touches: `.claude-plugin/plugin.json`, `marketplace.json`, `README.md`, `CLAUDE.md`

## Context

Specs 00–06 ship behaviour; this spec finalises metadata, versioning, and documentation so the release is coherent.

## Implementation steps

1. Bump `version` in both `.claude-plugin/plugin.json` and `marketplace.json` per cumulative impact (target: minor — `0.X.0 → 0.(X+1).0`). `CLAUDE.md` lines 28–30 already mandate updating both.
2. Remove the roadmap line in `CLAUDE.md` ("Re-review: detect existing Claude Code threads and update instead of duplicating").
3. Add a "Re-review" section to `README.md`:
   - Trigger: re-running `/unic-pr-review:review-pr` against a PR that already has Claude Code threads.
   - What changes: detection, thread reuse, delta summary.
   - Limitations: force-push fallback to full diff; same-bot identity required.
4. Add an entry to `CHANGELOG.md` (create if absent, single section dated today).

## Test cases

- `cat .claude-plugin/plugin.json marketplace.json | jq -r .version` → both equal, both bumped.
- `grep -n 'Re-review' CLAUDE.md` → roadmap line gone, but rule lines (about iteration, signature) present.
- `README.md` includes the new section.

## Acceptance criteria

- All four files updated in a single commit.
- Versions match across `plugin.json` and `marketplace.json`.

## Verification

- Open the plugin in Claude Code (`cc --plugin-dir ~/Sites/UNIC/unic-pr-review`) — `/help` shows the new version.
- Run `/unic-pr-review:review-pr` on a fresh PR (smoke) and on PR 5509 (re-review) — both behave per README.

## Out of scope

- Marketplace publishing (separate manual step).

## Follow-ups

— none —
