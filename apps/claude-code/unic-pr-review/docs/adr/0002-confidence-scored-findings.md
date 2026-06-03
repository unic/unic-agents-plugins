# 0002. Confidence-scored Findings with explicit Severity thresholds

**Status:** Accepted (2026-05)

## Context

Review Aspect agents emit Findings that must be filtered (to drop low-quality output) and grouped into Severity buckets (to drive the Review Summary). The team needed a rubric that produced consistent, low-noise output across six independent agent prompts.

Two alternatives were considered:

- **Descriptive severity only (Critical / Important / Minor as agent choice).** Rejected — what we observed in the Anthropic `pr-review-toolkit` is that explicit numeric confidence with a hard cutoff produces far fewer false positives than asking the model to pick a severity word. The number forces the agent to commit and gives a clean filter knob.
- **Score with no Minor bucket (Anthropic's exact rubric: 80+ floor).** Rejected — our Review Summary template has a Minor section that's useful for low-impact-but-correct observations. Dropping everything below 80 would empty that bucket.

## Decision

Every Review Aspect agent attaches a 0-100 Confidence Score to each candidate Finding and drops anything below 60. The Score deterministically maps to a Severity bucket in the Review Summary: 90-100 Critical, 80-89 Important, 60-79 Minor. The Intent Checker is exempt — it emits qualitative per-Acceptance Criterion verdicts (addressed / partially addressed / unaddressed) instead.

## Consequences

- Every agent prompt embeds the rubric verbatim so all six aspect agents stay consistent.
- The threshold knobs (60 floor, 80 Important boundary, 90 Critical boundary) are policy, not implementation detail — changing them changes how a Review reads and would surprise long-time users. Any future tuning warrants a superseding ADR.
- The Intent Checker's exemption is intentional: AC verdicts (addressed / partially addressed / unaddressed) are categorical, not confidence-bearing; forcing a 0-100 score on intent matching would be noise.
