# Iteration state lives in the PR, not locally

The Plugin stores no local state about which Revisions it has reviewed. The prior reviewed Revision is recovered by finding the most recent comment authored by the Plugin in the PR's Threads (matched by the authenticated `az devops` user ID, cached at startup) and parsing the literal `Iteration N` suffix of its Bot Signature. First Review is detected when no such comment exists.

## Considered options

- **Local state file under `~/.unic-pr-review/state.json` keyed by PR URL.** Rejected — invokers swap machines, share laptops, and run the Plugin from CI. A local cache silently desyncs and would force every Review to re-detect mode from the PR anyway.
- **A custom ADO PR property (`pullRequest.properties`).** Rejected — properties are not visible in the PR UI, can be modified out-of-band, and require an extra round-trip. The Bot Signature is human-readable, lives in the same place as the Findings, and survives every ADO change short of comment deletion.

## Consequences

- The Bot Signature wording is load-bearing — `🤖 Reviewed by Claude Code — Iteration N` — and changing it breaks detection on any PR with an older Review. Any change requires a migration ADR.
- The Plugin must cache the authenticated user identity at startup so it never mistakes a human comment for its own. The Doctor command verifies this lookup succeeds.
- A user deleting the Plugin's prior comments is a legitimate way to force a fresh First Review; this is documented behaviour, not a bug.
