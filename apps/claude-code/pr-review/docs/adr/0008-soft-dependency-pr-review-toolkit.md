# 0008. Soft dependency on pr-review-toolkit — abort with install instructions, never vendor

**Status:** Accepted (2025-04)

## Context

The pr-review plugin uses specialised sub-agents from `pr-review-toolkit`. Bundling the toolkit inside pr-review would couple their release cycles and inflate the plugin size.

## Decision

`pr-review` declares a soft dependency on `pr-review-toolkit`. On startup, the plugin checks whether the toolkit is installed. If not, it aborts and prints installation instructions. It never vendors or copies toolkit code.

## Consequences

- Users must install `pr-review-toolkit` separately.
- Toolkit upgrades (new agent types, improved prompts) are available to pr-review without a pr-review release.
- The startup check adds a small latency on every invocation.
