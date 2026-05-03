---
allowed-tools: ['Read', 'Write', 'Bash']
argument-hint: '<one-liner idea>'
description: 'Capture a raw idea into docs/inbox/ without interrupting the current conversation'
---

# Inbox capture

**Arguments:** "$ARGUMENTS"

Capture the idea in `$ARGUMENTS` as a file in `docs/inbox/`. Act immediately — no follow-up
questions.

## Step 1 — Generate a slug

From the idea text:

1. Lowercase everything
2. Replace spaces and punctuation with hyphens
3. Collapse multiple hyphens into one
4. Strip leading/trailing hyphens
5. Truncate to 50 characters at a word boundary

Example: "pr-review should support GitLab!" → `pr-review-should-support-gitlab`

## Step 2 — Check for collisions

```bash
ls docs/inbox/<slug>.md 2>/dev/null
```

If the file exists, append `-2` (then `-3`, etc.) until the path is free.

## Step 3 — Write the file

Create `docs/inbox/<slug>.md`:

```markdown
---
title: <original idea text, trimmed>
created: <today's date as YYYY-MM-DD>
---

<original idea text, trimmed>
```

Use the `Write` tool. Do not create any other files.

## Step 4 — Confirm

Reply with exactly one line:

```txt
Captured → docs/inbox/<slug>.md
```

Nothing else. No summary, no next steps, no follow-up questions. The user is in the middle
of something else.
