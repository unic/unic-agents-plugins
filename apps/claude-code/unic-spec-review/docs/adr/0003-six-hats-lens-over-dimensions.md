# 0003. Six Thinking Hats layered as a lens over technical dimensions

**Status:** Accepted (2026-06)

## Context

The review engine fans out parallel agents, each emitting Confidence-scored Findings, following `unic-pr-review`'s conditional sub-agent pattern (see `unic-pr-review` [ADR-0008](../../../unic-pr-review/docs/adr/0008-conditional-sub-agent-spawning.md)). The open question was how to structure the agent roster for spec review.

A pure adversarial review is dominated by critique: gaps, ambiguity, inconsistency, infeasibility. De Bono's Six Thinking Hats was raised as a complementary framing because a fault-only review misses perspectives that are legitimate spec critiques: alternatives not considered, value not justified, and likely user confusion.

Three integrations were considered:

- **Replace the technical dimensions with six hat-agents.** Rejected: a cleaner mental model but it loses the explicit per-source, per-dimension specificity (Spec-versus-Design, Spec-versus-Live, Testability against the repo, and so on).
- **Use hats only to relabel the report.** Rejected: cosmetic; it adds none of the perspectives a fault-only review misses.
- **Layer hats as a lens over the dimensions.** Chosen.

## Decision

Keep eight technical dimension agents as the Black-hat critique core (Gaps, Ambiguity, Spec-versus-Design, Spec-versus-Live, Internal-consistency, Testability, Feasibility, Non-functional). Add three perspective agents the dimensions do not cover: Green (alternatives), Yellow (value and justification), Red (user reaction). Fold White (facts and what is missing or unverified) into the Gaps and Testability agents. Blue is the orchestrator and synthesiser. Every Finding is tagged with both its dimension and its hat, and the report groups Findings by hat.

## Reasons

- **Keeps technical depth and adds balance.** The dimensions preserve source-specific and stack-specific rigour; the Green/Yellow/Red agents add the constructive and human perspectives a fault-only review drops.
- **Hat tags aid triage.** Grouping by hat lets a reviewer read all "is this worth building" concerns together, separately from "this contradicts the design" concerns.
- **Consistent with the existing review model.** Findings remain Confidence-scored (see `unic-pr-review` [ADR-0002](../../../unic-pr-review/docs/adr/0002-confidence-scored-findings.md)); hats are an additional axis, not a replacement for confidence or severity.

## Consequences

- The roster is larger (eleven review agents plus the orchestrator), which costs more tokens and produces more Findings to triage. The ranked, hat-grouped presentation and the Approval Loop absorb that volume.
- The dimension-to-hat mapping is a fixed part of the design; changing which hat a dimension reports under changes how Findings group in the report.
- White is intentionally not its own agent. If "facts and missing evidence" proves under-served inside Gaps and Testability, promoting White to a dedicated agent is a future revision.
