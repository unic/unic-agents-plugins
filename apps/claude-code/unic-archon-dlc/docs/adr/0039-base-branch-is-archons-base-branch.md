# 0039. A run's base branch is Archon's `$BASE_BRANCH`

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
five facts. A prompt node sees the `--base` value, and Archon cuts the worktree from it. A resumed run
keeps that value after an approval gate. A `--base` branch missing on the remote fails the run before its
first node. With `--from <feature-branch>` and `--base` together, Archon cuts the worktree from the
feature branch, and `$BASE_BRANCH` keeps the `--base` value. With no PR to query,
`/pr-review` diffs against `$BASE_BRANCH`, re-measured on the Box with its fetch and guard in place
([#505 comment](https://github.com/unic/unic-agents-plugins/issues/505#issuecomment-6314490544)).

## Decision

1. **The one source of a run's base branch is Archon's `$BASE_BRANCH`.** The Plugin adds no config key
   for it. A DLC key would be a third answer next to `branching` and Archon's own, with nothing to keep the
   three in step. Archon already reads `--base` per dispatch, so a run can target another branch without a
   committed change in the Consumer. Every line in the three Boxes that names the base reads
   `$BASE_BRANCH`, except the review diff in decision 3. On Archon 0.12.1 an approval `message` substitutes node outputs but not `$BASE_BRANCH`. So `/build`'s gate embeds the `bootstrap` message, which starts with the base, and `/qa`'s `merge-gate` names the PR's verified target.
2. **`project.branching` stops naming the base.** Its one job left in the Boxes is to decide whether
   `/qa` deletes the merged `feature/*` branch after the merge. `/cleanup` and `/explore` keep their own reads of it as
   hints, and neither names a run's base.
3. **The review diff reads the PR's own target branch** when the tracker returns a PR, because that is
   the diff that will merge. When a query confirms that no PR exists, or the tracker exposes none, it
   reads `$BASE_BRANCH`. When both exist and differ, `/pr-review` puts a warning that names both in its
   summary and carries on. `prep` fetches the diff base first. When the tracker query fails, or the diff
   base still does not resolve, `guard-no-diff-base` cancels the run. A guessed base would give the review
   a diff of other changes than the PR's. The spike did not reach this cancel path, because it needs a
   PR whose target branch does not resolve, and a scratch repository has no tracker to return one. #502
   proves it in the Consumer. `/qa`'s `verify-pr-base` compares the
   PR's target with `$BASE_BRANCH`, and `merge-gate` and `merge` still fail closed on
   `base_ok != 'true'`. So a `/qa` whose `$BASE_BRANCH` differs from the PR's target refuses to merge.
4. **`/setup` stays verify-only on `.archon/config.yaml`.** It reports `worktree.baseBranch` when it is set. Otherwise it reports the remote's default branch, labelled as an approximate stand-in, because Archon 0.7 to 0.11 store the branch checked out at the first registration. From 0.12.0, new
   projects follow the remote's default branch unless a base is chosen ([v0.12.0 release notes](https://github.com/coleam00/Archon/releases/tag/v0.12.0)). Its main signal is the warning that `worktree.baseBranch` is unset. It also warns when the resolved base disagrees with the base that `branching` implies, and prints the block to add once. It writes nothing to that file.
   `commands/setup.md` is the one place in the Plugin that maps a branching model to a run's base, and
   only to warn. `/cleanup` keeps its own main-line hint.

## Consequences

- A Consumer whose Archon base differs from the branch `branching` implied now targets the Archon base.
  `/setup`'s base line shows which branch that is.
- The `code-review` fixed point in [ADR-0023](0023-build-generic-red-green-refactor-loop.md) reads
  `$BASE_BRANCH`.
- `--base` refuses a branch missing on the remote, so no Box creates an integration branch. A person cuts
  it before the dispatch.
- The PR-target path and the cancel path of decision 3 need a tracker that returns a PR, so the spike
  could not measure them. #502 proves both in the Consumer before the first run that depends on them.
