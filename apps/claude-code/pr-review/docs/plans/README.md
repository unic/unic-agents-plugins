# Re-review feature roadmap

Goal: when `/unic-pr-review:review-pr <url>` runs against a PR that already has Claude Code review threads, update those threads incrementally instead of duplicating them.

## Status

| #  | Spec                                  | Status  | Depends on |
|----|---------------------------------------|---------|------------|
| 00 | Normalize Claude Code signature       | pending | —          |
| 01 | Detect prior review on PR             | pending | 00         |
| 02 | Target latest PR iteration            | pending | 01         |
| 03 | Incremental diff baseline             | pending | 02         |
| 04 | Classify existing threads             | pending | 01         |
| 05 | Reply to threads instead of posting   | pending | 04         |
| 06 | Summary comment policy on re-review   | pending | 05         |
| 07 | Version bump, README, CLAUDE.md       | pending | 06         |

## Discovered work

(Empty. Add bullets if a spec uncovers extra work.)
