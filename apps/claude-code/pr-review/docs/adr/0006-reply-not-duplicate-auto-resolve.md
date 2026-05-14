# 0006. Reply to existing threads instead of opening duplicates; auto-resolve addressed threads

**Status:** Accepted (2025-04)

## Context

Re-reviews that open duplicate comments for already-noted issues create noise and make PR conversations hard to follow. Addressed issues should be resolved to signal progress.

## Decision

- For **pending** and **disputed** threads: post a reply noting whether the issue persists or has been escalated.
- For **addressed** threads: resolve the thread silently via PATCH to `fixed` (status 2) — no reply comment is posted.
- Never open a new thread for an issue that already has an active thread.

## Consequences

- PR comment threads remain linear and readable.
- Addressed threads are automatically resolved, reducing the reviewer's manual work.
- Incorrectly classified threads (e.g. false "addressed") will be auto-resolved; the reviewer may need to reopen them.

**Revised:** 2026-05-14 — Removed the reply comment for `addressed` threads. Reason: the "Resolved — thanks!" reply generated an ADO notification for every thread participant; developers often self-resolve threads before the bot runs, causing the bot to comment on already-closed threads (notification spam). The thread status PATCH to `fixed` remains unchanged.
