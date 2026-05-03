# Re-review feature roadmap

Goal: when `/unic-pr-review:review-pr <url>` runs against a PR that already has Claude Code review threads, update those threads incrementally instead of duplicating them.

## Status

| #  | Spec                                  | Status  | Depends on |
|----|---------------------------------------|---------|------------|
| 00 | Pre-flight: ADR supersession + prettierignore guard | pending | — |
| 01 | Normalize Claude Code signature       | pending | 00         |
| 02 | Detect prior review on PR             | pending | 01         |
| 03 | Target latest PR iteration            | pending | 02         |
| 04 | Incremental diff baseline             | pending | 03         |
| 05 | Classify existing threads             | pending | 02         |
| 06 | Reply to threads instead of posting   | pending | 04, 05     |
| 07 | Summary comment policy on re-review   | pending | 06         |
| 08 | Version bump, README, CLAUDE.md       | pending | 07         |
| 09 | Test harness — node:test + modules    | pending | 02, 05, 06 |
