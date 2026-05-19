# Plan — Spec 11: Doc Context Spawn Reliability

## Step 1 — Create agent files

Create both new agent files:
- `.agents/doc-context-orchestrator.md` — full orchestration: work item fetching, credential check (once), Confluence fetching via Confluence Fetcher agents, synthesis delegation
- `.agents/doc-context-synthesizer.md` — flat narrative synthesis: no per-work-item headings, merges overlapping content, returns empty string if nothing gathered

Demo: both files exist with the correct agent structure; orchestrator spawns Work Item Summarizer agents and Confluence Fetcher agents in parallel; synthesizer produces flat `## Business context for this PR` section.

Expected wave:
- task: "Create .agents/doc-context-orchestrator.md and .agents/doc-context-synthesizer.md per spec 11 contracts"

## Step 2 — Rewrite step 4a in commands/review-pr.md

Replace the current step 4a prose with the fixed implementation:
- `DOC_CONTEXT=''` as the very first statement
- Pre-fetch work item IDs in bash (decide whether to spawn at all)
- Resolve `CONFLUENCE_CLIENT_PATH="${CLAUDE_PLUGIN_ROOT}/scripts/confluence-client.mjs"` in bash
- Wait for the diff from step 5 (step 4a pre-fetch runs concurrently with step 5; orchestrator spawn waits for diff)
- Explicit `Agent(subagent_type: "pr-review:doc-context-orchestrator", prompt: "...")` call with all required context
- Update the parallelism note

Demo: step 4a starts with `DOC_CONTEXT=''`; grep finds explicit Agent() subagent_type call; no relative `scripts/confluence-client.mjs` paths.

Expected wave:
- task: "Rewrite step 4a in commands/review-pr.md — init DOC_CONTEXT, pre-fetch IDs, explicit Agent() spawn"

## Step 3 — Finalize

Run hygiene checks, add CHANGELOG entry, bump patch, mark spec done, commit.

Demo: `pnpm -w check` passes, `pnpm verify:changelog` passes, spec marked done, single commit `feat(spec-11): doc context spawn reliability (vX.Y.Z)`.

Expected wave:
- task: "Finalize spec 11: pnpm -w check, CHANGELOG, bump patch, mark done, commit"
