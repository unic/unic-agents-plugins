# 0005. Existing threads classified into four states: addressed, disputed, pending, obsolete

**Status:** Accepted (2025-04)

## Context

A re-review must handle existing comment threads intelligently: resolving issues that were fixed, escalating issues that were disputed, and carrying forward issues still outstanding. A shared taxonomy is needed for the reply and summary phases to make consistent decisions.

## Decision

Each existing bot thread is classified into one of four states:

- **addressed**: the issue was fixed in the new diff
- **disputed**: the reviewer replied disagreeing with the bot comment
- **pending**: no action taken; issue still exists in the new diff
- **obsolete**: the relevant code was deleted or moved; the comment no longer applies

## Consequences

- The classification taxonomy must remain stable across plugin versions.
- Adding a fifth state is a minor version bump (new feature, backwards-compatible).
- Classification accuracy depends on the review agent's analysis; false classifications are possible.
