# Step 00 — Pre-work: Archon schema & version reconciliation

> **✓ Done (schema recorded in ADR-0011).** Still valid and it gates the Archon boxes. See [PLAN.md](./PLAN.md).

> **Read [PLAN.md](./PLAN.md) and [README.md](./README.md) first.** This step GATES every other step. Mostly research; the only edits are to PLAN.md and one ADR.

## Why

The shipped workflows in `.archon/workflows/*.yaml` use `type: prompt|loop|interactive|bash` + `fresh_context:`. The live `archon` CLI (the `/archon` skill reported v0.3.12→v0.4.1, docs at archon.diy) documents a _different_ node schema: node keys `command/prompt/bash/script/loop/approval/cancel` (exactly one per node), `interactive: true` at the **workflow** level, dedicated `approval:` nodes with `on_reject`, and `loop:` as a node key with `until:`. The plugin's `AGENTS.md` claims "Archon ≥ 0.10" — versioning that doesn't match the CLI. We must know the truth before refactoring 11 workflows against the wrong schema.

## Task

1. Determine the **Archon version actually targeted/installed** (`archon version`; check `.archon/` config; check the plugin's `external dependencies` note).
2. Establish the **authoritative node schema** for that version. Use the `/archon` skill's `references/workflow-dag.md`; fetch archon.diy pages if needed. Confirm: how are approval/HITL gates expressed? how is a loop expressed? how is fresh context per node expressed? how does a node read another node's output / workflow inputs?
3. **Run one shipped workflow read-only** to see whether the current `type:`-style YAML even parses/runs on the installed CLI (e.g. dry-run `unic-dlc-explore`, or `archon workflow list --json` + a validate). Record the result.
4. Decide the **target schema** for the redesign and write a translation table: today's `type: interactive, fresh_context: true` gate → its v0.4 equivalent (`approval:` node? workflow-level `interactive: true`?); `type: loop` → `loop:` node; etc.

## Deliverables

- **Edit PLAN.md**: replace the speculative wording in "Open risks / pre-work #1" with the confirmed version + schema + translation table.
- **Add ADR** `apps/claude-code/unic-archon-dlc/docs/adr/NNNN-archon-schema-target.md`: the targeted Archon version and node-schema conventions all workflows must follow. (Check next NNNN in that dir.)
- If the installed CLI cannot run the current `type:` schema, flag it as a **blocking migration** and note scope in PLAN.md.

## Done when

PLAN.md states the confirmed Archon version + schema + translation table, the ADR is written, and you can answer: "in this schema, how do I write a HITL gate, a loop, a fresh-context node, and pass data between nodes?"

## Suggested skills

`/archon` (read its `references/workflow-dag.md` + `parameter-matrix.md`), `/domain-modeling` (for the ADR).
