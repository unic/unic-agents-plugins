# 0001. Hook script always exits 0

**Status:** Accepted (2025-04)

## Context

The auto-format hook runs as a Claude Code `PostToolUse` hook after every file edit. If the hook exits non-zero, Claude Code treats the tool call as failed and may retry or abort the session.

## Decision

The hook script always exits 0, even when a formatter fails. Formatter errors are reported to stderr (visible in Claude Code's hook output) but do not block the tool flow.

## Consequences

- Formatter failures are surfaced as warnings, not as tool failures.
- Claude Code sessions are never blocked by a misconfigured formatter.
- Silent failures are possible if the user does not monitor hook output; this is an accepted trade-off.
