# 0006. Reply to existing threads instead of opening duplicates; auto-resolve addressed threads

**Status:** Accepted (2025-04)

## Context

Re-reviews that open duplicate comments for already-noted issues create noise and make PR conversations hard to follow. Addressed issues should be resolved to signal progress.

## Decision

- For **pending** and **disputed** threads: post a reply noting whether the issue persists or has been escalated.
- For **addressed** threads: post a reply confirming the fix and resolve the thread.
- Never open a new thread for an issue that already has an active thread.

## Consequences

- PR comment threads remain linear and readable.
- Addressed threads are automatically resolved, reducing the reviewer's manual work.
- Incorrectly classified threads (e.g. false "addressed") will be auto-resolved; the reviewer may need to reopen them.
