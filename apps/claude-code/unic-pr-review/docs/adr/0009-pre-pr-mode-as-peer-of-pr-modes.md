# 0009. Pre-PR mode is a peer operating mode, not a flag

**Status:** Accepted (2026-05)

## Context

Developers often want to run the Plugin against a working branch before opening a PR — to catch issues earlier, while there's no ADO PR URL yet. We had to decide whether to express that as a flag layered on top of the existing PR-URL workflow, or as a distinct operating mode driven by argument shape.

Two alternatives were considered:

- **Add a `--pre-pr` flag to the PR-URL mode.** Rejected — the flag would need to live alongside a now-meaningless PR URL argument and either ignore it or error. A peer mode driven by argument shape (URL present vs absent) is unambiguous and has no flag combinations to document.
- **Auto-promote Pre-PR to First-review by opening a PR mid-run.** Rejected — opening a PR is a user-owned action with side effects (notifications, CI runs, reviewer assignment). The Plugin never opens a PR.

## Decision

Running the Plugin without a PR URL enters Pre-PR mode: the Plugin resolves the base branch via `git symbolic-ref refs/remotes/origin/HEAD` (falling back to `develop`, then `main`, then `master`), computes the local diff, prompts the invoker for optional Work Item URLs (ADO or Jira, comma-separated) and Confluence URLs, then runs the full sub-agent fan-out and renders the Review in the terminal. No ADO write-back, no Approval Loop, no Re-review state machine.

## Consequences

- The base-branch fallback chain is policy: `origin/HEAD` → `develop` → `main` → `master`, hard-error otherwise. Repos with non-standard default branches must set `origin/HEAD` correctly via `git remote set-head`.
- Pre-PR mode bypasses the ADO Fetcher entirely; the Intent Checker still runs (against the URLs the invoker pasted) and the aspect agents still fan out. The Approval Loop is skipped because there is nothing to write back.
- Pre-PR mode with no pasted URLs and no `intent` to check is the closest the Plugin gets to a "pure linter" mode — explicitly supported, but the absence of intent is reflected in the rendered Summary so the invoker knows what was and wasn't checked.
