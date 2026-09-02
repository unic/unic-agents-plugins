---
description: Persist the proposed ticket content (description + PERT estimate + open questions) to a stable local .md file before the approval gate.
argument-hint: <ticket reference or free-text ticket description>
---

# Persist ticket content locally

Write the full proposed ticket content to a **stable local file** so the
workflow's result is never lost — even if the approval gate is rejected or a
later step fails. This runs BEFORE the gate. Do not write anything to the tracker
here.

## Inputs (read these)

- Config: `.archon/ticket-spec.config.yaml` (for `output.dir`)
- Target (JSON: `mode`, `tracker`, `project_key`, `project_name`, `key`): `$ARTIFACTS_DIR/target.json`
- Classification (JSON: `kind`, `issue_type_name`): `$classify.output`
- Proposed description: `$ARTIFACTS_DIR/draft-description.md`
- PERT estimate: `$ARTIFACTS_DIR/estimate.md`
- Completeness + open questions: `$ARTIFACTS_DIR/completeness.md`

## Where to write

Output directory = `output.dir` from the config (default `ticket-spec-output`),
resolved **relative to the working directory** (the project root). Use
forward-slash paths so this is identical on Windows and macOS; the Write tool
creates parent folders. Do NOT hardcode an absolute or OS-specific path.

Filename:

- Existing ticket (`mode == existing`): a filesystem-safe form of the reference,
  e.g. `<KEY>.md` (`ACME-1234.md`) or `issue-<number>.md` for numeric refs.
- New ticket (`mode == create`): `NEW-<short-kebab-slug-of-summary>-$WORKFLOW_ID.md`.

After writing, also write the **path of the file you created** (the same
forward-slash relative path) to `$ARTIFACTS_DIR/local-output-path.txt` (a single
line, no trailing text) so downstream nodes update the same file.

## File contents

```
# Ticket specification — <summary / title>

- Run: $WORKFLOW_ID
- Status: DRAFT — pending approval (not yet written to the tracker)
- Tracker: <tracker>
- Action: <create a new {issue_type_name} in {project_key} ({project_name})  |  update {key}>
- Issue type: <issue_type_name> (kind <kind>)

## Proposed description

<full verbatim contents of draft-description.md>

## PERT estimate

<full verbatim contents of estimate.md>

## Completeness & open questions

<full verbatim contents of completeness.md>
```

After writing both files, print the path of the persisted .md to your output.
