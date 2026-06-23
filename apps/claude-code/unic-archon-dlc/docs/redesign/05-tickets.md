# Step 05 — `/tickets` (slice PRD → issues)

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** Second half carved out of `plan`. Feeds `/build`. **Upstream guarantor of contract B.**

## Goal
A `unic-dlc-tickets` workflow that decomposes an approved PRD into independently-grabbable **vertical tracer-bullet slices**, maps tests, validates, and generates the build DAG. Maps to Matt's `to-issues`.

## Task
- Reuse the existing `plan` nodes for this half: `to-issues → nyquist-map → plan-checker → yaml-gen → plan-pr-gate`.
- **Slicing fidelity (Matt + contract B):** each slice is a thin vertical slice through ALL layers, demoable on its own, in dependency order (`blocked_by` DAG). Present for approval; iterate until the user confirms granularity + deps. Slices must be thin enough that one slice = one demoable behavior (so strict red/green is safe).
- Publish issues via `lib/tracker-adapter.mjs`; **intent (acceptance_criteria) lives on the tracker issue** (contract C). Write `workflows/<slug>/issues.json`.
- **`yaml-gen` / `lib/dag-builder.mjs` is the critical change:** emit `code-red-<id>`/`code-green-<id>` nodes that (a) set `fresh_context: true` and (b) inject the issue's `acceptance_criteria` into BOTH node prompts (contract B). Generated file = `.archon/workflows/build-<slug>.yaml` in the confirmed schema.
- `plan-pr-gate` = HITL by default.

## Open questions to grill first
- Slice-granularity heuristic — what makes a slice "thin enough"? (consumes the guidance from step 03.)
- Refactor-node placement decision (carry to step 06): tail of green vs separate node — does `dag-builder` emit a refactor node?
- Keep `plan-checker` stall-detection + `nyquist-map` as-is?

## Done when
`/tickets <slug>` publishes vertical-slice issues (intent on tracker), writes `issues.json`, and generates a `build-<slug>.yaml` whose red/green nodes are fresh-context + intent-injected. PR to `develop`.

## Suggested skills
`/archon`, `/grilling`, `/domain-modeling`, `/tdd` (dag-builder is pure — test-first). Reference `.agents/skills/to-issues/SKILL.md`.
