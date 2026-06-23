# Step 07 — `/triage` (intake on-ramp, NEW meaning)

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** The old `triage` workflow (state snapshot) was dropped in step 01. This is the brand-new Matt-style intake.

## Goal

A `unic-dlc-triage` workflow that turns RAW incoming work (bug reports, feature requests, QA findings) into **agent-ready issues** — an on-ramp into the tickets backlog (PLAN decisions #4/#5).

## Task

- Port Matt's `triage` skill (`.agents/skills/triage/SKILL.md`): gather context → recommend category + state (HITL gate) → verify the claim (reproduce bug / check PR) → grill if needed (`/grilling` + `/domain-modeling`) → apply outcome.
- Outcomes: `ready-for-agent` (post agent brief, the intent baton), `ready-for-human`, `needs-info`, or rejected → `.out-of-scope/*.md`.
- Publish via `lib/tracker-adapter.mjs`; reuse the plugin's existing label taxonomy (`lib/labels-config.mjs`). Issues produced here are consumed by `/build` exactly like `/tickets` output.
- Classification gate = HITL by default (`gates.triage`).

## Open questions to grill first

- Reuse the plugin's existing state/type labels vs Matt's vocabulary — reconcile (the repo has an 8-state taxonomy; Matt has a smaller set).
- Verification depth for the autonomous case (no human watching).

## Done when

`/triage` moves a raw item to an agent-ready issue with a brief (intent on tracker), or rejects it durably. Runs on the target schema. PR to `develop`.

## Suggested skills

`/archon`, `/grilling`, `/domain-modeling`. Reference `.agents/skills/triage/SKILL.md`.
