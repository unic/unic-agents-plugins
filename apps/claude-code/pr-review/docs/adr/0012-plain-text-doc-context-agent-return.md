# 0012. Plain-text return from Doc Context Orchestrator agent, no JSON wrapper

**Status:** Accepted (2026-05)

## Context

The Doc Context pipeline uses two agents: the Doc Context Synthesizer produces the
`## Business context for this PR` markdown narrative from all work item and Confluence
summaries; the Doc Context Orchestrator delegates synthesis to the Synthesizer and
returns the Synthesizer's output verbatim — it does not rewrite or reformat it. The
Orchestrator's output therefore arrives as a plain markdown string, not as a JSON
object (e.g. `{ "docContext": "...", "warnings": [...] }`).

## Decision

The orchestrator agent outputs the final `## Business context` markdown block
directly. The calling step stores the output verbatim as `DOC_CONTEXT`. Warnings
are emitted to console as side effects during execution — they are not returned in
the agent's output.

**Alternatives considered:**

_JSON wrapper_ — returning `{ "docContext": "...", "warnings": [...] }` and
extracting `docContext` in the calling step via `jq`. Rejected because:

1. LLM agents frequently wrap JSON in markdown fences, add explanatory prose, or
   produce malformed JSON when the output is long. A silent extraction failure
   leaves `DOC_CONTEXT` empty with no diagnostic.
2. Warnings are already printed to console during execution; returning them again
   in the final output is redundant.
3. `jq` extraction from an LLM output string is conceptual (not real shell
   execution), making the failure mode harder to reason about and test.

## Consequences

Both the Orchestrator and the Synthesizer must return an empty string (not JSON
null or an error object) when no meaningful context is gathered. Step 4a in
`review-pr.md` stores the agent output verbatim with no explicit empty-check
guard; the guarantee that `DOC_CONTEXT` stays `''` on failure comes from the
Orchestrator and Synthesizer always returning `""` rather than from any
caller-side conditional.

**See also:**

- `docs/plans/11-doc-context-spawn-reliability.md` (retired — see git history for content)
