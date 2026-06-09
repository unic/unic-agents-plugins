# 0002. De-duplicate comments by content similarity, not a hidden marker

**Status:** Accepted (2026-06)

## Context

`/review-spec` can be run many times against the same Confluence pages, by different reviewers. Without de-duplication, every run re-posts Findings that were already raised, so the requirement is to avoid duplicate comments across reruns and across users. Confluence pages also carry human comments that may already raise an issue a Finding would repeat.

The sibling plugin `unic-pr-review` solves its own version of this with a hidden Iteration Marker embedded in every bot comment (see `unic-pr-review` [ADR-0006](../../../unic-pr-review/docs/adr/0006-iteration-state-in-pr.md)): detection keys on an HTML-comment marker, invisible to readers but parseable by the plugin. That approach was considered here and rejected.

Three approaches were weighed:

- **Hidden fingerprint marker** (the `unic-pr-review` model). Deterministic self-detection, but it embeds machine cruft into comments on pages that designers and product owners read, and it only recognises the plugin's own prior comments, not human ones.
- **Pure automatic similarity threshold.** No marker, but a fixed threshold decides post-or-skip with no human in the loop; borderline cases flip between runs and duplicates accumulate silently.
- **Content similarity with a human tiebreak in the Approval Loop.** Chosen.

## Decision

De-duplicate by comparing each candidate Finding against **all** existing comments on the page (the reviewer's own prior runs, other reviewers' runs, and human comments) by content similarity. No hidden marker is written and no local state file is kept. Borderline near-duplicates are surfaced in the Approval Loop for a human tiebreak before anything is posted.

Every comment the plugin posts carries a **visible attribution footer** (for example a short provenance line naming the command and the Finding category). The footer is transparent provenance, not a hidden detection token; it lets any later run, by any user, recognise prior command Findings with high precision while still treating human comments by similarity alone.

## Reasons

- **Multi-user and multi-run safe by construction.** Reading all existing comments on the shared page catches duplicates regardless of author. A local state file would miss other users entirely; a per-user marker would miss other users' runs.
- **No page pollution.** Spec pages are read by non-engineers. A visible attribution footer is honest provenance; a hidden HTML marker is cruft on a shared artifact.
- **The Approval Loop already gates writes.** Because [interactive approval](0003-six-hats-lens-over-dimensions.md) precedes every post, de-duplication does not need to be perfectly automatic. A human breaks every ambiguous tie, so the non-determinism of similarity cannot silently accumulate duplicates.
- **One pass covers two needs.** Comparing against all comments handles both "do not repeat the command" and "do not repeat a human" in a single step.

## Consequences

- De-duplication is not fully deterministic; identical inputs may classify a borderline case differently between runs. The human tiebreak is the safeguard, so this is acceptable and intentional.
- This plugin deliberately diverges from `unic-pr-review`'s marker-based detection. The two plugins write different comment shapes; their de-duplication mechanisms are not interchangeable.
- The visible attribution footer wording is part of the contract: changing it weakens recognition of older command comments by later runs. Treat wording changes as a migration.
