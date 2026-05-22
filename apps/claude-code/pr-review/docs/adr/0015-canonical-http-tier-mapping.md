# ADR 0015 — Canonical HTTP-Tier Mapping

**Status:** Accepted, amended by 0018
**Date:** 2026-05-13
**Deciders:** Oriol Torrent Florensa
**Context:** ADR 0014 (failure-classification helper layer)

---

## Context

ADR 0014 introduced the four-tier Notice doctrine (OK / EMPTY-BY-DESIGN / DEGRADED / ABORTED) and moved
failure classification into pure JS helpers under `scripts/ado/`. The doctrine describes the four tiers;
this ADR records the exact HTTP status → tier mapping that every helper and call site must apply
consistently so that `401` means the same thing everywhere and no future contributor invents a divergent
mapping.

---

## Decision

### Canonical mapping table

| HTTP outcome          | Tier     | Notes                                                           |
| --------------------- | -------- | --------------------------------------------------------------- |
| 200 / 201             | OK       | Normal success. No Notice.                                      |
| 404                   | OK       | Domain "the thing is already gone." Treat as success.           |
| 409                   | OK       | Domain "state already changed." Treat as success.               |
| 401                   | ABORTED  | Token expired or revoked. All subsequent writes will also fail. |
| 403                   | ABORTED  | Permission revoked. Same abort rule applies.                    |
| 5xx                   | DEGRADED | Transient backend failure. Emit Notice; continue if possible.   |
| Other 4xx (400 / 422) | DEGRADED | Malformed request — likely a plugin bug. Emit Notice; continue. |
| Network error         | DEGRADED | Treat identically to 5xx transient.                             |

### 401 / 403 abort rule

When a 401 or 403 response is received on any ADO operation:

- **Read operations** (Fetcher): if the response is on a critical path (iterations), abort the run with a
  clear stderr message naming `az devops login` as the remedy. If non-critical (work items), emit a
  DEGRADED Notice and continue.
- **Write operations** (Writer, Coordinator): abort the writer/coordinator immediately. Subsequent writes
  would all fail with the same auth error; aborting avoids partial writes and preserves the state needed
  for re-review detection.

### No retries in v1

Retries are not implemented. Reasons:

1. Retries add latency that is already painful in AFK runs.
2. Retries introduce a new failure mode (retry storm) that the Notice surface does not yet describe.
3. The DEGRADED Notice produced without retries is accurate information: the operation failed once.
   A retry that eventually succeeds would suppress a Notice the user might want to see.

Re-evaluate if 5xx Notices prove painful in practice; retries can be added behind the same Notice
surface without changing the doctrine.

**Update (2026-05-14):** this no-retry policy is extended to agent-spawn failures during orchestrator
fan-out by ADR 0018. The reasoning is identical (AFK latency, retry-storm risk, accurate Notice).

### Implementation

The canonical mapping is implemented in `scripts/ado/classify-http-error.mjs`:

```js
classifyHttpError({ status, body, exitCode })
// → { tier: 'ok' | 'degraded' | 'aborted', kind: string, message: string }
```

Every ADO call site that needs tier classification calls this helper. Per-call-site helpers
(`fetch-work-items.mjs`, `fetch-iterations.mjs`, `parse-write-response.mjs`) compose it with
their own response-parsing logic.

---

## Consequences

- Every HTTP failure in the plugin is classified by one function. Adding a new status code mapping
  requires editing one file; the change propagates to all consumers automatically.
- 404 and 409 are OK — callers that previously had explicit 404/409 catch blocks can remove them.
- ABORTED on 401/403 is non-negotiable: a caller cannot downgrade to DEGRADED.
- Network errors (process exits with non-zero exit code and no HTTP status) are DEGRADED, not ABORTED,
  because network errors are transient by nature.
