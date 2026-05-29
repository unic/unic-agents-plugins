---
title: Intent Check verdicts assessed live against the diff
created: 2026-05-29
---

# PRD: Intent Check verdicts assessed live against the diff

**Status:** ready-for-agent
**Category:** feature
**Scope:** unic-pr-review
**GitHub:** [#160](https://github.com/unic/unic-agents-plugins/issues/160)

---

## Problem Statement

As a Unic reviewer, I paste a Work Item URL and expect the Intent Check block at the top of the Review Summary to tell me, per Acceptance Criterion, whether the diff actually delivers it — `addressed`, `partially addressed`, or `unaddressed`. Today every AC always renders `unaddressed`, regardless of what the diff does. The Intent Checker emits a static `intentCheck` (every verdict hard-coded to `unaddressed` = "not yet assessed"), the orchestrator forwards it verbatim, and nothing ever fills in real verdicts. The block is therefore useless — it contradicts PRD §10, which shows a mix of verdicts.

## Solution

A dedicated **Intent Assessor** agent produces the live verdicts. It runs in the same parallel fan-out batch as the Review Aspect agents, seeded with the Intent Brief, the unassessed AC skeleton, and the diff, and returns the skeleton with verdicts filled in. A pure overlay-merge helper projects those verdicts onto the skeleton (the structural source of truth) before rendering, so the rendered Intent Check block reflects real coverage. AC assessment leaves the Code Reviewer entirely and lives solely in the Assessor, so an unaddressed AC is never reported twice.

A verdict reflects **coverage** — "does the diff contain changes that implement this criterion?" — not correctness. Code quality remains the Findings' concern. The two are orthogonal by design.

## User Stories

1. As a Unic reviewer, I want each Acceptance Criterion in the Intent Check block to show a real verdict (`addressed` / `partially addressed` / `unaddressed`) assessed against my diff, so that I can see intent gaps at a glance instead of a wall of `unaddressed`.
2. As a Unic reviewer, I want `addressed` to mean "the diff contains changes that implement this AC" (coverage), so that a correctly-scoped-but-buggy implementation still reads `addressed` and the bug surfaces separately as a Finding.
3. As a Unic reviewer, I want AC verdicts and code-quality Findings kept separate, so that a single bug is not double-counted as both a Critical Finding and a downgraded verdict.
4. As a Unic reviewer who pastes no Work Item URLs, I want the Intent Check block omitted entirely (no Assessor run), so that empty intent stays a legitimate state with no noise (ADR-0004, US 30).
5. As a Unic reviewer whose brief has no Acceptance Criteria (Confluence-only or Bug-only), I want no Assessor spawned and no Intent Check block, so that the Review is not cluttered with an empty section.
6. As a Unic reviewer, I want the Intent Assessor to run in parallel with the aspect agents, so that live verdicts cost no extra wall-clock time over the current flow.
7. As a Unic reviewer, I want an Acceptance Criterion that the Intent Checker could not fetch to stay `unaddressed` with its explanatory note intact, so that unfetchable intent is never silently marked done.
8. As a Unic reviewer, I want the rendered verdicts to be robust against a malformed Assessor response, so that a hallucinated, dropped, or renamed AC can never corrupt the block — it can only ever colour in verdicts on ACs the Intent Checker already identified.
9. As a Unic reviewer, I want every AC to fall back to `unaddressed` if the Assessor is not spawned, fails, or returns garbage, so that the Review degrades gracefully to today's behaviour rather than crashing or printing partial output.
10. As a maintainer, I want AC assessment owned by a single agent (the Intent Assessor), so that ownership of the Intent Check block is not split across conditionally-spawned aspect agents.
11. As a maintainer, I want the Intent Checker left unchanged (still emitting the Intent Brief plus the unassessed AC skeleton), so that its hard-stop logic never has to load the diff and its single responsibility stays "gather intent."
12. As a maintainer, I want the Intent Assessor explicitly excluded from the Spawn Set, so that nobody "fixes" it into `SPAWN_TABLE` and breaks its intent-presence spawn semantics — documented in the agent file, the changed-file analyser, the orchestrator command, and `CLAUDE.md`.
13. As a maintainer, I want the overlay-merge logic in a pure, unit-tested helper, so that the correctness guarantee lives in deterministic code rather than agent prose.
14. As a maintainer, I want the Code Reviewer to stop assessing ACs, so that there is exactly one place that produces AC verdicts.
15. As a maintainer reviewing this PR, I want the rationale (dedicated agent over Option A / B1, coverage-not-quality, overlay merge, spawn-table exclusion) captured in ADR-0011 and the glossary, so that the design is not surprising to a future reader.
16. As a Unic reviewer, I want the orchestrator step numbering cleaned up to whole integers, so that the command reads as one coherent sequence rather than a chain of bolt-on half-steps.

## Implementation Decisions

**Architecture (ADR-0011)**

- A new **Intent Assessor** agent (`agents/intent-assessor.md`) owns live AC verdicts. Rejected alternatives, recorded in ADR-0011: Option A (Code Reviewer emits verdicts — conditional-spawn hole, cross-agent merge logic, split ownership); Option B1 (Intent Checker assesses in-process — couples the diff into the hard-stop agent, broadens its responsibility).
- The Assessor runs in the **same parallel fan-out batch** as the Review Aspect agents — zero added latency. It is **not** a Review Aspect.
- **`addressed` = coverage, not quality.** The Assessor needs only the diff, never the aspect agents' Findings, so full parallelism is correct. Folding quality in would force serialization, re-introduce cross-agent merge, double-count bugs, and leak through the confidence floor (ADR-0002).

**Data flow**

- The **Intent Checker is unchanged**: it still emits the Intent Brief plus the `intentCheck` skeleton (all `unaddressed`). The skeleton is the canonical AC list.
- **Assessor contract** — input `{ intentBrief, intentCheck (skeleton), diff }`; output `intentCheck` only (no `findings`, no `positiveObservations`). It preserves structure exactly (same `id`, `title`, AC keys; never invents, drops, renames, or reorders ACs), emits only the three canonical verdict strings, and passes note-bearing/unfetchable items through verbatim.
- **Spawn condition:** spawn the Assessor only when `intentBrief` is defined **and** the skeleton is non-empty.
- **Overlay merge** — `scripts/lib/intent-check-merger.mjs`, a pure function `(skeleton, assessed) → mergedIntentCheck`. For each skeleton item + AC key, take the Assessor's verdict iff present and valid (`isAcVerdict`, imported from `review-summary-renderer.mjs`), else keep `unaddressed`. Assessor items/keys absent from the skeleton are ignored; the skeleton is the structural source of truth. Total-failure inputs (assessed is `[]`, not an array, or null) return the skeleton unchanged.
- **Orchestrator** runs the merger before `render-summary`, then passes the merged array as `INTENT_CHECK_JSON` (env-var shell-out, consistent with the existing pattern). The skeleton and assessed output reach the merger via env vars.
- **Code Reviewer** loses its AC-assessment step (former step 3); it no longer references ACs at all.

**Spawn-table exclusion** documented in four places: `agents/intent-assessor.md`, `scripts/lib/changed-file-analyser.mjs` (comment by `SPAWN_TABLE`, no logic change), `commands/review-pr.md` (fan-out step), and `CLAUDE.md` ("Adding a new Review Aspect").

**Orchestrator cleanup** — renumber `commands/review-pr.md` steps to clean integers (was 1, 2, 3, 3.5, 3.6, 4/4a/4b, 5, 6) as a final mechanical pass, fixing internal cross-references. Step numbers are prose headers, not referenced by any code or test.

**Already landed this session:** `docs/adr/0011-intent-assessor-for-live-ac-verdicts.md` (+ README entry) and the `CONTEXT.md` glossary (new **Intent Assessor** term, reworded **Intent Check**, **Review Aspect** clarified to exclude the Assessor, relationships updated).

## Testing Decisions

A good test here exercises only external behaviour — the merged `intentCheck` produced from given inputs — not internal structure. Tests use `node:test` + `node:assert/strict`. Prior art: `tests/render-summary.test.mjs` and `tests/severity-bucketer.test.mjs` (pure-function suites).

**Only `scripts/lib/intent-check-merger.mjs` is tested** — `tests/intent-check-merger.test.mjs` — with these cases:

1. Happy path — assessed verdicts overlay onto matching skeleton item/AC keys.
2. Extra assessed item (`id` not in skeleton) → ignored.
3. Extra assessed AC key (not in skeleton) → ignored.
4. Missing assessed AC (skeleton has it, assessed does not) → stays `unaddressed`.
5. Invalid verdict value in assessed → that AC keeps the skeleton's `unaddressed`.
6. Note-bearing item → passed through verbatim, verdicts untouched.
7. Total-failure shapes — assessed is `[]` / not an array / null → returns the skeleton unchanged.

The Assessor prompt and the orchestrator command are **not** unit-tested, consistent with the existing aspect agents (prompts are not tested). The existing `render-summary` / renderer Intent Check tests stay as-is — they cover rendering and per-item validation downstream of the merge.

## Out of Scope

- ADO Mode and ADO Work Item discovery — lands with #148 (Provider `discoverWorkItems` contract). This PRD is Pre-PR Mode (pasted URLs) only.
- Any change to the Intent Checker's gathering, hard-stop (ADR-0004), or Intent Brief synthesis.
- Quality-aware verdicts (verdicts that consume Findings) — explicitly rejected; `addressed` is coverage-only.
- Re-review verdict handling / `priorVerdict` carry-over.
- v1 `pr-review/` — deprecated and out of scope; no contamination.

## Further Notes

- Spun out of PR #159 (#147 scoped only the gathering path: fetch + brief + initial block). Blocked-by / related: #147 (merged via #159), #148 (ADO discovery / Provider contract).
- The "Intent Checker" / "Intent Check" / "Intent Assessor" terms sit close together; the glossary keeps them crisp — Intent Checker gathers (brief + skeleton), Intent Assessor produces verdicts, Intent Check is the rendered block.
- ADR-0010 is reserved (planned) for "Provider as a folder bundle" landing with #148; this work deliberately takes slot **0011**.
