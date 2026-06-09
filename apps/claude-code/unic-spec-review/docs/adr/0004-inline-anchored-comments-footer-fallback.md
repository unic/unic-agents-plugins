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

## Update (2026-06): body representation and reactive fallback

Two refinements to the posting path, grilled against issues #231 (rendering) and #232 (fallback completeness). The inline-versus-footer decision above is unchanged; these pin how the body is encoded and close a gap in the "never dropped" guarantee.

### Body representation: convert Markdown to storage format

The Confluence v2 comment API accepts a `representation` of `storage`, `atlas_doc_format`, or `wiki` only; Markdown is not a valid value. Finding bodies are agent-authored Markdown, but were being posted with `representation: 'wiki'`, so lists, code blocks, and links rendered as raw markup.

Posting now converts the Finding body to **storage format** (XHTML) via a vendored, dependency-free converter (per [ADR-0001](0001-vendor-shared-code-for-self-containment.md)). Storage was chosen over wiki (semi-deprecated by Atlassian) and ADF (heaviest; a JSON document tree) because it is the modern, fully-supported representation and is already the format the read path fetches (`body.storage`), so the plugin works in one representation end to end.

- The converter handles the subset Findings actually contain: HTML-escaping (mandatory for valid XHTML, unlike wiki), bold/italic, inline code, links, bullet and ordered lists, and fenced code blocks (`ac:structured-macro`). Any unrecognised construct (headings, tables, raw HTML) degrades to HTML-escaped literal text rather than malformed XHTML. The guarantee is that a posted comment is never malformed; worst case it reads as plain text.
- Only the agent-authored Finding body is converted. The title line and attribution footer are emitted as storage fragments directly, with interpolated values escaped, so the footer marker text stays byte-exact and `recognizeFooter` keeps working.
- De-dup ([ADR-0002](0002-dedup-by-similarity-not-marker.md)) is unaffected: the read path strips HTML to plain text before tokenising, so the comparison runs on stripped text regardless of the write representation.

### Reactive footer fallback on inline rejection

The fallback above is predictive: our resolver falls back to a footer when it cannot match the anchor uniquely. But our resolver counts over `stripHtml(page)` while Confluence validates the `textSelection`/`matchCount` against its own stored-body model, so the two can disagree. When they do, Confluence rejects the inline POST and the Finding was erroring out, posted nowhere, breaking the guarantee.

The fallback is now also reactive: an inline POST rejected by Confluence (HTTP 400, surfaced as the new `FetchError` kind `rejected`) retries the same body as a page-level footer comment and reports `footer fallback (inline rejected by Confluence)`. Genuine auth (401/403), not-found (404), and network/timeout/5xx failures still fail loudly and are never silently retried. This restores the "no Finding is ever dropped" guarantee end to end.
