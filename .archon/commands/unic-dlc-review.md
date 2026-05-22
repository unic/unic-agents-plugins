---
description: Run the unic-archon-dlc self-contained code review workflow — four aspects, structured findings, single PR comment, idempotent re-run
---

# /unic-dlc-review

Runs the `review` workflow: analyses the current PR diff across four review aspects
(code quality, test coverage, silent failures, type design), then posts — or updates — a
single structured comment on the PR.

**No runtime dependency on pr-review-toolkit or any other plugin.**
All review logic is self-contained in `.archon/workflows/unic-dlc-review.yaml`.

## When to use

- After opening a PR and before requesting human review.
- As a final quality gate before merging.
- Re-run it after addressing feedback — it will **update** the prior comment rather than
  posting a duplicate.

## What it produces

A single structured PR comment (or updated comment on re-run) with four sections:

1. **Code quality** — readability, naming, function length, project-convention adherence
2. **Test coverage adequacy** — exercises public interfaces, output-focused assertions, no
   internal-collaborator mocks
3. **Silent failure patterns** — swallowed exceptions, empty catch blocks, fallbacks that
   hide bugs
4. **Type design quality** — encapsulation, invariants in types, illegal-state-unrepresentable
   patterns

Each section lists specific findings with `file:line` references, or an explicit
"No findings." line if nothing was detected.

## Usage

```sh
archon workflow run unic-dlc-review
```

Or invoke from Claude Code:

```
/unic-dlc-review
```

No arguments needed. The workflow reads `.archon/unic-dlc.config.json` to determine the
tracker and the current open PR.

## Workflow structure

```
code-review  ──▶  structured comment posted / updated on PR
```

Single-node DAG. The node reads CLAUDE.md / AGENTS.md for project conventions, runs the
four review aspects, and calls the tracker adapter to post or update the comment.

## Re-run behaviour

When you run `/unic-dlc-review` again on the same PR:

- The workflow searches for a prior comment whose body contains the sentinel marker
  `<!-- unic-dlc-review -->`.
- If found, it **updates** that comment in-place.
- If not found, it creates a new comment.

This prevents duplicate review threads accumulating over multiple runs.

## Inspiration

- `apps/claude-code/pr-review/` — multi-aspect analysis structure, compact finding
  schema (`severity / filePath / startLine / endLine / title / body`), re-review
  detection via sentinel, and the discipline of posting a single summary comment rather
  than many inline threads.
- Matt Pocock's review skill
  (https://github.com/mattpocock/skills/blob/main/skills/in-progress/review/SKILL.md) —
  aspect-driven review structure, explicit "no findings" lines, and the principle that
  every run should produce actionable output even when everything looks good.
- This plugin's `lib/tracker-adapter.mjs` — used to post or update the comment via the
  configured tracker backend (github / ado / jira / local-markdown).
