# Version bump, README, CLAUDE.md, ADR 0009

**Status:** ready-for-human
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Finalise metadata, documentation, and release artefacts for the re-review feature. This is a HITL issue: the bump script and release PR require human review before merging.

**Steps (in order):**

1. **Add CHANGELOG entries.** Under `## [Unreleased]` in `CHANGELOG.md`, add bullets under `### Added` describing the re-review feature. Do this before running the bump script — the bump will fail verification if the versioned section only has `(none)` placeholders.

2. **Check `.prettierignore`.** At the monorepo root, verify `**/CHANGELOG.md` is present. Add it if absent. Prettier must not reformat CHANGELOG files.

3. **Bump the version.** Run `pnpm --filter pr-review bump minor`. This updates both `.claude-plugin/plugin.json` and `marketplace.json` atomically. Never hand-edit `marketplace.json`.

4. **Update `CLAUDE.md`.** Remove the roadmap line about re-review. Verify that the signature-prefix and latest-iteration rules added by earlier issues are present.

5. **Add Re-review section to `README.md`** covering: trigger condition, what changes (detection, thread reuse, delta summary reply, completion marker), new signature format, and known limitations (force-push fallback, partial-run recovery).

6. **Create `docs/adr/0009-summary-delta-as-reply.md`.** Status: Accepted. Context: ADR 0007 specified that the summary comment is rewritten in place on re-review. Decision: the implemented behaviour posts a reply to the existing summary thread instead, keeping the edit timestamp on the original comment and maintaining a linear thread history. Consequences: the summary thread accumulates replies over iterations; the first comment body is never modified after posting.

7. **Verify.** Run `pnpm --filter pr-review verify:changelog` locally before opening the PR.

## Acceptance criteria

- [ ] `pnpm --filter pr-review verify:changelog` passes locally
- [ ] Versions match across `plugin.json` and `marketplace.json`
- [ ] `README.md` includes a Re-review section
- [ ] Roadmap line removed from `CLAUDE.md`; signature and iteration rules present
- [ ] `docs/adr/0009-summary-delta-as-reply.md` exists, references ADR 0007, status Accepted
- [ ] Monorepo `.prettierignore` contains `**/CHANGELOG.md`
- [ ] CI passes on the release PR

## Blocked by

- `docs/issues/pr-review-rereview/07-summary-comment-policy.md`
- `docs/issues/pr-review-rereview/08-test-fixture-suite.md`
