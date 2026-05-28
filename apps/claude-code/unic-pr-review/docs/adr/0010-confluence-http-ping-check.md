# 0010. Confluence reachability via HTTP ping (HEAD request)

**Status:** Accepted (2026-05)

## Context

The doctor command must verify that the Confluence instance is reachable. Options: (a) a full authenticated API call (proves auth is valid), or (b) a lightweight HEAD request to the base URL (proves network reachability only).

## Decision

Doctor issues a HEAD request to the Confluence base URL extracted from credentials. This is a network reachability check only — it does not validate the token. A 2xx, 3xx, or 4xx response is treated as "reachable" (the server responded). A network error or timeout is a fail.

## Consequences

- Fast: HEAD requests return no body.
- Does not catch expired tokens (Confluence auth is validated at first actual API call during a Review).
- 401 from Confluence on HEAD is treated as "reachable" — the doctor command is not a full auth verifier.
