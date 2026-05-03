# Inbox

A low-friction capture zone for raw ideas, bugs, questions, and anything else that pops up mid-conversation and shouldn't be lost. Items here have not yet been grilled, scoped, or assigned a feature slug.

## How to add an item

Run `/inbox <one-liner>` in Claude Code. That's it.

```
/inbox pr-review should support GitLab
/inbox unic-confluence image upload support
/inbox investigate windows path issue in auto-format
```

A file is created at `docs/inbox/<slug>.md`. No follow-up needed.

## File format

```markdown
---
title: pr-review should support GitLab
created: 2026-05-03
---

pr-review should support GitLab
```

No `status` field — the location is the status. Every file here is awaiting triage.

## Graduation

When you're ready to act on an item:

1. Open the file and run `/grill-with-docs` or `/grill-me` to refine it
2. Run `/to-prd` to synthesise into a PRD → creates `docs/issues/<slug>/PRD.md`
3. Delete the inbox file (or let the skill handle it)

Items do **not** move to `docs/issues/<slug>/` until a scope and slug have been agreed via grilling.

## Related

- `docs/agents/issue-tracker.md` — conventions for structured issues post-grilling
- `docs/agents/triage-labels.md` — 8-state vocabulary used in `docs/issues/` (not here)
