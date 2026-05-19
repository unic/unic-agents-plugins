# Context — Spec 11: Doc Context Spawn Reliability

## Source

Spec: `docs/plans/11-doc-context-spawn-reliability.md`
Plugin dir: `apps/claude-code/pr-review/`
Version impact: **patch** (bug fix)

## Problem

Three defects cause the Doc Context phase to be silently skipped on every run:

1. **No explicit Agent() spawn template** — step 4a describes what sub-agents must do in prose. The orchestrator satisfies the intent inline and skips the actual spawn.
2. **Relative path to confluence-client.mjs** — `node scripts/confluence-client.mjs` resolves against the reviewed project's root, not the plugin dir.
3. **DOC_CONTEXT never initialized** — no `DOC_CONTEXT=''` at the top of step 4a; undefined variable makes silent failure invisible.

## Fix strategy

Extract the entire Doc Context gathering into a dedicated **Doc Context Orchestrator** agent that:
- Is spawned via an explicit `Agent(subagent_type: "pr-review:doc-context-orchestrator", ...)` call in step 4a
- Receives all required context as literal strings (agents don't inherit env vars)
- Runs work item fetching, credential check (once), Confluence fetching, and synthesis in its own context window
- Returns its output verbatim as the `DOC_CONTEXT` string

## Acceptance criteria (from spec)

- [ ] `DOC_CONTEXT=''` is the first statement in step 4a
- [ ] Step 4a contains an explicit `Agent(subagent_type: "pr-review:doc-context-orchestrator", ...)` call with all required context
- [ ] All paths to `confluence-client.mjs` in agent prompts are absolute strings resolved from `${CLAUDE_PLUGIN_ROOT}`
- [ ] The orchestrator agent runs the credential check exactly once
- [ ] Bug work items use `ReproSteps` + `SystemInfo`; all other types use `System.Description`
- [ ] The Doc Context Synthesizer agent produces a flat narrative with no per-work-item headings
- [ ] ADR-0012 is committed alongside the implementation (already exists)

## Already done

- `docs/adr/0012-plain-text-doc-context-agent-return.md` — exists and correct
- `docs/plans/README.md` — spec 11 row already present (status: open)

## Files to create

- `.agents/doc-context-orchestrator.md`
- `.agents/doc-context-synthesizer.md`

## Files to modify

- `commands/review-pr.md` — rewrite step 4a: init DOC_CONTEXT='', pre-fetch work item IDs in bash, wait for diff, delegate to orchestrator agent via explicit Agent() call
- `CHANGELOG.md` — add Fixed entry under [Unreleased]

## Key design constraints

- Orchestrator receives `CONFLUENCE_CLIENT_PATH` as an absolute literal string (pre-expanded from `${CLAUDE_PLUGIN_ROOT}`)
- Credential check runs exactly once in the orchestrator (not per-fetcher or per-work-item)
- Bug work items → `Microsoft.VSTS.TCM.ReproSteps` + `Microsoft.VSTS.TCM.SystemInfo`
- All other work item types → `System.Description`
- Synthesizer produces flat narrative: no per-work-item headings, no redundant content
- If no context gathered: return empty string
