# 0013. Split review-pr.md into a thin orchestrator and focused agents

**Status:** Accepted (2026-05)

## Context

`review-pr.md` has grown to ~1000 lines as the re-review state machine, ADO write-back logic, and doc-context orchestration were added. This creates two compounding problems:

1. **Token budget pressure.** The full command file is loaded into the parent context on every invocation. Combined with tool-call results flowing back from parallel review agents, average PR reviews reach +100 K tokens — unsustainable as the command grows further.

2. **Growth risk.** A pre-PR mode (review without opening a PR) is an emerging user request. Adding a third operating mode to the current monolith would push the file toward ~1300 lines and worsen the token problem.

The root cause is architectural: `review-pr.md` conflates orchestration (which mode are we in? what agents to launch?) with platform integration (fetch ADO threads, post inline comments) and re-review state management (classify threads, match findings, reply).

The right model for `review-pr.md` is a thin coordinator: prerequisites block, mode detection block, and one delegation block per mode. The three focused agents own all data-fetch and write-back ADO operations. The one allowed inline ADO call is the mode-detection `az repos pr thread list` in the mode detection block — an orchestration concern, not a data-fetch or write-back operation; no `az devops invoke` commands remain in the orchestrator.

## Decision

Refactor `review-pr.md` into a **thin orchestrator** of ~200 lines that:

1. Validates prerequisites and parses the PR URL (or detects absence of URL for pre-PR mode).
2. Detects the operating mode: **pre-PR**, **first-review**, or **re-review**.
3. Delegates immediately to a focused agent per mode.

Three focused agents live in the plugin's `.agents/` directory (not in `pr-review-toolkit`, which is a read-only dependency):

- **`pr-review:ado-fetcher`** — fetches PR metadata, iterations, changed files, and raw diff from ADO. Used by first-review and re-review modes.
- **`pr-review:re-review-coordinator`** — owns prior thread detection, partial-run check, thread classification, finding matching, and reply posting to classified threads. Used only in re-review mode.
- **`pr-review:ado-writer`** — owns the ADO write-back pipeline: posting inline threads, patching thread status, and posting the summary comment. Used by first-review and re-review modes.

Pre-PR mode skips the ADO fetcher and writer entirely; it goes straight from the orchestrator to the `pr-review-toolkit` review agents and presents findings locally.

**Compact sub-agent output.** Review agents (`pr-review-toolkit:code-reviewer`, etc.) are asked via the review-agent launch step in `review-pr.md` to return structured findings (`severity`, `filePath`, `startLine`, `endLine`, `title`, `body`) rather than prose with embedded code quotes. This keeps what flows back into the parent context small. This guidance stays in `review-pr.md`'s prompt, not in the toolkit agent definitions, because `pr-review-toolkit` is not owned by this plugin.

**Re-review logic ownership.** The four Node.js modules in `scripts/re-review/` are already algorithmically platform-agnostic; only their input shapes are ADO-specific. When a second write-back platform (GitHub) is built, normalising to a canonical thread shape and lifting these modules to `pr-review-toolkit` is the correct move. That work is deferred until a second platform consumer exists.

**Alternatives considered:**

_Keep the monolith_ — continue adding to `review-pr.md`. Rejected because the token budget problem compounds with each new feature, and the pre-PR mode would require significant branching inside an already large file.

_Lift re-review modules to pr-review-toolkit now_ — move the four Node.js modules to the toolkit as shared library code. Rejected because there is no second platform consumer yet; any canonical thread schema designed now would be speculative and likely wrong.

_Option B: re-review coordinator as a procedural agent_ — keep re-review logic in a dedicated agent that reasons about edge cases rather than pure procedural code. Accepted in part: the `pr-review:re-review-coordinator` agent replaces the procedural inline steps, but the four Node.js modules remain as pure functions called from it.

## Consequences

- The parent context for a first-review or pre-PR run no longer loads re-review logic.
- Each focused agent only receives the context it needs; intermediate state (prior threads JSON, classification results, diff hunks) does not accumulate in the orchestrator context.
- Adding a fourth operating mode (e.g. post-merge audit) requires only a new agent plus a new branch in the ~200-line orchestrator.
- The three new agents must be documented in the plugin's `CONTEXT.md` under the appropriate relationship entries.

**See also:**

- `docs/issues/pr-review-orchestrator-split/PRD.md` for the feature PRD and implementation issues that deliver this split
- ADR 0008 (soft dependency on `pr-review-toolkit`)
