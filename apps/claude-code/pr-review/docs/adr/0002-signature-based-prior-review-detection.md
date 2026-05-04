# 0002. Prior review detected by signature substring match, not by API metadata

**Status:** Accepted (2025-04)

## Context

Azure DevOps does not expose a first-class "bot author" field on comments. Alternatives to signature matching (author ID, comment type) are either unavailable or unreliable across ADO versions.

## Decision

The plugin detects a prior review by fetching all PR comments and checking whether any contains the canonical bot signature (see ADR-0001). If found, the run is classified as a re-review.

## Consequences

- Detection is O(N) in the number of PR comments.
- Works across all ADO versions without API-level bot identity.
- A human who includes the signature string in a comment will trigger a false re-review detection.
