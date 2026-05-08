# Version bump + CHANGELOG

**Status:** needs-triage
**Category:** enhancement
**Type:** AFK

## Parent

`docs/issues/pr-review-suppress-addressed-reply/PRD.md`

## What to build

Bump the `pr-review` plugin version by a patch increment and add a dated CHANGELOG entry describing the removal of the cosmetic "thanks" Reply on addressed threads.

The version must be updated in both `plugin.json` and `marketplace.json`. Use the existing `bump` release-tools command rather than hand-editing.

## Acceptance criteria

- [ ] `plugin.json` version is incremented by one patch.
- [ ] `marketplace.json` version matches `plugin.json`.
- [ ] `CHANGELOG.md` has a new dated entry under the new version describing the change (addressed threads are now silently resolved — no Reply comment is posted).

## Blocked by

`docs/issues/pr-review-suppress-addressed-reply/01-remove-addressed-reply.md`
