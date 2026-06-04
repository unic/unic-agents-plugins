# 0012. First-review computes a checkout-free merge-base diff from ADO commit SHAs

**Status:** Accepted (2026-06)

## Context

ADO first-review originally shipped as a stub (issue #148): the ADO Fetcher unconditionally set `rawDiff = ""` and `diffUnavailable = true`, because the ADO diffs API returns only file-level metadata, not a line-level unified diff. As a result the only way to get a real _first_ review of an open PR was to check out the branch locally and run Pre-PR mode — a surprising, undocumented constraint (issue #196).

Re-review (ADR-0007) already solved the hard part: it computes a real diff from commit SHAs via local git (`git fetch origin` + `git diff <A> <B>`) with **no branch checkout**. The commit SHAs a first review needs are already present in the data the Fetcher fetches — every PR iteration carries `commonRefCommit` (the merge base) and `sourceRefCommit` (the source tip).

Two mechanisms were available:

- **Commit-SHA diff via local git, inside a clone of the PR's repo.** Reuses re-review's proven path; yields a standard unified diff the aspect agents already consume.
- **ADO REST diff API** (per-file blob content + `diffs/commits` line ranges). Works without a local clone, but returns changed-line ranges rather than unified hunks, so the diff would have to be synthesised from reconstructed file content — a heavier, separate correctness risk.

## Decision

A first review (and `first-review-fallback`) computes its diff the same checkout-free way re-review does: two-dot `git diff <commonRefCommit> <sourceRefCommit> --unified=3` from the latest revision, after a single `git fetch origin`. `commonRefCommit` is trusted as ADO's merge base (so the result equals `target...source` and is reproducible without recomputing the base locally).

Because this requires running inside a clone of the PR's repo, the Fetcher first verifies the local clone matches the PR via a remote-URL match (`prMetadata.repository.remoteUrl` against the local remotes, normalised by `scripts/lib/remote-match.mjs`). If no remote matches, or the `git diff` fails, or `commonRefCommit` is absent, the Fetcher falls back to the existing `diffUnavailable: true` + structural Notice (issue #176) — never a false "clean" verdict.

The ADO REST diff API is the documented fallback for the no-clone case (e.g. headless/cron), but is **deliberately deferred** to a follow-up — the git-SHA path closes the reported gap.

## Consequences

- A first review of a remote PR requires the reviewer to be inside a clone of that repo; the repo-match guard makes a wrong/absent clone degrade safely instead of producing a misleading diff.
- `first-review` and `first-review-fallback` share one diff-computation branch (`MODE !== "re-review"`); the fallback makes no attempt to delta against the vanished prior revision.
- The diff is the full PR (merge-base→source), so large PRs feed a large diff to every aspect agent — a property already shared with Pre-PR mode (ADR-0009), not introduced here.
- First-review is stricter about wrong-clone detection than re-review, which still does a blind `git fetch origin` — a candidate consistency follow-up.
