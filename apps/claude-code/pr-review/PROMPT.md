# Ralph driver — `unic-pr-review` re-review feature

You are implementing the **re-review** capability for the `unic-pr-review` plugin.

## How to work

1. Open `docs/plans/README.md`. Pick the lowest-numbered spec whose status is **not** `done`.
2. Read the full spec. If anything is unclear, stop and ask before editing.
3. Make the smallest set of edits that fully satisfies the spec's *Acceptance criteria*.
4. Run the *Verification* steps from the spec. Fix anything that fails.
5. When the spec is fully done:
   - Update its header from `**Status: pending**` to `**Status: done — YYYY-MM-DD**`.
   - Tick its row in `docs/plans/README.md`.
   - Bump versions per the spec's *Version impact* line (both `.claude-plugin/plugin.json` and `marketplace.json` — see `CLAUDE.md`).
   - Commit using conventional commits (e.g. `feat(review-pr): detect prior review threads`).
6. Stop the loop only after every spec is `done`. Emit `<promise>LOOP_COMPLETE</promise>` then.

## Hard rules

- One spec per loop iteration. Don't bundle.
- Don't refactor outside the spec's *Touches* list.
- Don't invent new specs; if you find missing work, add a `## Follow-ups` line to the current spec and surface it in `docs/plans/README.md` under "Discovered work".
- Never edit `CLAUDE.md`'s rule list silently — propose the change in the spec instead.
