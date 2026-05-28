# unic-pr-review

A Claude Code Plugin that reviews pull requests in Azure DevOps, enriched with Confluence documentation context and optional Jira work-item context.

## Language

**Plugin**:
The `unic-pr-review` Claude Code Plugin, its manifest, commands, and scripts as a deployable unit.
_Avoid_: extension, add-on, module

**Review**:
The end-to-end act of fetching a PR, analysing its diff, and posting structured findings as ADO comments.
_Avoid_: analysis, audit, scan

**Finding**:
A single observation about the PR — a code issue, a suggestion, or an acknowledgement — with a Severity and a Confidence score.
_Avoid_: comment, remark, note

**Confidence**:
A numeric score (0–1) expressing how certain the Plugin is that a Finding is accurate.
_Avoid_: certainty, score, probability

**Severity**:
A label (critical / major / minor / info) indicating how much a Finding should block merging.
_Avoid_: level, priority, grade

**Intent Brief**:
A short natural-language description of what the PR author intended to achieve, derived from the PR description and Jira work item.
_Avoid_: summary, goal, objective

**Intent Check**:
The step in the Review that verifies the diff actually fulfils the Intent Brief.
_Avoid_: alignment check, goal verification

**Bot Signature**:
The fixed footer appended to every ADO comment posted by the Plugin, identifying it as machine-generated.
_Avoid_: marker, badge, tag

**Iteration**:
One pass of the Review loop: fetch → analyse → post Findings → check for replies.
_Avoid_: run, cycle, round

**Approval Loop**:
The repeated Iteration pattern that waits for all critical Findings to be addressed before signalling readiness to merge.
_Avoid_: polling loop, watch mode

**Mode**:
The operational mode of a Review — `full` (all checks), `quick` (diff only), or `doctor` (preflight only).
_Avoid_: type, level, tier

**Provider**:
The external system the Plugin fetches data from — Azure DevOps (mandatory), Confluence (mandatory), Jira (optional).
_Avoid_: backend, source, service

**Work Item**:
An Azure DevOps or Jira ticket linked to the PR, used to derive the Intent Brief.
_Avoid_: ticket, task, issue (to avoid confusion with GitHub Issues)

**Notice**:
A non-blocking Finding posted as informational only; never prevents merge.
_Avoid_: info, hint, FYI

## Relationships

- A **Review** analyses exactly one PR from exactly one **Provider** (Azure DevOps)
- A **Review** produces zero or more **Findings**, each with a **Severity** and a **Confidence**
- A **Finding** of Severity `info` is always a **Notice**
- An **Intent Brief** is derived from zero or more **Work Items**
- An **Intent Check** references exactly one **Intent Brief**
- A **Review** may run in one or more **Iterations** when the **Approval Loop** is active
- The **Bot Signature** appears on every ADO comment the Plugin posts

## Example dialogue

> **Dev:** "Should the Plugin post a Finding even when Confidence is very low?"
> **Domain expert:** "Below 0.5, a Finding is demoted to Notice — it appears as informational only and never blocks merge."

> **Dev:** "What happens when Jira is not configured?"
> **Domain expert:** "The Plugin silently skips the Work Item enrichment step. The Intent Brief is derived from the PR description alone."
