# Step 02 — `/handoff` workflow (NEW)

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** Smallest unit — a good warm-up that exercises the new conventions end-to-end.

## Goal
Port Matt's `handoff` skill (`.agents/skills/handoff/SKILL.md`) into a `unic-dlc-handoff` Archon workflow + `/unic-archon-dlc:handoff` command: compact the current conversation into a throwaway handoff doc so a fresh session can continue.

## Task
- Author the workflow in the **confirmed Archon schema** (step 00). Likely a single prompt node — no gates.
- Behaviour (from Matt): write the handoff doc to the **OS temp dir** (not the repo); reference durable artifacts (PRD, issues, ADRs, commits) by path/URL rather than duplicating; include a "suggested skills" section; redact secrets; tailor to the next session's focus if an argument is passed.
- Add the command stub in `.archon/commands/` and register per the plugin's pattern.

## Open questions to grill first
- Does this belong as an Archon *workflow* at all, or only a Claude Code *skill/command*? (Matt's is a skill; Archon workflows run in worktrees, which a conversation-compaction step doesn't need.) Decide and record.
- Temp-dir path strategy cross-platform (`node:os.tmpdir()`).

## Done when
A handoff doc can be generated for a fresh session, it references (not duplicates) artifacts, secrets are redacted, and it runs on the target Archon schema. PR to `develop`.

## Suggested skills
`/archon`, reference `.agents/skills/handoff/SKILL.md`.
