# Traps proven the expensive way

Facts about the tools an agent session drives here — Archon, Azure DevOps, `gh`, git, pnpm, the
Copilot reviewer. Each one cost real time at least once. Each is a property of the tool, not of any
one project, which is why this file is tracked and shareable.

Nothing here names a customer, a customer repository or an internal work item. Project-specific
lessons live in the orchestrator's own untracked notes and stay there. When a lesson is worth both
audiences, the mechanism is written here and the project keeps its own evidence.

Dates are the day the behaviour was measured. Where a version is named, the fact is pinned to it
and may not survive an upgrade.

## Judging a command

- **`pnpm format` and `pnpm ci:check` exist only at the repository root.** Run from a package
  directory they silently do nothing, or exit 254.
- **Judge by exit code, never by grepping output for "error".** Prettier reports style problems as
  `[warn]`, so `ci:check | grep -ic error` returns 0 on a failing run.
- **A passing test suite can prove very little.** `pnpm test` passed all day while every command of
  a plugin was broken at step 1 in a real consuming repository. For a plugin, the bar is a
  marketplace install into a consumer, then running the thing.
- **Test both directions.** A `pre-push` hook tested only on the deny path shipped twice broken: it
  let the final unterminated stdin line through, and under zsh it let a protected-branch push
  through entirely, because zsh does not word-split unquoted expansions, so `for x in $LIST`
  iterates once.
- **A check that cannot be made to fail is inert, not passing.** Ship a positive control beside it.

## `gh`

- **Never `gh issue comment --edit-last`.** It edits the author's most recent comment instead of
  adding one; it destroyed a week-old comment on 2026-08-26. The API exposes no comment revision
  history — GitHub keeps it, but only behind the _edited_ marker in the browser. To add:
  `gh issue comment <n> --body-file <f>`. To change one: `gh api -X PATCH …/issues/comments/<id>`
  after reading what it says.
- **Never put a destructive form on the left of `||`.** If it succeeds, the safe branch is dead
  code.
- **`gh api -f` sends a string where the sub-issue and dependency endpoints demand an integer.**
  Both answer `HTTP 422 Invalid property /sub_issue_id: "5244565600" is not of type integer`. Use
  `-F`, which types the value. Measured 2026-09-22.
- **`issue_dependencies_summary.blocked_by` lags a dependency write by seconds.** After a tenth
  blocker was added to one issue the summary read 9 while
  `GET .../issues/<n>/dependencies/blocked_by` listed 10; three reads later both said 10. The
  frontier query in `docs/agents/issue-tracker.md` compares that summary to 0, so a session that
  wires an edge and queries the frontier in one breath can be offered a ticket that is already
  blocked. **Verify a new edge by listing it, never by the counter.** Reported 2026-09-17 by the
  session that hit it; not re-measured since.

## The Copilot reviewer

Measured against one ruleset, on pull requests targeting the default integration branch.

- **The ruleset is DISABLED, and has been since 2026-09-05.** `20764169`, "Copilot code review",
  target `refs/heads/develop`, `enforcement: disabled` — verified 2026-09-22. It was switched off
  after one pull request drew eight automatic rounds and spent 35% of a month's Copilot budget in
  a night. **So no review fires on a push, and none fires on un-drafting.** A review is requested
  by hand, once, through the GraphQL `requestReviews` mutation with the reviewer's bot id. Nothing
  was deleted: one field puts it back, `enforcement: active` on that ruleset.
- The two lines below are the rule's **configuration**, which is still what it holds and what would
  resume the moment it is re-enabled. They are not what happens today.
- `review_on_push: true` — it re-reviews on every push; two or three passes per pull request is
  normal.
- `review_draft_pull_requests: false` — drafts are skipped, and un-drafting triggers a review
  immediately with no extra push.
- **A review whose body names the quota limit is a failure that reads as "no comments".** Judge by
  the body, never by the comment count.
- **Read the review body whole.** A `head -c` slice missed a `Suppressed comments (1)` section on
  2026-09-05 and produced a false "there is none". `grep -c 'Suppressed comments'` is a presence
  check and nothing more — it cannot show you the finding, its path, its line or the quota
  explanation, so using it _instead of_ reading permits the same false pass in a shorter command.
- `POST …/requested_reviewers` for Copilot returns 200 with an empty array and adds nobody. While
  the ruleset was enforced, un-drafting triggered a review within about two minutes; with it
  disabled, nothing triggers one and the GraphQL mutation is the only route.
- **Enforcement is not visible from the rule.** A reader cannot tell a configured-and-enforced rule
  from a configured-and-disabled one by reading the rule block, here or on GitHub — the
  `enforcement` field sits elsewhere. So a document describing the rule reads as authoritative
  whether or not anything is switched on. Check the ruleset's `enforcement`, not its rules, before
  believing either.

## Azure DevOps

- **Denying `Contribute` on a branch blocks pull-request completion**, not just direct pushes. It
  leaves a pull request unmergeable with the button replaced by "Mark as draft" / "Abandon". Branch
  _policies_ gate completion; the permission does not distinguish.
- **Pull-request descriptions cap at 4000 characters** — characters, not bytes (`len()`, never
  `len(encode())`). `az repos pr update` rejects the whole call rather than truncating, and **on
  create the rejection can be silent**: a 4326-character body vanished with no error on 2026-08-23.
  Check the length before posting; put detail in a thread.
- **The `azure-devops` MCP cannot edit a comment body** (`repo_pull_request_thread_write` is
  create, reply and update_status only). Editing in place goes through
  `az devops invoke --resource pullRequestThreadComments --http-method PATCH`.
- **Thread replies via `az devops invoke` need `threadId` in `--route-parameters`.** PATCH on the
  bare `pullRequestThreads` resource returns "does not support http method 'PATCH'". Comment →
  `pullRequestThreadComments` (POST); status → `pullRequestThreads` (PATCH); both carry `threadId`.
- **Inline threads reject `rightFileStartOffset: 0`** — post with offsets ≥ 1.
- **An Azure DevOps rejection names what was missing, not what is required** (2026-08-24): an
  inline-thread error named only the flat _end_ pair, and a fix written from the message alone
  stated half the four-field set. **Two spellings exist for the same fields**: the MCP takes them
  flat (`rightFileStartLine`), the REST fallback takes them dotted (`rightFileStart.line`). State
  which surface a rule is for.
- **Tags auto-create on first write, but need the project-level `Create tag definition`
  permission** (namespace `Tagging`, action `Create`). **Stakeholder access cannot create one even
  when the permission reads Allow**, so the failure is asymmetric: existing tags write fine, new
  names fail.
- **`az boards work-item relation remove` cannot remove an `ArtifactLink`** — it only takes work
  item ids, and `az devops invoke` crashes internally on a json-patch body. Unlinking a pull
  request from a work item is a UI click.
- **A work item that is `Resolved` with ticked criteria cannot be a pull request's acceptance
  surface.** A review workflow will correctly refuse to read those criteria as that pull request's.

## Archon

Measured on v0.7.0 and v0.8.0, and the last three bullets on v0.10.1. A version pins a fact
here: the 0.x line ships every few weeks, and two machines in this project run two versions.

- **Check which branch a run actually built before trusting its diff.** With no flags Archon
  auto-creates a worktree on `{workflow-name}-{timestamp}`, which is why runs here are named
  `archon/task-*`. A stream measured that passing `--branch` did not continue the existing branch
  and produced a run reviewing an empty diff that looked fine; the CLI reference documents
  `--branch <name>` as "branch name for worktree, reuses existing worktree if healthy", which is a
  statement about the worktree rather than about continuing a branch. **Unresolved:** the two have
  not been reconciled by a measurement. Settle it before relying on either — dispatch with
  `--branch <an existing branch with commits>` and read `git log` in the created worktree. Until
  then, verify the branch the run built rather than assuming the flag did what you meant.
- **A review workflow's `prep` finds the pull request by commit or `--from`, not by the worktree's
  branch name** (measured 2026-09-16). The abandon signal is a wrong pull-request number, not the
  branch name. Do not write "prep finds the PR by the checked-out branch" into an opener; check
  the number `prep` emits.
- **Archon keeps a per-repository base branch in `~/.archon/archon.db`**, set from whatever was
  checked out the first time it ran there, and never re-reads the host's default. Fix it with a
  committed `.archon/config.yaml` (`worktree.baseBranch`, **nested**), not a database row — the row
  is one machine, the file travels.
- **`archon workflow approve <id>` from the terminal approves and resumes.** Approving in the UI
  records `approved` and leaves the run paused forever.
- **`archon --help` hides four verbs: `approve`, `reject`, `resume`, `abandon`.** A session that
  checks help concludes there is no way to stop a run. Read them from the binary instead:
  `strings "$(readlink -f "$(command -v archon)")" | grep -oE '.{55}"abandon".{55}'`. `cancel` and
  `abandon` are aliases. **Absence from `--help` is not absence from the tool.**
- **`abandon` works on a paused run and on a live one.** So the proof recipe for a gated workflow
  is: dispatch with the gate on `hitl`, harvest the artefacts and the run events at the pause, then
  abandon, then complete.
- **`resume` walks through an unresolved approval gate.** A run that died `SIGTERM` while paused at
  a review gate was resumed and posted the whole review with no approval accepted: resume replays
  the DAG from the completed nodes' outputs and does not re-assert a plain approval gate. **A
  crashed-at-gate run is abandoned, never resumed.**
- **Poll `archon workflow get <run-id>`, never `workflow status`**, when more than one run can be
  live — a word match on "paused" in the whole-status JSON reports someone else's gate.
- **`running` in Archon's database is not evidence the run is alive.** A gutted worktree still
  reports `running`. Liveness is: the working path exists _and_ is a git repository.
- **Dispatch detached or task-managed, never as a shell `&` child.** An interactive interrupt kills
  the process group, so a paused run that should wait indefinitely dies instead.
- **Invoke Archon from the registered clone, never from a sibling worktree.** It pins one source
  symlink per repository and refuses a second path **with exit 0** in some hosts, and with a
  visible symlink error carrying a delete-the-workspace hint in others. Do not follow that hint — a
  peer's run may live there. **The isolation comes from the worktree Archon builds, not from a
  flag** — it is on by default and `--no-worktree` is what removes it; `--from` only chooses the
  start point. So the "edit in your own worktree" rule is about editing, not about where you
  invoke from.
- **A run executes the workflow definition from the _invocation_ directory's working tree**
  (2026-08-24). `--from <branch>` checks the branch out, then silently overwrites the worktree's
  tracked `.archon/` from the invocation directory: `git log` reads right and the wrong definition
  runs. To verify a change to a workflow definition, copy it into the registered clone's tree
  uncommitted, dispatch from there, `shasum`-compare the worktree's copy against the branch before
  the gate, and restore the clone afterwards. **That recipe edits the shared clone, so it is an
  exclusive exception to "all feature work in a worktree": take it only when no other session is
  working in that clone, and restore it before releasing the clone. One session moved a shared
  clone under another session's five uncommitted files, and recovery worked only because the edits
  were uncommitted.**
- **Re-copy the definition to the consumer, then run the verification — never run, then patch.**
  What gets verified must hash-match what ships.
- **Harvest before completing any terminal run.** Every workflow writes outward last, so a killed
  run is complete and unconsumed with high probability: a run that died inside its final node had
  its whole product complete and unposted in the artefacts directory, which is repo-relative and so
  existed only inside the worktree. `Status: failed` says nothing about what is on disk.
- **`archon complete <branch> --force` deletes the branch on `origin` too, silently** (measured
  2026-09-16 on v0.8.0: `git ls-remote --heads origin` went from 11 heads to 10, the only change
  being the completed branch; the output said `env_removed` / `Completed:` and nothing about the
  remote). "Keep the branch" and `archon complete` are incompatible on a pushed branch. Pin a
  `refs/rescue/*` ref first, or use `git worktree remove` plus `git branch -D` by hand.
- **Identify the run that owns an `archon/task-*` worktree and check it with
  `archon workflow get <run-id>` before `git worktree remove --force`.** A live run's worktree is
  dirty by construction and looks abandoned; one cleanup destroyed a different session's running
  review. Do not reach for aggregate `workflow status` here — as above, it answers about whichever
  run it feels like, which is how the wrong live run gets authorised for removal.
- **A folder-scoped project registration silently removes the isolation every run relies on**, and
  the dispatch header says "running in place". `archon doctor` passes it. Abandon and check the
  registration.
- **Never upgrade Archon while any run is active** — the package manager swaps the binary under a
  live run. Check for running runs first. The Homebrew tap also lags the CLI's own update check.
- **Config-key claims are testable in about ten milliseconds** with a behavioural probe. Workflow
  nodes take `id:`, never `name:`.
- **A review gate with no `on_reject` destroys every finding on a reject, with no record.**
- **An account with no overage cushion above its rate-limit window stops an unattended queue dead**
  rather than degrading. Check before queueing overnight work.
- **From v0.9.0 a workflow node inherits no ambient MCP server, and a node that lost them finishes
  green.** Measured on v0.10.1, 2026-09-22, against a must-fail control: a node with no `mcp:` field
  saw zero `mcp__` tools, while the same Claude binary in the same directory outside a workflow saw
  them. A second seat measured a declared node seeing 53 tools against a sibling's 28 with no
  browser tools — **and that sibling's run reported success.** So the failure is silent, and every
  prompt that tells a node to use a tracker, a docs server or a design server keeps saying so while
  the node cannot. Read a green Box that needed a server as unproven until you see the server's own
  output.
- **The node field is `mcp:` and it takes a literal relative path** to a file holding `mcpServers`,
  not a server name. Archon reads that file, passes it to the SDK and appends `mcp__<server>__*` to
  the node's allowed tools. The value takes **no interpolation of any kind**, there is **no
  workflow-level form**, and `settingSources: [project]` is **not** an alternative. A wrong value
  fails loudly and fast: `MCP config file not found: <value> (resolved to <cwd>/<value>)`, in about
  14 ms, before the prompt runs, and it fails the whole run. Measured on v0.10.1, 2026-09-22.
- **`archon workflow run` refuses a repository with no git remote**: "Cannot determine git remote
  … Add one with `git remote add origin URL`, or use `--no-worktree`". A throwaway repository built
  to probe a config key has none, so the first run of every probe fails on the environment rather
  than on the thing being measured. Add a dummy remote, or pass `--no-worktree`, which a probe wants
  anyway. Measured on v0.10.1, 2026-09-22, by two seats independently.

## git

- **`git checkout -b <name> origin/<base>` sets the branch's upstream to `origin/<base>`**, so a
  client that pushes to the tracked branch writes to the base branch. Always
  `git push -u origin <branch>` on the first push. This is how one commit bypassed its pull
  request.
- **In zsh, `git show "$B:apps/foo.ts"` silently rewrites the path.** `:a` is a parameter modifier
  and **double quotes do not stop it**: the branch name becomes an absolute path and the leading
  `a` of `apps` is eaten. `$B:scripts/…` breaks through `:s` and can return nothing to a pipe
  rather than erroring, which reads as "the file is not there". Brace it: `"${B}:apps/foo.ts"`.
  This produced two false negatives inside one verification pass on 2026-08-26.
- **A symlinked git hook resolves only while the checked-out branch carries the file.** On a branch
  that predates it the link dangles, git finds no hook, and the guard is silently inert — on the
  very branch it exists to protect. Copy it (`install -m 755`), do not symlink.
- **Global `push.default` was `matching` on this machine until 2026-09-01.** A bare `git push`
  pushed every name-matching local branch, other worktrees' branches included. Now `simple`;
  explicit refspecs stay good practice on a shared clone.

## Writing and reading claims

These are not tool facts. They are the shapes in which agent sessions, including this one, have
been wrong — and each was caught by a check that was one command away.

- **Ask what produced the signal that something was checked.** The expensive failures in this file
  share one property: the observable that reads as "checked" is produced by something other than
  the check. A workflow node that lost its MCP servers finishes green, because green is produced by
  the node ending, not by the servers answering. A section of this file described a review rule
  correctly for seventeen days while the ruleset holding it was disabled, because the rule block
  renders identically either way. An entry kept through a review of a memory index looks reviewed
  afterwards, and reviewing whether it is still _needed_ produces exactly the same signal as
  reviewing whether it is still _true_. In each case the artefact was honest and the reader's
  inference was not. **So name the thing that would have to be false for the signal to appear
  anyway, and go look at that.**

- **Assert from a command, not from inference.** Five public errors in one day shared this shape:
  a claim about a flag's behaviour, about a permission's effect, about a file's staleness read from
  the wrong branch, about threads that could not exist, and an instruction that deleted a file the
  speaker had just committed.
- **A recommendation is a claim, and goes through the same freshness check.** A recommendation to
  drop a build setting rested on an assumption that two documentation calls refuted. A
  recommendation is what a maintainer acts on fastest, so it is the worst place for an inference.
- **A negative about something that arrives asynchronously is not a measurement from one
  observation.** Say "none at HH:MM" and name the floor you waited, or wait it out.
- **A negative claim from a directory listing is as weak as a positive claim from memory** — the
  thing may live in a fourth place. A globally installed skill is invisible to a project listing.
- **Verify an absence at the place the artefact would be, on the branch that produced it.** A
  claim that thirteen findings "reached nowhere" was closed by one `git show`: they were in the
  run's own report on its own branch the whole time. Trace the writer first — grep the field, find
  its one reader, check whether that node ran. A false absence propagates faster than a false
  presence, because nobody re-opens a file to confirm something is still not there.
- **A cost claim is a claim about the present, so check the thing is not already broken before
  costing the change that would break it.** Same family as the bullet above, and refuted the same
  way — one command. Two on one day: that install-time substitution would stop an installed
  workflow being identical to its shipped copy, when all four installed copies already differed
  from theirs by a generated header line; and that a plugin hardcodes an organisation in a config
  file that turns out to belong to the consumer. Both were asserted from how the thing ought to
  work. A wrong cost is expensive in its own way — it argues against a good option for a reason
  that does not exist, and nobody re-checks a reason that sounded like caution.
- **A closed ticket's summary of a measurement is a lossy copy; the register is the original.**
  Same family again. A two-line answer on a ticket said mechanisms reach the implementer where
  documents did not. The register behind it stated a confound in the same sentence as its verdict,
  scored three of six predictions wrong — the three the seal itself called its strong test — recorded
  a human producing one of the outcomes, and called one arm a weakened seal. A summary drops
  conditions because that is what a summary is for, and the loss is invisible because what remains
  is true. So open the file the ticket points at before building on it, and **if the ticket names no
  file, treat the claim as unsourced rather than as measured** — that sentence is the one that would
  have saved a round trip between two seats, because the register was in this repository at a path
  no ticket named.
- **A paraphrase of a decision is a claim like any other.** Grep the row before handing a worker
  its framing.
- **When an amendment describes an artefact that exists, quote the artefact, not the decision that
  produced it.**
- **A claim in a pull-request description or a decision record outlives the commit that falsifies
  it.** Nothing re-reads prose when a later commit invalidates it. Two counter-rules: the author
  re-verifies the description's claims against the final diff before handover; and a ticket
  touching a command names that command's own decision records among the surfaces it repoints.
- **All-negative acceptance criteria pass on an inert artefact.** Every criterion describing an
  absence was satisfied by a configuration that could not open a file. Require one able-to-act
  criterion.
- **A statement about the process is not a statement about the state.** "The claim step has not
  run" is not "the ticket is unclaimed" — the assignee is the claim; check it.
- **A standing rule outranks a later ad-hoc relay** unless the relay names the rule and says it is
  being changed. That precedence is what lets a worker refuse a wrong instruction, so never send
  one that bends a rule silently.
- **The four reads apply to instructions, not only to acceptance criteria.** Before sending a step,
  ask which steps could be dropped with no effect on the outcome. A wrong fact once became a
  _gate_, and two sessions spent three exchanges verifying a condition that did not matter. A
  vacuous instruction costs what a vacuous criterion costs.

## Environment

- **Absolute paths in every `Bash` call** where `cd` does not persist between calls, and **never a
  foreground `sleep`** where the harness blocks it: it kills the compound command silently, so a
  polling read comes back as "nothing yet".
