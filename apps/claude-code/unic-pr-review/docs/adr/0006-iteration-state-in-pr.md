# 0006. Iteration state lives in the PR, not locally

**Status:** Accepted (2026-05); detection mechanism revised (2026-06, issue #194)

## Context

The Re-review machinery needs to know which Revision of a PR was last reviewed so it can compute a delta diff. That state has to live somewhere durable that survives machine swaps, CI runs, and shared laptops — and that the Plugin can recover deterministically at the start of every Review.

Two alternatives were considered:

- **Local state file under `~/.unic-pr-review/state.json` keyed by PR URL.** Rejected — invokers swap machines, share laptops, and run the Plugin from CI. A local cache silently desyncs and would force every Review to re-detect mode from the PR anyway. (Note: a different, repo-local cache at `<cwd>/.unic-pr-review/<key>/` is used by the Approval Loop for Ctrl-C-resumable per-Finding decisions — see PRD § Modules (Approval Loop). That cache is scoped to one Review's lifetime, not to long-term iteration state, and the two are not interchangeable.)
- **A custom ADO PR property (`pullRequest.properties`).** Rejected — properties are not visible in the PR UI, can be modified out-of-band, and require an extra round-trip. The Bot Signature is human-readable, lives in the same place as the Findings, and survives every ADO change short of comment deletion.

## Decision

The Plugin stores no local state about which Revisions it has reviewed. The prior reviewed Revision is recovered by finding the most recent comment carrying the Plugin's **Bot Signature** and parsing the iteration number `N` from it. First Review is detected when no such comment exists.

Every bot-authored comment (inline Findings, the Review Summary, and re-review replies) carries the Bot Signature, rendered exclusively by `scripts/lib/signature.mjs`:

- a human-facing visible line `🤖 Reviewed by Claude Code — Iteration N`, and
- a hidden machine-readable **Iteration Marker** `<!-- unic-pr-review:iteration=N -->`.

Detection keys on the Iteration Marker. A comment is recognised as the Plugin's own **solely** by the presence of that marker — never by matching the author's ADO user id.

## Detection mechanism: marker, not author identity (revised 2026-06)

The original (v1) scheme matched the Plugin's own comments by the authenticated ADO user id: the Plugin cached its identity at startup via `az devops user show`, and threads/comments were attributed to the bot when `comment.author.id` equalled that cached id. The visible footer text was the only signature; identity matching was what prevented a human comment that happened to contain the footer from being mistaken for a prior Review.

That scheme was dropped because `az devops user show` resolves identity through the **Member Entitlement Management** API (`_apis/UserEntitlements`), an org-administration surface readable only by Project Collection Administrators. A normal reviewer — the typical user — gets an HTTP 404, so the lookup (and the `doctor` check guarding it) could never pass for them, even though every capability a Review actually needs works (issue #194). Identity was load-bearing for nothing a Review could not get from the signature itself.

Replacing identity matching with the hidden Iteration Marker removes the admin-permission dependency entirely and makes the signature self-sufficient. The marker survives because ADO stores comment content verbatim and the Threads REST API returns raw `content`; CommonMark renderers do not display HTML comments, so the marker is invisible to the Reviewer but present for detection. The marker also resists the false-positive vector the old identity check guarded against — a human quote-reply reproduces `> 🤖 … Iteration N`, which the visible footer regex would match but the marker (`<!-- … -->`, never reproduced by quoting) does not.

## Consequences

- The Iteration Marker wording is load-bearing — `<!-- unic-pr-review:iteration=N -->` — and changing it breaks detection on any PR with an older Review. Any change requires a migration ADR. The visible footer wording is human-facing only and no longer drives detection.
- The Plugin no longer resolves or caches the caller's ADO identity, and `doctor` no longer probes it. The fetcher attributes prior bot Threads by Iteration Marker presence on the Thread's first comment; the Re-review Coordinator distinguishes bot comments from human replies the same way.
- No backward compatibility is provided for PRs signed under the v1 visible-footer-only scheme: their prior comments are not detected, so the next Review treats them as a First Review. This is acceptable at the current adoption scale (a handful of users) and self-heals — that Review re-stamps the PR with the marker.
- A user deleting the Plugin's prior comments is a legitimate way to force a fresh First Review; this is documented behaviour, not a bug.
