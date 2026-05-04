# 0004. Per-project config merges over plugin defaults

**Status:** Accepted (2025-04)

## Context

Some projects need to disable specific formatters or file extensions. Without an override mechanism, users would have to fork the plugin.

## Decision

The plugin reads an optional `.claude/unic-format.json` in the consumer project root. Settings in this file merge over the plugin defaults, allowing users to opt out of specific tools or add extension sets without modifying the plugin.

## Consequences

- The plugin behaviour is customisable per project without a fork.
- The config schema must be documented and versioned.
- The hook must validate the consumer config and fail gracefully on schema errors.
