# 0011. Intent Assessor as a dedicated agent for live AC verdicts

**Status:** Accepted (2026-05)

## Context

The Intent Check block lists a per-Acceptance-Criterion verdict (`addressed` / `partially addressed` / `unaddressed`) at the top of the Review Summary. The Intent Checker emits an `intentCheck` array, but every verdict is hard-coded to `unaddressed` ("not yet assessed") — it never sees the diff, so it cannot judge coverage. The orchestrator forwarded that static array verbatim to `render-summary`, so the rendered block could only ever show `unaddressed` for every AC, contradicting the Review Summary mock in [issue #160](https://github.com/unic/unic-agents-plugins/issues/160), which shows a mix of verdicts.

Producing live verdicts requires assessing each AC against the diff. Three placements were considered:

- **Option A — the Code Reviewer emits an updated `intentCheck`.** Rejected. `code-reviewer` always runs on any non-empty diff (ADR-0008), and the orchestrator guards empty/unfetchable diffs before fan-out, so a reviewable diff always spawns it — spawn-conditionality is not the concern. The real problems: it forces the orchestrator to reconcile a code-reviewer-authored array against the static one (and against other aspects' opinions) — cross-agent merge logic we want to avoid — and it splits ownership of the Intent Check away from the intent agents.
- **Option B1 — the Intent Checker assesses in-process.** Rejected. The Intent Checker owns the hard-stop decision on unreachable intent (ADR-0004), which it must make _before_ looking at any diff. Folding diff assessment into the same agent loads the full diff into the abort-decision agent and broadens its single responsibility from "gather intent" to "gather + assess."
- **Option B2 — a dedicated assessment agent.** Accepted (see Decision).

A second decision was what `addressed` _means_. If it meant "correctly and completely satisfied" (coverage **and** quality), the assessor would have to consume the aspect agents' Findings — forcing serialization (aspects first, assessor second) and re-introducing the cross-agent merge we rejected in Option A. It would also double-count: a bug would surface both as a Finding and as a downgraded verdict, and Findings dropped below the confidence floor (ADR-0002) would silently fail to downgrade an AC.

## Decision

A dedicated **Intent Assessor** agent (`agents/intent-assessor.md`) produces the live AC verdicts. It runs in the **same parallel fan-out batch** as the Review Aspect agents (zero added latency), seeded with `{ intentBrief, intentCheck (skeleton), diff }`, and returns the same structure with verdicts filled in — no Findings, no `positiveObservations`.

- **`addressed` means coverage, not quality.** A verdict answers "does the diff contain changes that implement this AC?" — orthogonal to the Findings, which answer "is it built well?" The Assessor therefore needs only the diff, never the aspect agents' output, so full parallelism is correct.
- **The skeleton is the structural source of truth.** The Intent Checker still emits the `intentCheck` skeleton (all `unaddressed`) plus the Intent Brief, unchanged. The Assessor only colours in verdicts; it never adds, drops, renames, or reorders ACs.
- **Overlay merge in `scripts/lib/intent-check-merger.mjs`.** A pure, **context-free** helper overlays the Assessor's verdicts onto the skeleton: for each skeleton item + AC key, take the Assessor's verdict iff present and valid (`isAcVerdict`), else keep `unaddressed`. Assessor items/keys absent from the skeleton are ignored. It returns `{ items, diagnostics }`, where `diagnostics` is `{ assessedReceived, applied, droppedElements, rejectedVerdicts, unmatchedItems }`. The merger has no I/O and no knowledge of whether the Assessor was spawned — it reports only mechanical facts about the array path. The orchestrator runs the merger before `render-summary`, passes `items` as `INTENT_CHECK_JSON`, and owns both the gross input-shape check (assessed missing / non-array / empty) and the channel decisions in the Consequences below.
- **The Assessor is NOT a Review Aspect.** It is spawned by intent presence (`intentBrief` defined **and** the skeleton non-empty), not by changed-file categories. It must **not** be added to `SPAWN_TABLE` in `changed-file-analyser.mjs`.
- The Code Reviewer no longer assesses ACs (its former step 3 is removed) — AC assessment lives solely in the Assessor, so an unaddressed AC is never reported twice.

## Consequences

- **Structural safety is free.** A drifted-but-well-formed Assessor response cannot corrupt the block: the overlay projects verdicts onto the skeleton, so hallucinated, dropped, renamed, or reordered ACs are impossible by construction.
- **Verdict provenance is _not_ free, and must be surfaced.** When the Assessor is not spawned, the block is omitted (ADR-0004). But when it _is_ spawned and its response is missing, non-array, empty, or applies zero verdicts, every AC silently falls back to `unaddressed` — indistinguishable, _to the Reviewer_, from a genuine "the diff does not cover this AC." The fallback itself is correct (no crash, no corruption); presenting it _without signal_ is the defect. (An earlier draft of this ADR called the whole degradation "free"; that conflated structural safety — which is free — with verdict provenance, which is not.) The merger therefore returns `diagnostics` alongside the merged `items`, and the orchestrator: (a) raises a **Notice** above the Intent Check when a spawned Assessor applied zero verdicts (`applied === 0`, or assessed missing/non-array), telling the Reviewer the block is unassessed; and (b) writes a **stderr diagnostic** naming the drift class on _any_ drop (`droppedElements`/`rejectedVerdicts`/`unmatchedItems` > 0) — a debugging channel for a maintainer, not addressed to the Reviewer. Partial degradation is logged but raises no Notice, to keep Notices high-signal.
- Note-bearing items (unfetchable ACs tagged by the Intent Checker per ADR-0004) pass through the Assessor and the merger untouched.
- Unit tests cover the merger (`tests/intent-check-merger.test.mjs`); the agent prompt is not unit-tested, consistent with the other aspect agents.
- The spawn-table exclusion is documented in `agents/intent-assessor.md`, `changed-file-analyser.mjs`, `commands/review-pr.md`, and `CLAUDE.md` so a future maintainer or PR reviewer does not "fix" the Assessor into the Spawn Set.
