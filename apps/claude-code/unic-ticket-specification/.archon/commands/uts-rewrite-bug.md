---
description: Rewrite a Bug ticket description using the project's configured Bug template.
argument-hint: <ticket reference or free-text ticket description>
---

# Rewrite description — BUG template

Produce a clean, implementation-ready **Bug** description for this ticket. Do NOT
write anything to the tracker — only produce the draft file.

## Inputs

- Original user input: `$ARGUMENTS`
- **Template: read `templates.bug` from `.archon/ticket-spec.config.yaml`.** This
  is the exact structure to fill in — use it verbatim, do not add or rename
  sections, and keep its heading levels.
- Analysis (gaps, affected code, open questions): read `$ARTIFACTS_DIR/analysis.md`
- Existing ticket (existing path only): read `$ARTIFACTS_DIR/ticket.md` if present.

## Rules

- Preserve any existing useful content from `ticket.md` — do not discard known facts.
- Fill each template section from the analysis. Where information is genuinely
  missing, write `_Open question:_ <what is unknown>` inside the relevant section
  rather than inventing details.
- Keep the exact heading structure and levels from the configured template.

## Output

Write the completed description to **`$ARTIFACTS_DIR/draft-description.md`** (the
ticket body only — no surrounding commentary). Then print a short note listing
which sections still contain open questions.
