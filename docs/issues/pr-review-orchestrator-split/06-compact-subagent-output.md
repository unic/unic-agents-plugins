# Add compact sub-agent output guidance to Step 8 prompt

**Status:** needs-triage
**Category:** enhancement

## Parent

`docs/issues/pr-review-orchestrator-split/PRD.md`

## What to build

Update the Step 8 prompt in the thin orchestrator to instruct `pr-review-toolkit` review aspect agents to return compact structured findings rather than prose with embedded code quotes.

The prompt addition instructs each agent to return a JSON array where each element has: `severity` (critical / important / minor), `filePath` (leading `/`, forward slashes), `startLine` (integer), `endLine` (integer), `title` (one line, ≤ 80 chars), `body` (one paragraph — the exact text to post as the ADO or local-interface comment, no code quotes, no repeated context). The reasoning and supporting analysis should stay inside the agent's own context, not appear in the return value.

No changes are made to `pr-review-toolkit` agent definitions — this guidance lives only in the orchestrator's prompt to the agents.

## Acceptance criteria

- [ ] The Step 8 prompt explicitly requests structured JSON findings with the five required fields
- [ ] The prompt instructs agents to omit code quotes and prose reasoning from the return value
- [ ] The ADO Writer agent correctly receives and processes the structured finding schema
- [ ] Pre-PR mode findings are also presented using the same structured schema
- [ ] No `pr-review-toolkit` agent definition files are modified
- [ ] `pnpm format` produces no diff

## Blocked by

- `docs/issues/pr-review-orchestrator-split/04-refactor-orchestrator.md`
