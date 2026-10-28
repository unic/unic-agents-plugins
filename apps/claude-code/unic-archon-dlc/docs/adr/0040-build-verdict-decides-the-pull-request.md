# 0040. `/build`'s verdict decides whether a pull request opens

**Status:** Accepted (2026-10-28)

## Context

Until this decision, `evidence` in `unic-dlc-build.yaml` wrote `evidence.json` only on a `pass` verdict, and the run went on to `report` and `open-pr` whatever the verdict was. The engine's `evidence_policy` then refused terminal `completed`, so a red build ended `failed` with a complete, mergeable pull request already open. In `gates.build == afk` no human paused before it. [ADR-0034](0034-evidence-gate-deterministic-writer.md) § Decision item 4 accepted that cost and named the alternative: gate `open-pr` on the verdict. This ADR takes that alternative (#439).

A second defect came with it. The one file the engine demands carried no information. It existed only on `pass`, so both failure arrays in it were empty by construction, and it could never say what failed.

## Decision

1. **`evidence` writes `evidence.json` on every verdict.** The file names the verdict and lists the failures that produced it: the failure arrays from `verification` and `goals-check`, `test_outcome` and `unresolved_needs`. The Session-dir mirror is written on every verdict too.
2. **The verdict on stdout is the branch signal.** `evidence` prints `{ verdict, test_outcome, unresolved_needs }` as JSON on stdout and every human line on stderr. Two `when` expressions read the `verdict` field, and both compare it with `'pass'` only, so `fail` and `unresolved` take the same branch.
3. **The work is committed and pushed on every verdict, before the verdict decides anything.** `commit-session` stages the named-path list `open-pr` used to stage, now with `evidence.json` always on it, and commits. `push-branch` pushes the branch and prints `{ branch, commit }` as JSON. So a red build leaves its commits, `report.md` and `evidence.json` on the remote branch.
4. **Two siblings follow `push-branch`, and the verdict picks one.** `guard-not-pass` is a `cancel:` leaf with `when` on a verdict other than `pass`. It ends the run `cancelled` and its message names the verdict, the pushed branch and commit, and the path of `report.md` on that branch. It writes nothing to the tracker. `open-pr` has `when` on a verdict equal to `pass`, opens the pull request against `$BASE_BRANCH` ([ADR-0039](0039-base-branch-is-archons-base-branch.md)) and links it to the slices' work items. `build-pr-gate` still depends on `open-pr`, so a green build in `hitl` still pauses there. No node in `/build` sets a trigger rule.
5. **A failed push ends the run `failed`, not `cancelled`.** `push-branch` is a `bash:` node, so a failed push exits non-zero, both siblings are skipped, and the run ends `failed`. No work reached the remote, which is a different fact from a red verdict.
6. **`evidence_policy: { required: true }` stays, as a backstop.** With `evidence` writing on every verdict it no longer refuses a red run. It covers the one case `guard-not-pass` cannot see: `evidence` ending without writing the file, for example after an edit that returns early or writes to another path. Keep the key. Without it, a run whose `evidence` printed `pass` and wrote no file would end `completed`. An `evidence` node that fails outright already ends the run `failed`.

### Why siblings, and not a chain

The first design ran a chain with `trigger_rule: all_done`, so that the cancel ran after `open-pr` was skipped. A `trigger_rule` is the setting an implementer most easily gets wrong, and on a chain the green path depends on it. The sibling shape needs none: `guard-not-ready` in `/build` and `guard-no-diff-base` in `/pr-review` already use it, and the `pass`-only comparison sends `unresolved` to the cancel side without a third branch.

### Why two nodes for the commit and the push

#439's criterion 6 asks for one node that commits and pushes, and fails when the push fails. Telling the loop's uncommitted source and test files from scratch files is a judgement, so staging needs a prompt node. A prompt node cannot exit non-zero, so it cannot fail on a failed push, and the branch and commit it reports would be self-reported. So `commit-session` is the prompt that stages and commits, and `push-branch` is the `bash:` node that pushes, fails on a failed push, and reads the branch and commit from git.

## The probe

Measured on 2026-10-28 with the Archon v0.12.1 release binary `archon-darwin-arm64` (commit `5f2b4841`), downloaded with `gh release download v0.12.1 --repo coleam00/Archon` and checked against `checksums.txt`. A wrapper set `ARCHON_HOME` to a scratch folder and ran the binary by its path, in a scratch repository with a bare remote, outside every clone, with `--no-worktree`. The machine's own `archon` stayed v0.10.1.

The probe workflow has the same shape as the Box: a `script:` node on `runtime: bun` that writes `evidence.json` to `$ARTIFACTS_DIR` and prints `{ verdict, test_outcome, unresolved_needs }`; a second `script:` node that reads the verdict back; a `bash:` push node that prints `{ branch, commit }`; a `cancel:` leaf on `verdict != 'pass'`; a sibling on `verdict == 'pass'`; and a node that depends on that sibling. The workflow declares `evidence_policy: { required: true }`.

1. **A `script:` node's JSON stdout is read field by field in a `when`: holds.** With `fail` and `unresolved`, the sibling logged `Skipped (condition: $verdict.output.verdict == 'pass')`. With `pass`, the cancel leaf logged `Skipped (condition: $verdict.output.verdict != 'pass')`. The stderr line did not reach the output. A node-output reference in a `script:` body is still substituted: the read-back node printed the verdict and the array.
2. **A `cancel:` leaf whose `when` holds sets `cancelled`, and neither the sibling nor its dependant runs: holds.** With `fail` and `unresolved`, the run's row in the scratch database reads `cancelled`, the sibling was skipped, and the dependant never started.
3. **The skipped `cancel:` leaf does not stop `completed`: holds.** With `pass`, the sibling and its dependant ran, the CLI printed `Workflow completed successfully.` and exited 0, and the row reads `completed`.
4. **A `cancel:` message substitutes node-output references: holds.** The message printed as `Probe cancelled. Verdict fail. Work on main at <sha>.`, with the verdict from the `script:` node and the branch and commit from the `bash:` node, neither of them a direct dependency of the leaf.

A fifth run measured decision item 5. With a push that fails, the `bash:` node failed with exit 128, the cancel leaf, the sibling and the dependant were each skipped as `upstream failed`, and the row reads `failed`.

The same items 2 to 4 were measured on the same day for #652 with `bash:` nodes, and [PR #663](https://github.com/unic/unic-agents-plugins/pull/663) records them. This probe ran them again with a `script:` node as the verdict's source.

Found on the way: Archon 0.12.1 no longer substitutes `$ARGUMENTS` into a `script:` body, and warns `script_node_literal_user_var`. It reads `process.env.ARGUMENTS` instead. `evidence` reads no user variable, so this changes nothing here.

## Consequences

- A red `/build` run now ends `cancelled` with no pull request, where it used to end `failed` with one open. An operator or a script that waited for a red pull request sees a different outcome.
- How a human who is not watching the run learns about a red build is not decided here. #658 takes it.
- `/qa` on a branch with no pull request ends `cancelled` at `guard-no-open-pr` (#652), so a red branch cannot be merged by `/qa` either.
