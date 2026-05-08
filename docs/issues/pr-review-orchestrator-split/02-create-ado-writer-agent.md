# Create ADO Writer agent

**Status:** needs-triage
**Category:** enhancement

## Parent

`docs/issues/pr-review-orchestrator-split/PRD.md`

## What to build

Create a new plugin agent (`pr-review:ado-writer`) that encapsulates all Azure DevOps write-back operations for a PR review. The agent receives: PR context (org URL, project, repo ID, PR ID, latest iteration ID, summary thread ID), a list of compact findings, and a mode flag (first-review or re-review).

For each finding it posts a new Inline Comment thread to ADO. After all findings are posted it posts the Review Summary on first-review, or a delta reply to the existing summary thread on re-review. As its final action it posts the completion marker reply to the summary thread.

The compact finding schema the agent accepts: `{ severity, filePath, startLine, endLine, title, body }`. Every comment posted must end with the canonical Bot Signature trailer `---\n🤖 *Reviewed by Claude Code* — Iteration N`.

This agent is used by both first-review and re-review modes. It is not invoked in pre-PR mode.

## Acceptance criteria

- [ ] The agent posts one Inline Comment thread per finding at the correct file path and line range
- [ ] Each posted comment ends with the canonical Bot Signature including the iteration number
- [ ] On first-review, the agent posts a full Review Summary as a new general thread
- [ ] On re-review with at least one new finding, the agent posts a delta reply to the existing summary thread
- [ ] On re-review with zero new findings, the agent skips the summary reply
- [ ] The agent posts a completion marker reply (`✅ Review complete — Iteration N`) to the summary thread as its final action
- [ ] If `threadContext` is rejected by ADO (file not in diff), the agent retries without `threadContext` (general comment fallback)
- [ ] The agent returns the final `SUMMARY_THREAD_ID` and `FINDINGS_POSTED` count to the caller

## Blocked by

None — can start immediately.
