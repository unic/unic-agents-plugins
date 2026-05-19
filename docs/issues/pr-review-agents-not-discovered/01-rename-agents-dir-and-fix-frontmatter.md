---
title: "pr-review: rename .agents/ → agents/ and add name: field to agent frontmatter"
created: 2026-05-19
---

**Status:** resolved
**Category:** bug
**Plugin:** `apps/claude-code/pr-review`
**Depends on:** —

## Problem Statement

`pr-review:ado-fetcher` (and all other `pr-review` plugin agents) fail at runtime with:

```
Error: Agent type 'pr-review:ado-fetcher' not found.
```

**Root cause:** Claude Code's agent discovery scans an `agents/` directory inside each plugin. The `pr-review` plugin stores its agent files in `.agents/` (dot-prefixed, hidden on Unix), which is never scanned. The `pr-review-toolkit` plugin — which works correctly — uses `agents/` (no dot).

**Secondary issue:** The `pr-review-toolkit` agent files declare a `name:` field in their YAML frontmatter (e.g. `name: code-reviewer`). The `pr-review` agent files only have `allowed-tools` and `description`. Whether the missing `name:` field is independently load-bearing is uncertain; it is added here defensively to match the working convention.

**Evidence:**
- Working: `~/.claude/plugins/cache/claude-plugins-official/pr-review-toolkit/unknown/agents/code-reviewer.md`
- Broken: `~/.claude/plugins/cache/unic-agent-plugins/pr-review/1.2.10/.agents/ado-fetcher.md`

## Affected files

| File | Change |
|------|--------|
| `apps/claude-code/pr-review/.agents/` (directory) | Rename to `agents/` |
| `apps/claude-code/pr-review/.agents/ado-fetcher.md` | Add `name: ado-fetcher` to frontmatter |
| `apps/claude-code/pr-review/.agents/ado-writer.md` | Add `name: ado-writer` to frontmatter |
| `apps/claude-code/pr-review/.agents/re-review-coordinator.md` | Add `name: re-review-coordinator` to frontmatter |
| `apps/claude-code/pr-review/.agents/doc-context-orchestrator.md` | Add `name: doc-context-orchestrator` to frontmatter |
| `apps/claude-code/pr-review/.agents/doc-context-synthesizer.md` | Add `name: doc-context-synthesizer` to frontmatter |
| `apps/claude-code/pr-review/CLAUDE.md` | Update repository layout section: `.agents/` → `agents/` |
| `apps/claude-code/pr-review/docs/adr/0013-orchestrator-split-for-review-pr.md` | Amend in place: fix `.agents/` → `agents/` in the "Three focused agents live in…" paragraph |
| `CHANGELOG.md` | Add patch entry |
| `.claude-plugin/plugin.json` + `marketplace.json` | Bump patch version |

Do **not** update historical plan files (`docs/plans/`) — those are already-executed specs and are left as written.

## Implementation steps

1. Rename the directory: `git mv apps/claude-code/pr-review/.agents apps/claude-code/pr-review/agents`
2. Add `name: <slug>` as the first frontmatter key in each of the five agent files (use the filename stem as the value, e.g. `name: ado-fetcher`).
3. Update the repository layout table in `CLAUDE.md`: change `.agents/` → `agents/` in the directory tree and in any prose that names the directory.
4. Amend ADR 0013 in place: change the one occurrence of `the plugin's \`.agents/\` directory` to `the plugin's \`agents/\` directory`. No status or consequence lines need changing.
5. Add a `CHANGELOG.md` entry and bump the patch version in `plugin.json` + `marketplace.json`.

## Verification

After implementing, verify the fix end-to-end:

1. **Cache invalidation check** — it is unknown whether the directory-source marketplace re-reads from the repo live or serves from the `~/.claude/plugins/cache/` snapshot. After renaming, check whether `~/.claude/plugins/cache/unic-agent-plugins/pr-review/<version>/.agents/` still exists. If it does, manually remove it (or delete and re-add the `pr-review@unic` entry in `enabledPlugins`) to force a fresh cache read.
2. **Agent discovery** — restart Claude Code and confirm `pr-review:ado-fetcher` appears in the available agent list (the list shown in the error message is a reliable source of truth).
3. **End-to-end smoke test** — run `/pr-review:review-pr` against a real ADO PR URL and confirm the ADO Fetcher agent launches without the "not found" error.

## Acceptance criteria

- `pr-review:ado-fetcher`, `pr-review:ado-writer`, `pr-review:re-review-coordinator`, `pr-review:doc-context-orchestrator`, and `pr-review:doc-context-synthesizer` all appear in Claude Code's available agent list after the rename.
- Running `/pr-review:review-pr <ADO-PR-URL>` reaches at least Step 5 (ADO Fetcher launch) without an "Agent type not found" error.
- No references to `.agents/` remain in `CLAUDE.md` or `docs/adr/0013-*`.
- ADR 0013 retains its original status and all consequence lines; only the directory name is corrected.
