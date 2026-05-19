# Fix interactive loop nodes: add fresh_context to prevent session expiry crashes

**Status:** ready-for-agent
**Category:** bug

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

All interactive loop nodes in the six workflows (`explore.yaml`, `plan.yaml`, `cleanup.yaml`) crash on iteration 2+ when a human responds to a gate. The root cause is a known Archon bug (coleam00/Archon#1208): the DAG executor tries to resume an expired Claude SDK session from the previous iteration instead of starting a fresh one. The fix is to add `fresh_context: true` to every node that is both `interactive: true` and uses a `loop:` block, so each iteration gets a clean session.

Affected nodes across the six workflows:

- `explore.yaml` → `code-preserve-gate`
- `plan.yaml` → `specs` (grill loop), `prd-gate`, `plan-gate`, `stall-gate`
- `cleanup.yaml` → `adr-consolidation`
- `qa.yaml` → `uat-gate`

No lib modules, tests, or install hook are touched — this is a YAML-only patch.

## Acceptance criteria

- [ ] Every `interactive: true` loop node in all six workflow YAMLs has `fresh_context: true` set.
- [ ] No non-interactive loop node (e.g. `plan-checker`) receives `fresh_context: true` — only interactive gates get it.
- [ ] `pnpm check` passes at repo root after the change.

## Blocked by

None — can start immediately.
