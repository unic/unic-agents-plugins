# 0020. `/specs` reaches an aligned PRD by branch-on-input

**Status:** Accepted (2026-07-02)

## Context

Two spec-building philosophies were in tension for `/specs`:

- **Matt Pocock** (`grill-with-docs` + `to-prd`) — a _shared conversation_ co-builds understanding; alignment happens _during_ creation; needs the human present; doesn't run AFK.
- **Pesche `unic-ticket-specification`** (PR #257) — _autonomous_ draft (+ estimations); the human then _reads every ticket and decides_ if it is what they want; alignment happens _at review_; scales/AFK; risk of rubber-stamping a plausible-but-wrong spec.

They looked opposed, but they are the **same job on different inputs**. Unic features arrive with heterogeneous starting material: sometimes just a raw idea; sometimes an existing spec in the team's docs system; sometimes UX specs and Figma links (design isn't always involved).

## Decision

`/specs` is an in-session **command/skill** ([ADR-0017](0017-container-follows-structural-need.md)) whose job is to **reach one human-approved PRD by the cheapest path given what already exists**:

```
raw idea, no source          → converse (Matt: grill-with-docs → to-prd)  — build understanding
existing spec / Figma / UX    → ingest + synthesise (+ estimate) → human REVIEWS   (#257 model)
partial (some docs, gaps)     → ingest what exists, then grill only the GAPS
```

Invariants regardless of path:

- Ends at **one PRD approval gate** before `/tickets` (HITL by default).
- **Composes team system-skills** to read whatever source exists (Confluence/Jira/ADO/GitHub/Figma via MCP-first/CLI-fallback) — `/specs` owns the _what_, not the _how_ ([ADR-0016](0016-dlc-thin-process-layer.md)).
- The conversational path composes Matt's `grill-with-docs` + `to-prd`; the ingest path composes a source-reading system-skill + synthesis, reusing `to-prd`'s PRD _shaping_ but not `grill-with-docs`.
- Keeps Matt's **seam-design approval** ("fewest seams, ideally one") before the PRD is written.
- **Estimations** are config-optional (from the #257 ingest path).
- The PRD is written to `workflows/<slug>/PRD.md` ([ADR-0015](0015-workflows-slug-artifact-home.md)) and, when `docs.type` is set, published to the team's docs system via the composed skill.

## Consequences

- `/specs` has two code paths (converse / ingest) plus a hybrid; the old `plan.discuss_mode` flag is subsumed by input detection.
- Input detection depends on the team's system-skills being registered at `/setup` time ([ADR-0019](0019-conversational-setup.md)).
- PRD template content comes from config ([ADR-0018](0018-generic-core-config-compose.md)); a generic validator enforces structure.
- Detailed mechanics (Figma ingestion, estimation model, gap-detection, docs-system publishing) are owned by the `/specs` redesign step.
