# 0038. A run's base branch is Archon's `$BASE_BRANCH`

**Status:** Accepted (2026-10-21)

## Context

`/build`, `/pr-review` and `/qa` each computed `expected_base` in `bootstrap` from `project.branching`:
`develop` when `gitflow`, else `main`. No value could name a third branch, so no Box could target a
long-lived integration branch. `/build` also read a second answer. Its verify node diffed against
Archon's `$BASE_BRANCH`, while `open-pr` and `code-review` in the same Box read `expected_base`, and
nothing checked that the two agreed. `/pr-review` took its review diff from the merge-base with
`expected_base`. With a wrong base the review read the right diff until `develop` moved, and then it read
the wrong diff and reported nothing (#505).

Archon already resolves a base branch for every run. It takes `archon workflow run --base <branch>`, then
`worktree.baseBranch` in `.archon/config.yaml`, then the codebase's stored default branch, then git, and
exposes the result to every node as `$BASE_BRANCH`
([variables reference at v0.12.1](https://github.com/coleam00/Archon/blob/v0.12.1/packages/docs-web/src/content/docs/reference/variables.md)).
`--base` exists since Archon 0.7.1 ([coleam00/Archon#2203](https://github.com/coleam00/Archon/pull/2203)).
A spike on Archon 0.12.1
([#505 comment](https://github.com/unic/unic-agents-plugins/issues/505#issuecomment-6313975252)) measured
that a prompt node sees the `--base` value, that the worktree is cut from it, that a resumed run keeps it
after an approval gate, that a `--base` branch missing on the remote fails the run before its first node,
and that `--from <feature-branch>` with `--base` cuts the worktree from the feature branch and keeps
`$BASE_BRANCH` as the `--base` value.

## Decision

1. **The one source of a run's base branch is Archon's `$BASE_BRANCH`.** The Plugin adds no config key
   for it. A DLC key would be a third answer next to `branching` and Archon's own, with nothing to keep the
   three in step. Archon already reads `--base` per dispatch, so a run can target another branch without a
   committed change in the Consumer. Every line in the three Boxes that names the base reads
   `$BASE_BRANCH`, except the review diff in decision 3. On Archon 0.12.1 an approval `message`
   substitutes node outputs but not `$BASE_BRANCH`, so the approval messages point at the `bootstrap`
   message, which names the base.
2. **`project.branching` stops naming the base.** It keeps one job in the Boxes: whether `/qa` deletes the
   merged `feature/*` branch after the merge. `/cleanup` and `/explore` keep their own reads of it as
   hints, and neither names a run's base.
3. **The review diff reads the PR's own target branch** when the tracker returns a PR, because that is
   the diff that will merge. With no queryable PR it reads `$BASE_BRANCH`. When both exist and differ,
   `/pr-review` prints a warning that names both and carries on. `/qa`'s `verify-pr-base` compares the
   PR's target with `$BASE_BRANCH`, and `merge-gate` and `merge` still fail closed on
   `base_ok != 'true'`. So a `/qa` dispatched without `--base` against a PR that targets another branch
   refuses to merge.
4. **`/setup` stays verify-only on `.archon/config.yaml`.** It reports the base Archon will resolve from
   `worktree.baseBranch` or the remote's default branch, and warns, with the line to add, when the key is
   unset or disagrees with the base that `branching` implies. It writes nothing to that file.
   `commands/setup.md` is the one place in the Plugin that states which base a branching model implies,
   and only to warn.

## Consequences

- A Consumer whose Archon base differs from the branch `branching` implied now targets the Archon base.
  `/setup`'s base line shows which branch that is.
- The `code-review` fixed point in [ADR-0023](0023-build-generic-red-green-refactor-loop.md) reads
  `$BASE_BRANCH`.
- `--base` refuses a branch missing on the remote, so no Box creates an integration branch. A person cuts
  it before the dispatch.
- The PR-target path of decision 3 needs a tracker that returns a PR, so the spike could not measure it.
  It is proven in the Consumer before the first run that depends on it (#502).
