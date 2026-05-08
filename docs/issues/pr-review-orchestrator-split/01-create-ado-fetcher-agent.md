# Create ADO Fetcher agent

**Status:** needs-triage
**Category:** enhancement

## Parent

`docs/issues/pr-review-orchestrator-split/PRD.md`

## What to build

Create a new plugin agent (`pr-review:ado-fetcher`) that encapsulates all Azure DevOps read operations required for a PR review. The agent receives a PR URL (org, project, PR ID) and returns a structured context block containing: PR metadata (title, description, source/target branches, repo ID), latest iteration ID and its commit SHA, prior commit SHA (passed in for re-review, empty for first-review), changed files list, raw diff, and work-item IDs linked to the PR.

This agent replaces the inline ADO shell commands currently scattered across Steps 2–5 of the `review-pr` command. It is invoked by first-review and re-review modes; pre-PR mode never calls it.

The ADO Fetcher and the Doc Context Orchestrator agent must be invocable concurrently — the ADO Fetcher provides the work-item IDs that the Doc Context Orchestrator needs, so the Fetcher runs first, but the Fetcher and Doc Context Orchestrator may overlap in wall-clock time.

## Acceptance criteria

- [ ] The agent accepts PR URL components (org URL, project, PR ID) and returns a structured context block
- [ ] The context block includes PR metadata, latest iteration ID, latest commit SHA, changed files list, and raw diff
- [ ] The context block includes the work-item IDs linked to the PR (empty list if none)
- [ ] The agent handles the case where no iterations are returned (defaults gracefully)
- [ ] The agent handles PRs that are already merged (continues without error)
- [ ] The agent contains no write operations — it is purely a read agent

## Blocked by

None — can start immediately.
