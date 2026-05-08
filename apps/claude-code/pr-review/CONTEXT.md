# pr-review

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

## Relationships

- A **Review** produces one **Review Summary**, zero or more **Inline Comments**, and zero or more **General Comments**
- An **Inline Comment** and a **General Comment** each open a new **Review Thread**
- A **Re-review** performs **Thread Classification** on existing **Review Threads** before opening new ones
- A **Reply** is added to an existing **Review Thread** — it does not open a new one
- The **Bot Signature** is present on every comment authored by the Plugin, enabling prior-review detection
- A **Revision** is the code snapshot a **Review** or **Re-review** analyses
- A **Doc Context** is assembled by one or more **Doc Context Sub-agents** before the Review phase and injected into every Review Aspect agent
- A **Doc Context Sub-agent** operates on a single source (work item or Confluence page) and receives the changed files list and the local diff when available

## Example dialogue

> **Dev:** "During a Re-review, do we post a new Review Summary or update the existing one?"
> **Domain expert:** "We rewrite the existing one — a PR should never have more than one Review Summary."

> **Dev:** "What do we do with a pending thread when the Revision hasn't changed that area?"
> **Domain expert:** "Leave it as pending. It stays open until the author fixes the code or the relevant code is deleted or moved."

> **Dev:** "How do we know which Threads were opened by us vs the author?"
> **Domain expert:** "The Bot Signature — every Plugin comment ends with it. No signature means it's not ours."
