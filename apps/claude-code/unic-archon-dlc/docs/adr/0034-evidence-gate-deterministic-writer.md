# 0034. The evidence gate is a deterministic script writer, never a self-judging prompt

**Status:** Accepted (2026-08-10)

## Context

Archon 0.7.0's `evidence_policy: { required: true }` ([ADR-0033](0033-archon-070-schema-target.md)) refuses terminal `completed` unless `evidence.json` exists in the run's `$ARTIFACTS_DIR` — but the engine checks presence only. Whatever writes that file **is** the gate, in the same sense [ADR-0012](0012-fresh-context-red-green-separation.md) already identified for red/green: a check that can grade its own homework is not a check.

An AI prompt node that both judges the build (reads `verification`/`goals-check` output, decides pass/fail) and writes `evidence.json` accordingly would be exactly that: a prompt that judges itself green and then certifies itself green, with nothing external constraining the two decisions to agree. This is the same failure mode the slopcheck gate and [ADR-0012](0012-fresh-context-red-green-separation.md)'s red/green isolation exist to prevent.

## Decision

A dedicated **script node**, `evidence`, is the only writer of `evidence.json`. It is deterministic code, not an AI judgment:

1. **Delete-first.** Remove any `$ARTIFACTS_DIR/evidence.json` left by a prior attempt before doing anything else — `$ARTIFACTS_DIR` is per-run but a resumed run reuses it ([ADR-0033](0033-archon-070-schema-target.md)), so a stale file from a previous, since-superseded attempt would certify a tree that is no longer green.
2. **Read, don't judge.** It reads the `passed` boolean `verification` and `goals-check` already computed (via their new `output_format`, not by re-running or re-interpreting anything) and takes the conjunction.
3. **Write iff both are true.** If either is false, it exits 0 having written nothing — the workflow terminates without evidence, and `evidence_policy` fails the run closed. If both are true, it writes `$ARTIFACTS_DIR/evidence.json`, then mirrors it to `<artifacts_dir>/<slug>/evidence.json` (the Session-artifact home, [ADR-0015](0015-workflows-slug-artifact-home.md)) — `$ARTIFACTS_DIR` resolves outside the repo tree and is gone once `/cleanup` prunes the worktree, so without the mirror the certification is invisible to a reviewer and to `open-pr`, which stages it.
4. **`always_run: true`.** Its own exit code is a write op, not a verdict about the tree; a resumed run must re-derive presence from the CURRENT `verification`/`goals-check` output on every attempt, never trust that a file existing means the CURRENT tree is green.

**Rejected alternative: a prompt writes `evidence.json` when it judges itself green.** This was the first design considered and is recorded here specifically so it is not proposed again: it collapses judgment and certification into the same actor, the exact failure [ADR-0012](0012-fresh-context-red-green-separation.md) and the slopcheck gate exist to prevent for red/green and for dependency trust respectively. A script has no incentive to agree with itself; a prompt asked to both decide and attest does.

## Consequences

- `verification` and `goals-check` in `unic-dlc-build.yaml` gain a boolean `output_format` (`passed`, `failures`) alongside their existing prose verdicts — the prose stays for the human at `build-pr-gate`; the boolean is what `evidence` and the engine's gate read.
- The `evidence` node depends on both and runs after them, before `report`; `report.md` is unaffected — it already folds in `$verification.output` and `$goals-check.output` verbatim.
- No other Box gains an evidence gate in this ADR. `/qa`, `/pr-review`, and `/explore` have their own verdict-reporting nodes (`e2e`, `coverage-gate`, `uat-prep`, …) but none currently reaches a terminal `completed` state whose evidence needs this exact deterministic-writer shape; extending the pattern there is a separate decision.
