# Version bump and CHANGELOG

**Status:** needs-triage
**Category:** enhancement

## Parent

`docs/issues/pr-review-orchestrator-split/PRD.md`

## What to build

Bump the `pr-review` plugin version (minor bump — new features added) and add a dated CHANGELOG entry covering the orchestrator split, the three new agents, pre-PR mode, and compact sub-agent output.

Run `pnpm --filter pr-review bump minor` to update both `plugin.json` and `marketplace.json`. Add a `[Unreleased]` → versioned entry to `CHANGELOG.md` following the existing format. Run `pnpm --filter pr-review verify:changelog` to confirm the entry passes validation.

## Acceptance criteria

- [ ] `plugin.json` and `marketplace.json` both reflect the new minor version
- [ ] `CHANGELOG.md` has a dated entry for the new version describing the orchestrator split, three new agents, pre-PR mode, and compact output guidance
- [ ] `pnpm --filter pr-review verify:changelog` passes
- [ ] `pnpm format` produces no diff

## Blocked by

- `docs/issues/pr-review-orchestrator-split/05-add-pre-pr-mode.md`
- `docs/issues/pr-review-orchestrator-split/06-compact-subagent-output.md`
