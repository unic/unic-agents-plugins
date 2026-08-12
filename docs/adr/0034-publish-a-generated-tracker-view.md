# 0034. Publish a generated tracker view

**Status:** Accepted (2026-08)

## Context

The tracker already expresses workstreams natively. A `stream` label marks a stream ticket,
the sub-issue parent pointer gives lane membership, and native issue dependencies give
ordering. Nothing renders the three together. GitHub Projects has no dependency view, and a
stream ticket's own page shows one stream at a time, so the only way to see the whole board
was to open each stream ticket in turn and run `gh api …/dependencies/blocked_by` per issue.

An earlier attempt read the dependency prose that stream members used to carry. That prose
was removed from every member on #321, and the sections still carried by 37 closed issues
are wrong — #309's reads `None. #289 is merged`, which a naive `#NNN` scan turns into a
false edge. Any generator that parses issue text inherits that defect, and the page it
produces looks correct while being wrong.

## Decision

A workspace package, `@unic/tracker-streams`, generates one self-contained HTML page from
tracker data and a workflow publishes it to GitHub Pages.

- The generator reads **native relations only**: the `stream` label, the `sub_issues`
  endpoint, and the `dependencies/blocked_by` endpoint. It never reads an issue's text. A
  test greps the source of every file on the fetch path and fails if it ever does again.
- The transforms are pure and unit-tested — readiness classification, priority, title
  shortening, cross-stream edge detection, lane grouping. The entry script is the only
  file that reaches the network.
- Every count and every edge comes from the live fetch. Nothing about the tracker's shape
  is written into the source or into a test.
- The workflow triggers on the `issues` webhook events, on a fifteen-minute `schedule`,
  and on `workflow_dispatch`. It authenticates with the built-in `GITHUB_TOKEN` under
  `issues: read`, and deploys with `actions/upload-pages-artifact` and
  `actions/deploy-pages`.

The schedule is load-bearing, not belt and braces. `sub_issues` and `issue_dependencies`
exist as webhook events but are **not** GitHub Actions triggers, so attaching a member to a
stream or wiring a dependency fires no workflow at all. The `issues` trigger covers label
and state changes instantly; the cron is the only thing that bounds staleness for the two
relations the page is built on.

## Consequences

- The page cannot drift from the tracker the way a hand-maintained document does. Every
  value is a live read, so a stale page means a failed workflow run, which is visible.
- The cron is a staleness **bound**, not a guarantee. GitHub's scheduler routinely lags
  five to thirty minutes under load. Do not quote fifteen minutes as freshness.
- GitHub disables a scheduled workflow after 60 days with no repository activity, and a
  scheduled run does not itself count as activity. This repository is far too busy for that
  to bite, but it explains the failure mode if the page ever stops updating.
- No `pull_request` trigger, ever. The `github-pages` deployment environment is scoped to
  the Pages branch, so a run triggered from a pull request cannot obtain the token
  `deploy-pages` needs. Adding the trigger buys a red check, not a green one, which also
  means the deploy path is proven only after the change lands on the default branch.
- The credential stays narrow. If `GITHUB_TOKEN` cannot read a relation, the generator
  fails loudly rather than rendering a page without ordering. Widening to a personal access
  token or a GitHub App is a maintainer decision, not an implementation detail.
