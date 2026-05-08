# Plain-text return from Doc Context Orchestrator agent, no JSON wrapper

The Doc Context Orchestrator agent returns its output as a plain markdown string,
not as a JSON object (e.g. `{ "docContext": "...", "warnings": [...] }`).

**Decision:** the orchestrator agent outputs the final `## Business context` markdown
block directly. The calling step stores the output verbatim as `DOC_CONTEXT`.
Warnings are emitted to console as side effects during execution — they are not
returned in the agent's output.

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

**Consequence:** the orchestrator must return an empty string (not JSON null or an
error object) when no meaningful context is gathered. The calling step checks for
an empty string and leaves `DOC_CONTEXT=''` unchanged.

**Status:** Accepted (2026-05)

**See also:**

- `docs/plans/11-doc-context-spawn-reliability.md`
