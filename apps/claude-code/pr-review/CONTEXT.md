# pr-review

> Deprecated — superseded by `unic-pr-review`. Frozen; no new work.

A Claude Code Plugin that analyses pull requests across multiple dimensions and posts findings back as comments. Currently targets Azure DevOps; designed to be Platform-agnostic.

## Language

### Platforms and PRs

**Platform**:
The VCS hosting service where pull requests live — currently Azure DevOps, with GitHub and GitLab planned.
_Avoid_: provider, host, VCS (too generic)

**Revision**:
A snapshot of the PR's code at a point in time. Platform-agnostic term for what each Platform calls differently: ADO calls it an Iteration, GitHub calls it a push, GitLab calls it a version.
_Avoid_: Iteration (ADO-specific), push (GitHub-specific), version (GitLab-specific)

### Review output

**Review**:
A full analysis of a PR, producing Inline Comments, a Review Summary, and zero or more General Comments. Covers all Review Aspects.
_Avoid_: scan, audit, check

**Re-review**:
An incremental Review targeting only the delta since the last Review. Reuses existing Review Threads where possible rather than opening new ones.
_Avoid_: follow-up review, second pass, incremental review

**Review Aspect**:
A named dimension of analysis that a Review covers — e.g. code quality, error handling, test coverage, comment accuracy, type design. Each Aspect is run by a separate agent in parallel.
_Avoid_: category, check, dimension

**Review Summary**:
A General Comment posted by the Plugin that aggregates the findings of a Review or Re-review. Rewritten in-place during a Re-review rather than posted anew.
_Avoid_: summary comment, overview comment

### Comments and threads

**Inline Comment**:
A review comment attached to a specific file and line within a PR.
_Avoid_: line comment, file comment

**General Comment**:
A PR-level comment not tied to any file or line.
_Avoid_: top-level comment, PR comment

**Thread**:
A Platform-native grouping of a top-level comment and its Replies.
(ADO: `pullRequestThread`; GitHub: review thread; GitLab: discussion)
_Avoid_: conversation, discussion (conflicts with GitLab's term)

**Review Thread**:
A Thread opened by the pr-review Plugin.
_Avoid_: bot thread, plugin thread

**Reply**:
A follow-up comment added by the Plugin to an existing Thread during a Re-review.
_Avoid_: response, follow-up comment

**Bot Signature**:
A fixed text marker appended to every Plugin-authored comment, used to identify Review Threads and Replies created by this Plugin.
_Avoid_: watermark, marker, signature

### Doc context enrichment

**Doc Context**:
A synthesised, flat narrative of the business intent behind a PR — what the change is supposed to accomplish and why, drawn from linked work items and Confluence pages. Injected as a preamble into each Review Aspect agent's prompt so it can judge whether the code is not only correct but meaningful relative to the specifications.
_Avoid_: ticket context, background info, extra context, aggregated summaries

**Doc Context Sub-agent**:
A short-lived agent spawned to fetch and summarise a single source — either a work item description or a Confluence page — in a diff-aware way. Multiple Doc Context Sub-agents run in parallel; their outputs are passed to the Doc Context Synthesizer.
_Avoid_: context agent, doc agent, fetcher agent

**Doc Context Synthesizer**:
The agent responsible for taking all Doc Context Sub-agent outputs (work item and Confluence summaries, potentially overlapping) and producing a single coherent Doc Context narrative with no redundant content.
_Avoid_: merger, aggregator, deduplicator

**Doc Context Orchestrator**:
A self-contained plugin agent that orchestrates the entire Doc Context gathering phase — fetching work item details, running the Confluence credential check once, spawning Work Item Summarizer and Confluence Fetcher agents in parallel, and delegating final synthesis to the Doc Context Synthesizer. Returns the Synthesizer's output verbatim as a plain markdown string.
_Avoid_: context orchestrator, doc orchestrator, gathering agent

### Operating modes

**Pre-PR mode**:
A Review run without a PR URL, targeting a local branch diff. No ADO write-back occurs; findings are presented in the Claude interface only.
_Avoid_: local review, offline review, draft review

**First-review mode**:
A Review run against an ADO PR where no prior Bot Signature is found. Produces a full set of Inline Comments and a Review Summary posted to ADO.
_Avoid_: initial review, fresh review

**Re-review mode**:
A Review run against an ADO PR where a prior **Bot Signature** is found in the PR's threads. Focuses on commits since the last Review, performs Thread Classification, and replies to or resolves existing Review Threads rather than duplicating them.
_Avoid_: incremental review, follow-up review, second pass

**Dry-run mode**:
A Review run against an ADO PR with the `--dry-run` flag. Identical to first-review / re-review for every read-side step — **ADO Fetcher**, **Doc Context Orchestrator**, all Review Aspect agents, and (when prior signature is found) the **Re-review Coordinator's** Thread Classification — but the **ADO Writer** is never invoked. Findings are rendered in the Claude interface using the same severity-grouped format as Pre-PR mode. Used to preview what a Review or Re-review would post before committing to write-back.
_Avoid_: preview review, simulated review, no-post review

### Orchestration agents

**ADO Fetcher**:
A plugin agent that retrieves PR metadata, iterations, PR threads, changed files, and the raw diff from Azure DevOps — and determines the Review mode from the thread data. All ADO read operations for a PR review are owned here; the orchestrator makes no inline ADO read calls.
_Avoid_: fetcher, data agent, ADO client

**Re-review Coordinator**:
A plugin agent that owns the full re-review state machine — prior thread detection, partial-run check, Thread Classification, finding matching, and reply posting to classified threads. Invoked only in re-review mode.
_Avoid_: re-review agent, rereview handler

**ADO Writer**:
A plugin agent responsible for all ADO write-back operations — posting Inline Comments, patching thread status, and posting the Review Summary or delta reply. Used by first-review and re-review modes.
_Avoid_: writer agent, comment poster, ADO publisher

### Re-review classification

**Thread Classification**:
The process of categorising existing Review Threads during a Re-review to decide how to handle each one.
_Avoid_: thread analysis, thread triage

**addressed**:
A Thread Classification state. The issue was fixed in the new diff.

**disputed**:
A Thread Classification state. The reviewer replied disagreeing with the bot comment.

**pending**:
A Thread Classification state. No action taken; the issue still exists in the new diff.

**obsolete**:
A Thread Classification state. The relevant code was deleted or moved; the comment no longer applies.

### Platform-failure handling

**Notice**:
A user-facing message emitted by an orchestration agent when a Review operation completed in a non-OK Notice Tier. Carries `severity` (`info` or `warning`), `kind` (a small enum identifying the failed operation), and a one-line `message`. Notices are merged across agents by the orchestrator, rendered in the Review Summary, included in the end-of-run Trailer, and (for Pre-PR mode) printed in the Claude interface before findings.
_Avoid_: warning, error, log line

**Notice Tier**:
A four-state classification of every Review operation outcome: **OK**, **EMPTY-BY-DESIGN**, **DEGRADED**, **ABORTED**. The tier choice IS the gating decision — there is no fifth "ask the user" tier. Failure modes that tempt one are reclassified as ABORTED.

**OK**:
A Notice Tier. The operation completed with a non-empty result. No Notice emitted.

**EMPTY-BY-DESIGN**:
A Notice Tier. The operation completed with an empty result that is a legitimate domain state (no work-items linked, no Confluence pages, no prior threads). Currently emits an `info` Notice only for the Doc Context family; other empty states are inherent to the Review type and stay silent.

**DEGRADED**:
A Notice Tier. The operation failed but the Review can still complete with reduced coverage. Emits a `warning` Notice; the Review still posts.

**ABORTED**:
A Notice Tier. The operation failed and continuing would corrupt cross-run state (Bot Signature drift, Summary thread desync, mode misdetection). The run stops before the Review Summary is composed; the failure goes to stderr plus the end-of-run Trailer.

**Trailer**:
A single end-of-run line printed by the orchestrator to the Claude interface, regardless of mode or success state. Carries findings count by severity, Notice counts by severity, and (for ADO modes) the PR URL. Designed for AFK skim: the invoker sees outcome status without opening the PR.

## Relationships

- A **Review** produces one **Review Summary**, zero or more **Inline Comments**, and zero or more **General Comments**
- An **Inline Comment** and a **General Comment** each open a new **Review Thread**
- A **Re-review** performs **Thread Classification** on existing **Review Threads** before opening new ones
- A **Reply** is added to an existing **Review Thread** — it does not open a new one
- The **Bot Signature** is present on every comment authored by the Plugin, enabling prior-review detection
- A **Revision** is the code snapshot a **Review** or **Re-review** analyses
- A **Doc Context** is assembled via a three-tier pipeline: the **Doc Context Orchestrator** spawns **Work Item Summarizer** and **Confluence Fetcher** agents (Doc Context Sub-agents) in parallel, then delegates their outputs to the **Doc Context Synthesizer**, which produces the final `DOC_CONTEXT` narrative injected into every Review Aspect agent
- A **Doc Context Sub-agent** operates on a single source (work item or Confluence page) and receives the changed files list and the local diff when available
- The **Doc Context Orchestrator** returns the **Doc Context Synthesizer**'s output verbatim; it does not rewrite or reformat the narrative
- The **ADO Fetcher** is invoked by first-review, re-review, and dry-run modes; **Pre-PR mode** skips it entirely and goes directly to Review Aspect agents
- The **Re-review Coordinator** is invoked when the mode is re-review or a dry-run that detected a prior **Bot Signature**; first-review, pre-PR, and dry-run-on-fresh-PR modes never load it. In dry-run mode the Coordinator performs Thread Classification but its results feed only the rendered output — no Replies are posted
- The **ADO Writer** is invoked by first-review and re-review modes; **Pre-PR mode** and **Dry-run mode** do not write back to ADO
- Every operation in an orchestration agent terminates in one of the four **Notice Tiers**. **DEGRADED** and **EMPTY-BY-DESIGN**-with-message operations emit a **Notice** that flows from the agent's structured result block, through the orchestrator's merge step, into the **Review Summary** (for ADO modes) or the printed pre-findings block (for **Pre-PR mode**). The end-of-run **Trailer** carries Notice counts so the invoker sees them without opening the PR.

## Example dialogue

> **Dev:** "During a Re-review, do we post a new Review Summary or update the existing one?"
> **Domain expert:** "We rewrite the existing one — a PR should never have more than one Review Summary."

> **Dev:** "What do we do with a pending thread when the Revision hasn't changed that area?"
> **Domain expert:** "Leave it as pending. It stays open until the author fixes the code or the relevant code is deleted or moved."

> **Dev:** "How do we know which Threads were opened by us vs the author?"
> **Domain expert:** "The Bot Signature — every Plugin comment ends with it. No signature means it's not ours."
