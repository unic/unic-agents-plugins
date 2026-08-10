# 0011. Archon version target and node-schema conventions

**Status:** Accepted (2026-06-23; version facts refreshed 2026-06-30 for the 0.3.12 → 0.5.0 bump, and again 2026-08-10 for the 0.5.0 → 0.7.0 bump ([ADR-0033](0033-archon-070-schema-target.md)) — schema conventions unchanged)

## Context

The redesign of this plugin's workflows ([`docs/redesign/PLAN.md`](../redesign/PLAN.md)) assumed it could refactor the seven shipped `.archon/workflows/*.yaml` files in place. A pre-work investigation found two problems that gate the entire redesign:

### Version claim was fictional

`AGENTS.md` declared the external dependency as **"Archon ≥ 0.10"**. No such version line exists. Archon is on a fast-moving 0.x line — during this pre-work alone the installed CLI moved **v0.3.12 → v0.5.0 within a week** (both via the homebrew tap; `brew list --versions archon` → `0.5.0`). The takeaway is not a specific number but that **the version floor is a moving target and the stable contract is the node schema, not the release number** — so this ADR pins the floor to "the current installed release, verified behaviourally" rather than hard-coding a narrow version.

### Shipped workflows use a schema the CLI does not honour — silently

The shipped YAMLs use a `type:` discriminator (`type: prompt|loop|interactive|bash`) plus node-level `fresh_context:`, a top-level `inputs:` block, and `{{ inputs.slug }}` / `{{ workflow.x | default(…) }}` Jinja templating.

The actual Archon node schema (documented in the `/archon` skill's `references/workflow-dag.md`; verified unchanged across 0.3.12, 0.4.x, and 0.5.0) is **key-discriminated**: a node's type is decided by _which_ of `command | prompt | bash | script | loop | approval | cancel` it carries (exactly one), and unknown fields are ignored. Variable substitution is `$`-style (`$ARGUMENTS`, `$nodeId.output`, `$ARTIFACTS_DIR`), not Jinja.

Crucially, **`archon validate workflows <name>` passes "ok" on all seven shipped workflows** (re-confirmed on v0.5.0) — because every node happens to carry a recognised content key (`prompt:`, `script:`, …) and the stray `type:` field is simply ignored. Validation success masks a set of silent semantic failures:

| Shipped form                                            | Dispatched on v0.5.0 as | Defect                                                     |
| ------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| `type: prompt` + `prompt:`                              | prompt node             | works by accident                                          |
| `type: bash` + `runtime: bun` + `script:`               | script node             | works (mislabeled — a real bash node uses `bash:`)         |
| `type: interactive` + `fresh_context: true` + `prompt:` | plain prompt node       | 🔴 HITL gate never pauses                                  |
| `type: loop` + `prompt:` (no `loop:`/`until:`)          | single-shot prompt node | 🔴 loop never iterates (e.g. plan's adversarial interview) |
| node-level `fresh_context: true`                        | unknown field, ignored  | 🔴 anti-cheat context isolation never applied              |
| `inputs:` block + `{{ inputs.slug }}`                   | literal passthrough     | 🔴 slug never substituted; artifact paths break            |

This is worse than a parse failure: gates, loops, fresh-context isolation, and slug substitution are all inert while the CLI reports success.

## Decision

### Version target

- **Pin the floor at Archon ≥ 0.5.0** — the current installed, brew-shipped, behaviourally-verified release (re-validated 2026-06-30 after the 0.3.12 → 0.5.0 bump).
- **Do not hard-pin a narrow version.** The 0.x line churns fast; the durable contract is the key-discriminated node schema below, which has held across 0.3.12 → 0.5.0. Re-validate behaviourally on each bump (gates pause, loops iterate, slugs substitute) rather than trusting the version number.
- Correct the "≥ 0.10" claim in `AGENTS.md` (and its `CLAUDE.md` symlink) accordingly.

### Node-schema conventions (all workflows MUST follow)

1. **Key-discriminated nodes.** Each node carries exactly one of `command | prompt | bash | script | loop | approval | cancel`. **Never** use a `type:` field — it is silently ignored and produces the failures above.
2. **HITL gate** → a dedicated **`approval:` node** (`message:` required; optional `capture_response`, `on_reject.prompt` + `on_reject.max_attempts`) **plus `interactive: true` at the workflow level** (required for the gate message to reach the user; without it the run dispatches to a background worker). Never `type: interactive`.
3. **Loop** → a **`loop:` node key** with `prompt`, `until`, `max_iterations` (all required) and optional `fresh_context`, `until_bash`, `interactive` + `gate_message`. Never `type: loop` with a sibling `prompt:`.
4. **Fresh-context node** → `context: fresh` on command/prompt nodes; inside a loop use `loop.fresh_context: true`. Never a node-level `fresh_context:` key. (Parallel layers default to fresh; sequential nodes inherit.)
5. **Data flow.** Upstream output: `$nodeId.output`, or `$nodeId.output.field` when the upstream node declares `output_format`. Workflow input: `$ARGUMENTS` / `$USER_MESSAGE`. Artifacts dir: `$ARTIFACTS_DIR`. Base branch: `$BASE_BRANCH`. There is **no `inputs:` block and no `{{ }}` templating** — the **slug must arrive via `$ARGUMENTS` and be parsed** (e.g. in an early script/bash node), not read from `inputs.slug`.
6. **Validate behaviourally, not just structurally.** `archon validate workflows <name>` must pass clean, but because it passes the broken forms above, authors must additionally confirm gates pause, loops iterate, and slugs substitute by running the workflow.

## Consequences

- **All seven shipped workflows require a blocking migration** off the `type:`-style schema before the redesign can build on them. This migration is owned by the per-workflow redesign steps (02 onward), not this pre-work step.
- The `$ARGUMENTS`-based slug change touches every workflow's prompts and the `lib/` path constants that assume `inputs.slug` — this is the same surface as redesign pre-work #3 (`docs/workflow/<slug>/` → `workflows/<slug>/` move, now recorded in [ADR-0015](0015-workflows-slug-artifact-home.md)) and should be sequenced with it.
- The `/setup` runtime version-check (whatever currently asserts `0.10`) must be corrected to assert `≥ 0.5.0`; flagged as follow-up for redesign step 03 (`/setup`), since this step does not touch `lib/`. Given the churn, prefer a behavioural/min-floor check over an exact-version assertion.
- This ADR records the schema conventions that all subsequent redesign steps depend on; the "Archon schema" line in the redesign shared-context is satisfied by this decision.
