# 0004. Inline-anchored Confluence comments with a footer fallback

**Status:** Accepted (2026-06)

## Context

Approved Findings are posted back to Confluence as comments. Confluence exposes two comment types over its REST API: page-level footer comments, and inline comments anchored to a specific text selection (the v2 API takes a `textSelection` plus a `matchCount` to disambiguate repeated text). Findings vary: most reference a specific passage of the spec, but some are cross-cutting (for example "this whole section has no error states").

Three posting strategies were considered:

- **Footer comments only.** Robust and simple, survives spec edits, but imprecise: the reviewer must hunt for the passage each Finding refers to.
- **Inline-anchored only.** Most precise, but cross-cutting Findings have no text to anchor to and would be lost.
- **Inline-anchored where possible, footer fallback otherwise.** Chosen.

## Decision

For each approved Finding, attempt to anchor an inline comment to the exact spec text it concerns, resolving the anchor text against the page body into a `textSelection` and `matchCount` for the Confluence v2 inline-comment API. When the text cannot be matched uniquely (not found, or ambiguous), fall back to a page-level footer comment that quotes the passage and names the location. No Finding is ever dropped for lack of an anchor.

## Reasons

- **Precision where it helps, robustness where it must.** Anchoring puts the comment exactly where the issue is; the fallback guarantees cross-cutting and un-matchable Findings still land.
- **Matches how reviewers actually read.** Inline comments appear next to the relevant sentence in the Confluence reading view, which is where a reviewer expects the critique.
- **Self-containment.** Posting uses the vendored, dependency-free `atlassian-fetch` over the Atlassian REST API (see [ADR-0001](0001-vendor-shared-code-for-self-containment.md)), extended with comment write. It does not reuse the `unic-confluence` plugin, whose write path publishes whole markdown pages, not anchored comments.

## Consequences

- Inline anchoring is fragile across edits: if the anchored text changes between the review and the post, or between runs, the match can fail and the Finding falls back to a footer comment. This is acceptable and is why the fallback exists.
- The anchor-resolution logic (`inline-anchor-resolver`) is a pure module with its own unit tests, since matching `textSelection` and `matchCount` correctly is the riskiest part of posting.
- Every posted comment, inline or footer, carries the visible attribution footer from [ADR-0002](0002-dedup-by-similarity-not-marker.md).
