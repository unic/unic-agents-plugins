# Issue tracker: GitHub

Repo-owned. Hand-maintained — no generator writes this file. See [ADR-0033](../adr/0033-de-dogfood-unic-archon-dlc.md).

Issues and specs for this repo live as GitHub issues at [`unic/unic-agents-plugins`](https://github.com/unic/unic-agents-plugins/issues) (a migration to Azure DevOps is planned, not scheduled). Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

Labels: state, type, priority and area are documented in [`labels.md`](labels.md). A skill's canonical triage _role_ maps onto the state tier via [`triage-labels.md`](triage-labels.md) — this repo runs an 8-state vocabulary and uses `rejected`, never `wontfix`.

## Pull requests as a triage surface

**PRs as a request surface: yes.**

PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets. Both endpoints below are enabled on this repo — sub-issues and native issue dependencies — so neither body-convention fallback applies here.

**Prerequisite: the five `wayfinder:*` labels do not exist yet.** Create them once, before the first `/wayfinder` run. Label creation mutates the live tracker and a revert would not undo it, so it is held out of the PR that documented this flow:

```sh
gh label create wayfinder:map       --description "Wayfinder map issue"
gh label create wayfinder:research  --description "Wayfinder child ticket: research"
gh label create wayfinder:prototype --description "Wayfinder child ticket: prototype"
gh label create wayfinder:grilling  --description "Wayfinder child ticket: grilling"
gh label create wayfinder:task      --description "Wayfinder child ticket: task"
```

**Every sub-issue and dependency endpoint below takes the issue's numeric database id, never its `#number` and never its `node_id`.** Read it once per issue and reuse it: `gh api repos/<owner>/<repo>/issues/<n> --jq .id`.

- **Map**: a single issue labelled `wayfinder:map`, holding the Destination / Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: create the issue, then link it to the map as a GitHub sub-issue:

  ```sh
  gh issue create --title "<question>" --body "…" --label "wayfinder:<type>"
  gh api --method POST repos/<owner>/<repo>/issues/<map>/sub_issues -F sub_issue_id=<child-db-id>
  ```

  `<type>` is one of `research`, `prototype`, `grilling`, `task`. Once claimed, the ticket is assigned to the driving dev.

- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation:

  ```sh
  gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>
  ```

  GitHub reports `issue_dependencies_summary.blocked_by` — open blockers only, which is the live gate. A ticket is unblocked when every blocker is closed.

- **Frontier query**: `gh issue list` has **no** sub-issue filter, so read the children from the map and check each one:

  ```sh
  gh api repos/<owner>/<repo>/issues/<map>/sub_issues \
    --jq '.[] | select(.state == "open" and (.assignee | not)) | .number' |
  while read -r n; do
    gh api "repos/<owner>/<repo>/issues/$n" \
      --jq 'select(.issue_dependencies_summary.blocked_by == 0) | "\(.number) \(.title)"'
  done
  ```

  The result is the frontier: open, unassigned, unblocked. First in map order wins.

- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.

`wayfinder:*` labels sit outside the four-tier taxonomy — `/wayfinder` owns their lifecycle. See the [ADR-0032 amendment](../adr/0032-label-taxonomy.md#amendment-2026-08).
