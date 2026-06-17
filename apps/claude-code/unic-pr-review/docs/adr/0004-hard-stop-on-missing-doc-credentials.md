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

## Amendment (2026-06) — Provider-discovered Work Items are promised intent

Work Items discovered natively by a Source Platform Provider (e.g. ADO `workItemRefs` linked to a PR) are **promised intent** and follow the same reachability doctrine as pasted Jira / Confluence URLs. If a linked Work Item is unreachable or returns an auth error, the Plugin halts with a hard-stop. `not-found` remains a soft note — matching the pasted-URL rule — because it signals that the Work Item was genuinely absent from the system (deleted or never created), not that a configuration or credentials problem prevents the Plugin from reaching ADO. Auth errors and unreachable URLs indicate a broken setup the reviewer must fix; a missing Work Item is recoverable missing context.

Org-URL extraction failures (malformed or unrecognised Work Item URL shapes) are treated as unreachable: the Plugin halts and surfaces the offending URL rather than silently passing a wrong `--org` flag to `az boards work-item show`.

## Amendment (2026-06) — Third intent-state: lost-in-handoff → loud Notice + continue

Two existing intent states: (1) **legitimate empty** — no Work Items linked (`workItemRefs = []`) — silent, the Intent Check is simply omitted; (2) **unreachable** — a linked source cannot be fetched — hard-stop. A third state is now recognised:

**(3) Lost-in-handoff** — `workItemRefs` key is **absent** from `FETCHER_OUTPUT` (the field existed in the ADO Fetcher's output contract but was not delivered to the orchestrator, e.g. because the Fetcher agent abbreviated its large inline return on a big PR and dropped the field). This is **not** a legitimate no-WI case and **not** a hard-stop: the PR may well have linked Work Items, but the data did not survive the Fetcher→orchestrator handoff.

Behaviour for the lost-in-handoff state (`review-pr.md` Step 1.5):
1. **Early terminal notice** (before the aspect fan-out): loud print telling the Reviewer that Work Item data was not delivered, the Intent Check will be skipped, and they can Ctrl-C to abort and re-run for intent coverage.
2. **Summary Notice** (durable): a `lostInHandoff: true` flag is added to `NOTICES_CONTEXT` so the renderer emits a Notice at the top of the Review Summary — also posted to the PR when `--post` is used — creating a durable record that intent coverage was absent due to a data gap, not a deliberate design choice.
3. **Continue** — do not stop the run; proceed with `WORK_ITEMS = []` (no Intent Check, no hard-stop).

This state is distinct from legitimate-empty (silent) and unreachable (hard-stop), and is detected by checking `'workItemRefs' in FETCHER_OUTPUT` before inspecting its value.
