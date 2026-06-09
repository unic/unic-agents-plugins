# 0005. Gate de-dup posts when the comparison basis is incomplete

**Status:** Accepted (2026-06)

## Context

[ADR-0002](0002-dedup-by-similarity-not-marker.md) de-duplicates each candidate Finding against **all** existing page comments by content similarity, with a human tiebreak for borderline matches. Its safety rests entirely on that word "all": a clean `post` decision means "no duplicate exists on the page".

But the comment set is not always complete. `fetchConfluenceComments` caps pagination at `MAX_PAGES = 50` and reports `truncated`; a partial read can also leave `errors` non-empty. In either case the comparison ran against a partial set, yet (post-#237) `matchDedup` never saw the signal — the CLI dropped `truncated` on the floor — so a Finding that duplicates a comment living beyond the cap was decided `post` and shown a clean, badge-less entry with the same authority as a fully-checked Finding. Truncation silently broke ADR-0002's "all", which is the exact failure mode #208 set out to prevent.

Options weighed (see #238): (1) thread `truncated` into the dedup output envelope; (2) downgrade `post`→`flag` per Finding when truncated; (3) command-only prose gate, no `matchDedup` change; (4) a new per-Finding `post-uncertain` decision state.

## Decision

Incompleteness is a **run-level** fact (a property of the comment set, not of any Finding), surfaced structurally and gated in the Approval Loop:

- The `dedup-matcher` CLI emits a run-level envelope `{ truncated, results }` instead of a bare `DedupResult[]`. `matchDedup` itself is unchanged — still pure and per-Finding.
- The command converges both incompleteness sources into one flag: `COMPARISON_INCOMPLETE = truncated OR (read-errors, excluding the hard auth-stop)`.
- When the run is incomplete, every clean `post` Finding renders a `[?incomplete]` badge instead of a blank one, and a single run-level confirmation is required before any clean post is written. `skip` and `flag` keep their existing per-Finding gates — a real match stays real regardless of truncation.
- `MAX_PAGES` is left at 50. The gate is correct at any cap; raising the cap only moves the boundary, never closes it.

## Reasons

- **Run-level matches the fact.** Truncation describes the comment set, so options 2 and 4 (smearing it across Findings) overload `flag` — conflating "match found" with "couldn't look" — or duplicate one truth N times. One run, one signal.
- **Structural over prose.** The envelope makes incompleteness unit-testable with injected `{ comments, truncated: true }`, avoiding option 3's weakness where enforcement lives only in orchestrator prose.
- **Purity preserved.** `matchDedup` stays I/O- and policy-free over the comments it was given; the run-level axis lives one level up, in the CLI and the command, where write-gating already lives.
- **Honest UX, low noise.** The badge satisfies "no unqualified `post` authority"; one run-level confirm (not confirm-each) respects the per-Finding judgement the reviewer already made at selection.

## Consequences

- The CLI output contract changes from a bare array to `{ truncated, results }`; the command's Step 10b parser reads `.results`. No external consumers exist, so this is a contained change.
- This refines ADR-0002 rather than replacing it: similarity de-dup with a human tiebreak still stands; this ADR only governs what happens when the comparison basis cannot be guaranteed complete.
