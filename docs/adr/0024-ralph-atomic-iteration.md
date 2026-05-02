# 0024. Ralph implements one spec per iteration, then commits and stops

**Status:** Accepted (2025-04)

## Context

Batching multiple specs into one Ralph iteration makes commits hard to review, complicates revert, and makes it harder to resume after a failure.

## Decision

Ralph's loop implements exactly one spec per run, creates one commit, and stops. Loop resumption reads `**Status: done**` markers in spec files to determine the next spec to implement. The loop never modifies `PROMPT.md` or `ralph.yml` to batch specs.

## Consequences

- Each PR from a Ralph run contains one logical unit of work.
- The commit message references the spec number and title.
- Resuming after a failed Ralph run is mechanical: remove the `**Status: done**` marker from the partially-implemented spec and restart.
