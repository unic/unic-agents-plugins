# Plan — spec-05: Classify existing threads

## Step 1 — Insert Step 5.5 into `commands/review-pr.md`

Demo: the step appears between Step 5 and Step 6 and correctly classifies threads when run against a PR with prior bot comments.

Wave:

- Insert "Step 5.5 — Classify existing threads" using python3 to apply classification logic, mutate `PRIOR_THREADS_FILE` in place, print count line

## Step 2 — Verify, version bump, and commit

Demo: `pnpm -w check` passes, version bumped to 0.5.0, changelog updated, `pnpm verify:changelog` passes, commit made.

Wave:

- Run `pnpm -w check`, bump version with `pnpm bump minor`, run `pnpm verify:changelog`, stage and commit
