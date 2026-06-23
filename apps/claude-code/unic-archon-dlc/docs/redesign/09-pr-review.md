# Step 09 — `/pr-review` (rename of `review`)

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).**

## Goal

Rename `unic-dlc-review` → `/pr-review` and keep its self-contained 4-aspect review (code quality, test-coverage adequacy, silent-failure patterns, type-design quality), posting/updating a single comment on the current PR via `lib/tracker-adapter.mjs`.

## Task

- Rename workflow + command stub; update references (CONTEXT.md, AGENTS.md, marketplace listing if any).
- Confirm it runs on the target schema (it's a single prompt node — minimal).
- Posting is AFK-safe; the human checkpoint is the merge gate (in `/qa`), not here.

## Open questions to grill first

- **Relationship to the separate `unic-pr-review` plugin** in this monorepo — avoid duplicated maintenance. Decide: does `/pr-review` delegate to / share criteria with that plugin, or stay deliberately self-contained (its current doctrine)? Record the decision.

## Done when

`/pr-review` posts/updates one structured comment on the current PR, renamed cleanly, on the target schema, with the relationship to `unic-pr-review` decided + documented. PR to `develop`.

## Suggested skills

`/archon`, `/grilling`. Reference the existing `unic-dlc-review.yaml` and the `unic-pr-review` plugin.
