---
description: Rewrite a Change Request / Story ticket description using the project's configured CR/Story template.
argument-hint: <ticket reference or free-text ticket description>
---

# Rewrite description — CHANGE REQUEST / STORY template

Produce a clean, implementation-ready **Change Request / Story** description for
this ticket. Do NOT write anything to the tracker — only produce the draft file.

## Inputs

- Original user input: `$ARGUMENTS`
- **Template: read `templates.cr_story` from `.archon/ticket-spec.config.yaml`.**
  This is the exact structure to fill in — use it verbatim, do not add or rename
  sections, and keep its heading levels.
- Analysis (gaps, affected code, open questions): read `$ARTIFACTS_DIR/analysis.md`
- Existing ticket (existing path only): read `$ARTIFACTS_DIR/ticket.md` if present.

## Rules

- Preserve any existing useful content from `ticket.md` — do not discard known facts.
- Fill each template section from the analysis. Where information is genuinely
  missing, write `_Open question:_ <what is unknown>` inside the relevant section
  rather than inventing details.
- If the template contains a user-story line (`As a <role> I can <capability>, so
that <benefit>`), replace the placeholders with concrete values from the
  analysis.
- Derive testable `Acceptance Criteria` from the analysis and affected code areas.
- Keep the exact heading structure and levels from the configured template.

## ToDo vs. Suggested Technical Tasks — TWO DISTINCT AUDIENCES

If the template has both a `ToDo` and a `Suggested Technical Tasks` section, they
serve different readers and MUST NOT be the same list at different indentation.

**`ToDo` — the scope list (for POs / non-developers).**

- Plain-language summary of _what needs to be done_ and _which parts of the
  solution are touched_, so a reader familiar with the project (but not the code)
  can gauge the ticket's scope and size.
- Group by area / component (e.g. **Middleware**, **StoreFront**,
  **Verification**) with a short checkbox item per piece of work.
- **No file paths, no line numbers, no class/method names, no code identifiers.**
  Describe the change in functional terms ("Map the external customer ID onto
  the outgoing order messages"), not how to implement it.
- A handful of items per area — enough to understand scope, not a task tracker.

**`Suggested Technical Tasks` — the implementation guide (for developers).**

- The detailed, concrete engineering steps: the specific files, line references,
  classes/methods, and the exact change in each.
- Group by repository / component (name the repo, e.g.
  `web-frontend` (TS), `cms-backend` (C#)).
- Cite `repo:file_path:line` from the analysis. Include test additions and any
  explicit "verify, no code change expected" checks.
- This is the level of detail the workflow produced previously — keep it here, do
  NOT water it down. It simply moves out of `ToDo`.

Every technical task should roll up to one of the higher-level `ToDo` items, so
the two sections stay consistent. Where implementation detail is genuinely
unknown, use `_Open question:_ …` rather than inventing file paths.

## Output

Write the completed description to **`$ARTIFACTS_DIR/draft-description.md`** (the
ticket body only — no surrounding commentary). Then print a short note listing
which sections still contain open questions.
