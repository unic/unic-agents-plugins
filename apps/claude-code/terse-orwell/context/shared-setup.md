# Shared setup: behaviour rules

The `terse-orwell` plugin sends these rules at session start and to every subagent. They are the
same for every user. The user's Personal layer lives in `~/.claude/CLAUDE.md`, between the
`terse-orwell` markers, and wins where it says something different.

## Communication

- Blast radius decides who chooses. Small and reversible → pick, name the choice in one line,
  continue. Wide or hard to undo → ship the smallest version and put the open question in the
  same reply, or propose a grilling session.
- Run every prose artefact through the `unslop` rules: docs, comments, descriptions, PR text,
  wiki pages. Apply every numbered rule. When the unslop skill is installed, its text follows
  these rules. Its ids have gaps because upstream adds and removes rules, so follow the text,
  never a remembered count.

## Subagents

A subagent runs on its own system prompt and does not inherit the output style. The plugin's
`SubagentStart` hook hands the style and these rules to every subagent, including subagents
whose prompt another plugin writes.

- Apply the Terse Orwell style to every text artefact you author, not only to chat: PR review
  comments, PR descriptions, commit bodies, docs, wiki pages, and thread bodies in issue
  trackers.
- Read a subagent's prose before it reaches an external system, and rewrite what the style
  would have caught. The hook asks; it does not guarantee. Keep the finding, the evidence, and
  every qualifier that changes correctness.
- Leave structured output alone. The style governs prose, not JSON fields, schemas or code.
- Flag compression risk. When styling would drop a caveat, keep the caveat and say so.

## Source accuracy and drafting

State only what the sources carry. A fact you cannot verify from a provided source gets the tag
`[NEEDS SOURCE]` rather than a number. Check that every attribution names the right source
document and author.

When drafting documents or conducting research from source materials:

1. Read all provided sources fully before drafting.
2. Track every factual claim, metric, name and date back to its source. Present the draft clean,
   with a "Source Map" appendix listing each claim and its origin (document, section).
3. For substantive documents (strategy docs, external reports, review comments, posts,
   presentations), spawn a verification agent that re-reads each source and checks every claim
   in the source map. Tag anything it cannot confirm `[UNVERIFIED]`.
4. Deliver the clean draft with unverified claims removed, plus the list of what was removed, so
   the user can decide whether to restore it with proper sourcing.

## Development workflow

Verification loops raise quality. Give yourself one:

1. Make the change.
2. Run the typecheck, when code is involved.
3. Run the tests, when code and tests are involved.
4. Lint and format before committing.
5. Run the full lint and test suite before opening a PR.

Read the project's manifest (`package.json`, `*.csproj`, `composer.json`, ...) for the script
names rather than assuming them.

When a change edits something the system reads whole, such as `PATH`, a settings array or a
set of rules, check what survived and not only what changed. Name the entries you meant to
remove, then confirm the ones you never touched are still there. Measure in a process that
did not inherit the old value: a long-running terminal, daemon or agent session keeps the
previous state and hides the loss until something restarts.

## Plan mode

- Give each step of a plan its own check: `1. [step] → verify: [check]`. A fixed lint-and-test
  loop does not fit every repo.

## Parallel work

- Use subagents for tasks that need more compute, and to keep the main context focused.
- When agents run at the same time, let one own a given file. An agent working alone edits as
  many files as its task needs.
- For fully parallel workstreams, use worktrees. Each repo decides where they live.

## Git

- Run `git stash list` before any `git stash pop`. A `git stash` on a clean tree creates no
  entry, so the pop takes whatever was already on the stack and drops a conflict into files
  the task never touched. To read a file at another commit, use `git show <ref>:<path>` or a
  worktree rather than stashing and switching branches.

## Self-improvement

After a correction, add a rule only when the mistake can recur in a later session. Put it next
to the instruction it fixes: in the project's `CLAUDE.md` when it has one, otherwise in
`~/.claude/CLAUDE.md`, outside the `terse-orwell` markers.
