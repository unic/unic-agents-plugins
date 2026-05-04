# 0011. Plugin migration into the monorepo uses git filter-repo (subdirectory rewrite)

**Status:** Accepted (2025-04)

## Context

Three plugins were previously maintained in separate repositories. Moving them to the monorepo while preserving full commit history required a strategy. Options: (a) copy files + squash history, (b) `git filter-repo` to rewrite paths + merge with `--allow-unrelated-histories`.

## Decision

Use `git filter-repo --to-subdirectory-filter apps/claude-code/<plugin>` on the source repo, then merge into the monorepo with `git merge --allow-unrelated-histories`. This preserves every commit from the original repo, rewritten under the monorepo subdirectory path.

## Consequences

- Full per-plugin commit history is visible inside the monorepo via `git log -- apps/claude-code/<plugin>`.
- `git blame` works at the per-plugin level.
- The migration is one-time; future work happens entirely in the monorepo.
- `git filter-repo` must be installed locally (not part of standard git).
