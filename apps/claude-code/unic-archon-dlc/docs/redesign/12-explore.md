# Step 12 — `/explore` (off-line, optional)

> **⚠ Two-axis update (2026-07-02):** `/explore` **stays an Archon workflow** (AFK research/spike → `findings.md`); interactive prototyping stays Matt's `/prototype` skill (ADR-0017). Keep it generic + config-driven. **[PLAN.md](./PLAN.md) is canonical.**

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** Off the main line; optional precursor to `/specs`.

## Goal

Refine the existing `explore` workflow into the optional research/prototype/spike on-ramp. It is never required, but its `findings.md` may seed `/specs`.

## Task

- Keep the shape: parallel research (stack/features/architecture/pitfalls) → synthesize → prototype → code-preserve-gate → spike-ticket.
- Move output to **`workflows/<slug>/findings.md`** (contract C).
- Confirm it runs on the target schema; gates honour config.
- Make explicit that it is OFF the main line (PLAN decision #3) — update command doc + CONTEXT.md.

## Open questions to grill first

- Which `findings.md` sections actually feed `/specs`'s `load-context`? Tighten the contract between the two.
- Keep the spike-branch preservation gate, or simplify?
- Is prototyping in-scope here, or should it lean on Matt's `/prototype` skill? (PLAN: research/prototype are IN scope, contra the diagram.)

## Done when

`/explore <slug>` writes `workflows/<slug>/findings.md`, optionally preserves a spike branch, and its handoff into `/specs` is documented. PR to `develop`.

## Suggested skills

`/archon`, `/grilling`. Reference `.agents/skills/prototype/SKILL.md` and the existing `unic-dlc-explore.yaml`.
