# 0023. Spec template format for Ralph-executable specs

**Status:** Accepted (2025-04)

## Context

Ralph Orchestrator needs specs to be unambiguous enough to execute deterministically. An ad hoc format leads to missing context, Ralph pausing for clarification, or incorrect implementations.

## Decision

All specs follow `docs/process/spec-template.md`, which mandates:

- A header block: `Priority`, `Effort`, `Version impact`, `Depends on`, `Touches`
- `## Current behaviour` with exact before-state snapshots (code or CLI output)
- `## Target behaviour` with exact after-state
- `## Implementation steps` with explicit before→after diffs or full file content
- `## Verification` with shell commands and their expected output
- `## Acceptance criteria` as checkboxes
- `## Out of scope` bounding the change

## Consequences

- Specs are longer to write but faster for Ralph to execute without back-and-forth.
- The "Out of scope" section prevents scope creep during automated implementation.
- Specs that deviate from the template may cause Ralph to pause or implement incorrectly.
