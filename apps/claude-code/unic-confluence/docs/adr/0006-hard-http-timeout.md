# 0006. Hard HTTP timeout on every Confluence API request

**Status:** Accepted (2025-04)

## Context

Corporate proxy configurations sometimes cause HTTP requests to stall indefinitely. A hung publish script blocks the user's terminal and any CI pipeline it runs in.

## Decision

Every HTTP request to the Confluence API is wrapped with a hard timeout (configurable, defaulting to 30 000 ms). If the timeout elapses, the request is aborted and the script exits with an error.

## Consequences

- Publish operations fail fast on network issues rather than hanging.
- The timeout must be configurable for slow enterprise networks.
- Node's `fetch` API with `AbortController` / `AbortSignal.timeout` implements this without extra dependencies.
