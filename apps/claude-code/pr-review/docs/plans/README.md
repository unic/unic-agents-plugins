# Re-review feature roadmap

Goal: when `/unic-pr-review:review-pr <url>` runs against a PR that already has Claude Code review threads, update those threads incrementally instead of duplicating them.

## Status

| #  | Spec                                  | Status  | Depends on |
|----|---------------------------------------|---------|------------|
| 00 | Pre-flight: ADR supersession + prettierignore guard | done    | — |
| 01 | Normalize Claude Code signature       | done    | 00         |
| 02 | Detect prior review on PR             | done    | 01         |
| 03 | Target latest PR iteration            | done    | 02         |
| 04 | Incremental diff baseline             | done    | 03         |
| 05 | Classify existing threads             | done    | 02         |
| 06 | Reply to threads instead of posting   | done    | 04, 05     |
| 07 | Summary comment policy on re-review   | done    | 06         |
| 08 | Version bump, README, CLAUDE.md       | done    | 07         |
| 09 | Test harness — node:test + modules    | done    | 02, 05, 06 |
| 10 | Doc Context enrichment — work items + Confluence pages | done | — |
| 11 | Doc Context spawn reliability — fix silently skipped phase | done | 10 |
| 12 | Fix Step 4 — fold thread fetch into ADO Fetcher | todo | — |
| 13 | Formal dry-run mode | todo | 12 |
| 14 | ADO CLI preflight hardening + smoke test | todo | — |
| 15 | Fan-out resilience — agent-spawn Notice | todo | 12 |
| 16 | Aspect-selection observability + extract to pure JS | todo | 12 |
