# 0004. Hard-stop when intent sources are unreachable

**Status:** Accepted (2026-05)

## Context

A fetched Work Item often links to a Confluence page or Jira issue that carries the actual intent. When that linked source cannot be retrieved (missing Credential File, wrong tenant, page deleted), the Review Aspect agents have an incomplete Intent Brief and the Intent Check verdicts come out wrong. We needed to decide whether to soft-fail or hard-fail.

Two alternatives were considered:

- **Best-effort: skip unreachable sources, post a Notice, continue.** Rejected — a Work Item that links to a Confluence page is making a promise that the page carries the intent. Skipping the page means every aspect agent reviews against an incomplete Intent Brief, the Intent Check verdicts come out wrong, and the Reviewer cannot tell from the output that intent was missing. The failure is silent and load-bearing.
- **Degrade with a top-of-summary banner.** Rejected — banners are routinely ignored when the rest of the output looks complete. A hard stop forces the invoker to set up credentials once, then never see this failure mode again.

## Decision

If a fetched Work Item links to a Confluence page and the Confluence Credential File is missing or the page is unreachable, the Plugin halts with a one-line instruction to run `setup-confluence`. Same rule for Jira issues whose tenant is unreachable. The Plugin does not silently skip an intent source.

## Consequences

- The Doctor command becomes load-bearing: invokers run `doctor` before their first Review to surface missing credentials before they're in the middle of a PR review.
- Empty intent (no Work Items linked, none pasted) is NOT a failure — it's an empty Intent Brief and the Review proceeds without a preamble. The hard stop fires only when intent is promised by a link but cannot be retrieved.
