# Refactor review-pr.md to thin orchestrator

**Status:** needs-triage
**Category:** enhancement

## Parent

`docs/issues/pr-review-orchestrator-split/PRD.md`

## What to build

Refactor `review-pr.md` into a thin orchestrator of approximately 200 lines. The orchestrator:

1. Validates prerequisites (Azure CLI, `azure-devops` extension, `pr-review-toolkit` availability) — same checks as today, just earlier and shared across all modes.
2. Parses `$ARGUMENTS` for a PR URL. If absent, sets mode to Pre-PR; if present, proceeds to detection.
3. For PR URL cases: invokes the ADO Fetcher agent, then checks for prior Bot Signature threads to determine First-review vs Re-review mode.
4. Logs the detected mode clearly before delegating.
5. For First-review: runs Doc Context Orchestrator + review aspect agents in parallel, collects compact findings, delegates write-back to the ADO Writer agent.
6. For Re-review: runs Doc Context Orchestrator + review aspect agents in parallel, passes findings and prior-thread data to the Re-review Coordinator agent (which handles replies), then passes remaining fresh findings to the ADO Writer agent.
7. Pre-PR mode is a stub at this slice — it detects the mode and prints a "Pre-PR mode not yet implemented" message. Full Pre-PR behaviour is delivered in issue 05.

The `review-pr.md` file must contain no `az devops invoke` shell commands after this refactor — all ADO operations live in the three focused agents. The Bot Signature constants and detection prefix are unchanged. All existing re-review module unit tests must pass.

## Acceptance criteria

- [ ] `review-pr.md` is ≤ 200 lines and contains no `az devops invoke` calls
- [ ] The orchestrator logs the detected mode (Pre-PR / First-review / Re-review) before delegating
- [ ] First-review mode produces the same ADO comment output as the pre-refactor command (full Review Summary + Inline Comments + completion marker)
- [ ] Re-review mode produces the same ADO comment output as the pre-refactor command (classified replies + fresh findings + delta summary + completion marker)
- [ ] Pre-PR mode prints a clear "not yet implemented" message and exits cleanly
- [ ] The ADO Fetcher and Doc Context Orchestrator still run in the correct order (Fetcher first, then both Doc Context and review agents can overlap)
- [ ] The Bot Signature format and detection prefix are unchanged
- [ ] `pnpm test` passes (all re-review module unit tests green)
- [ ] `pnpm format` produces no diff

## Blocked by

- `docs/issues/pr-review-orchestrator-split/01-create-ado-fetcher-agent.md`
- `docs/issues/pr-review-orchestrator-split/02-create-ado-writer-agent.md`
- `docs/issues/pr-review-orchestrator-split/03-create-re-review-coordinator-agent.md`
