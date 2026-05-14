# Plan workflow — to-issues, nyquist-map, and validation gate

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

Decomposes the approved PRD into vertically-sliced issues with explicit dependencies and a test command for each issue, then asks the user to validate the breakdown before publication.

In scope:

- **`to-issues` node** extending `plan.yaml`:
  - Reads `docs/workflow/<slug>/PRD.md` and emits `docs/workflow/<slug>/issues.json` with a list of issues; each issue carries `title`, `type` (canonical type label), `priority` (canonical priority label), `blocked_by: []` (array of issue IDs in this same file), `acceptance_criteria: []`, and `summary`.
  - Slices are vertical tracer bullets — each slice cuts through every integration layer end-to-end, not horizontally by layer.
  - Before writing the issues to the tracker, presents the breakdown to the user (numbered list with type/priority/blocked-by/summary) and asks the user to validate, split, merge, or relabel. Iterates until approved.
  - After approval, publishes each issue to the configured tracker via the tracker adapter, in dependency order so blocker IDs are real.
- **`nyquist-map` node:** for each issue, attaches a `test_command` field (the exact shell command that proves the issue's acceptance criteria). For issues whose test command does not yet exist, attaches a `test_command_planned` flag so `plan-checker` (slice 08) can flag them.
- This slice publishes the issues to the tracker so the user can see them — but does **not** generate the build YAML (slice 08) and does **not** invoke the `plan-checker` loop (slice 08). It is acceptable for a user to stop here.

Out of scope: `plan-checker` loop, `yaml-gen`, second PR gate (all in slice 08).

## Acceptance criteria

- [ ] `to-issues` reads PRD.md and writes `issues.json` whose structure matches the field set above.
- [ ] Issues are vertical slices — each entry's acceptance criteria can be demonstrated independently (verified by a representative example in tests).
- [ ] Validation gate is interactive and supports split/merge/relabel before publication.
- [ ] After approval, each issue exists in the configured tracker with correct type and priority labels (verified for the local-markdown backend at minimum).
- [ ] `nyquist-map` attaches a `test_command` (or `test_command_planned: true`) to every issue.
- [ ] Tracker publication is dependency-ordered: every `blocked_by` reference points to an issue that already exists in the tracker.

## Blocked by

- `docs/issues/unic-archon-dlc/06-plan-specs-and-to-prd.md`
