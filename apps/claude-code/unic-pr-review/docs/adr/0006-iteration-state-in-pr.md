# 0006. Iteration state lives in the PR, not locally

**Status:** Accepted (2026-05)

## Context

The Re-review machinery needs to know which Revision of a PR was last reviewed so it can compute a delta diff. That state has to live somewhere durable that survives machine swaps, CI runs, and shared laptops — and that the Plugin can recover deterministically at the start of every Review.

Two alternatives were considered:

- **Local state file under `~/.unic-pr-review/state.json` keyed by PR URL.** Rejected — invokers swap machines, share laptops, and run the Plugin from CI. A local cache silently desyncs and would force every Review to re-detect mode from the PR anyway.
- **A custom ADO PR property (`pullRequest.properties`).** Rejected — properties are not visible in the PR UI, can be modified out-of-band, and require an extra round-trip. The Bot Signature is human-readable, lives in the same place as the Findings, and survives every ADO change short of comment deletion.

## Decision

The Plugin stores no local state about which Revisions it has reviewed. The prior reviewed Revision is recovered by finding the most recent comment authored by the Plugin in the PR's Threads (matched by the authenticated `az devops` user ID, cached at startup) and parsing the literal `Iteration N` suffix of its Bot Signature. First Review is detected when no such comment exists.

## Consequences

- The Bot Signature wording is load-bearing — `🤖 Reviewed by Claude Code — Iteration N` — and changing it breaks detection on any PR with an older Review. Any change requires a migration ADR.
- The Plugin must cache the authenticated user identity at startup so it never mistakes a human comment for its own. The Doctor command verifies this lookup succeeds.
- A user deleting the Plugin's prior comments is a legitimate way to force a fresh First Review; this is documented behaviour, not a bug.
