# 0001. Canonical bot signature is the session identity contract

**Status:** Accepted (2025-04)

## Context

The plugin posts review comments on pull requests. Subsequent runs must distinguish their own prior comments from human comments to avoid duplication, enable incremental reviews, and rewrite the summary comment rather than appending.

## Decision

Every comment posted by the plugin ends with a fixed signature line (e.g. `Reviewed by Claude Code`). This exact string is the identity contract: future runs detect prior reviews and comments by substring-matching on this signature.

## Consequences

- The signature string must never change between plugin versions (breaking change).
- Human reviewers who accidentally include the signature string in their comments will be misidentified as bot comments.
- The signature is the only identity mechanism; there is no API-level "bot author" field.
