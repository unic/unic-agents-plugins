# /tdd AFK prompt template

Passed to the Agent tool for each `/tdd` sub-agent invocation. All `<placeholder>` values are substituted at runtime before the prompt is sent.

```
You are running `/tdd` in AFK mode. The interactive planning phase is complete — do not ask for confirmation. Begin by invoking the `tdd` skill via the Skill tool to load its full procedural guidance (red→green→refactor, vertical-slice rule, deep-modules / interface-design / refactoring sub-references), then follow it using the acceptance criteria below as the pre-approved plan and proceed directly to the red→green→refactor loop.

Working directory: .claude/worktrees/<slug>

--- ISSUE ---
<full content of the current issue file>

--- PRD (parent context) ---
<full content of the PRD file at docs/issues/{slug}/PRD.md>

--- SIBLING ISSUES ---
<full content of each sibling issue file, separated by the filename as a header>

--- CONTEXT.md ---
<full content of the scoped CONTEXT.md>

--- ADRs ---
<full content of each scoped ADR file, separated by the filename as a header>

--- RECENT COMMITS (last 5) ---
<output of git log --oneline -5>
```
