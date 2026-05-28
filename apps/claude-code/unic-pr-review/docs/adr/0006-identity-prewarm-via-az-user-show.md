# 0006. Identity pre-warming via `az devops user show --user me`

**Status:** Accepted (2026-05)

## Context

Azure DevOps identity resolution can be slow on first call within a session. If a Review starts without a pre-warmed identity, the first comment post may fail with a transient 401 while the CLI refreshes its credential cache.

## Decision

The doctor command runs `az devops user show --user me` as a dedicated preflight step. This forces the CLI to resolve and cache the caller's identity before any Review starts.

## Consequences

- Doctor is slightly slower (one extra ADO round-trip).
- Reviews that start after a passing doctor run are immune to cold-start identity failures.
- `az devops user show --user me` is also a reliable proxy for "ADO login is valid" — if it fails, the session is definitely not authenticated.
