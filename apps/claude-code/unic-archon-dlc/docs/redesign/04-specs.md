# Step 04 — `/specs` (grill → PRD)

> **⚠ Two-axis update (2026-07-02):** `/specs` is a **command/skill** that **branches on input** (ADR-0020): raw idea → converse (Matt grill-with-docs + to-prd); existing spec/Figma/UX → ingest + synthesise (+ estimate) → review (#257); partial → ingest + grill gaps. One PRD approval gate. Composes team system-skills to read the source. **[PLAN.md](./PLAN.md) + ADRs 0016–0020 win** where the body below differs.

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** First main-line box. Carved out of the existing `plan` workflow (first half).

## Goal

A `unic-dlc-specs` workflow that turns an idea (optionally seeded by `/explore` findings) into an approved PRD. Maps to Matt's `grill-with-docs` + `to-prd`.

## Task

- Reuse the existing `plan` nodes for this half: `load-context → specs (adversarial grill) → to-prd → prd-gate`. Drop everything from `to-issues` onward (that becomes step 05 / `/tickets`).
- **Grilling fidelity (Matt):** the `specs` node interviews **one question at a time, each with a recommended answer**; challenges assumptions; writes ADRs live when a real decision crystallises (`/domain-modeling`).
- **Add Matt's seam-design approval** (`to-prd`): before writing the PRD, propose the testing seams ("the fewer seams the better — ideally one") and get explicit user confirmation.
- PRD written via `lib/prd-writer.mjs` (7-section validator) into **`workflows/<slug>/PRD.md`** (contract C — new path).
- `prd-gate` = HITL by default (contract A), expressed in the confirmed Archon schema (step 00 — likely an `approval:` node). On reject → return to `specs`.

## Open questions to grill first

- Keep the `discuss_mode` (`interview` vs `assumptions`) option, or standardise on Matt's one-at-a-time interview?
- Where exactly does seam approval sit — inside `specs`, or a node before `to-prd`?

## Done when

`/specs <slug>` produces a validated `workflows/<slug>/PRD.md` + any live ADRs, gated by a human PR (or AFK if configured), on the target schema. PR to `develop`.

## Suggested skills

`/archon`, `/grilling`, `/domain-modeling`. Reference `.agents/skills/{grill-with-docs,to-prd}/SKILL.md`.
