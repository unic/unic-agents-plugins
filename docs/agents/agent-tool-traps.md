# Traps proven the expensive way

Facts about the tools an agent session drives here — Archon, Archify, Azure DevOps, `gh`, git, pnpm, the
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
- **A subagent spawned with `isolation: "worktree"` cannot run the root gates in place**
  (2026-09-23). The Agent tool puts that worktree under `.claude/worktrees/<agent>/`, and
  `biome.json` ignores `**/.claude`, so `pnpm format` exits 1 with "No files were processed in the
  specified paths" and lists `.` as ignored. The same commit passes `pnpm format`, `pnpm ci:check`
  and `pnpm typecheck` from a worktree outside the clone. The Agent tool chooses the path, not the
  agent, so the rule to put worktrees outside the clone in
  [The pipeline a ticket ends in](dispatching-and-learning.md#the-pipeline-a-ticket-ends-in) does
  not prevent it. Create the worktree yourself with `git worktree add` outside the clone, and spawn
  the subagent without `isolation`.
- **A passing test suite can prove very little.** `pnpm test` passed all day while every command of
  a plugin was broken at step 1 in a real consuming repository. For a plugin, the bar is a
  marketplace install into a consumer, then running the thing.
- **Test both directions.** A `pre-push` hook tested only on the deny path shipped twice broken: it
  let the final unterminated stdin line through, and under zsh it let a protected-branch push
  through entirely, because zsh does not word-split unquoted expansions, so `for x in $LIST`
  iterates once.
- **A check that cannot be made to fail is inert, not passing.** Ship a positive control beside it.
- **Run `pnpm ci:check` before a push, not only `pnpm format`.** `pnpm format` runs
  `biome format --write`, which never applies the `organizeImports` assist, while `biome ci` fails on
  unsorted named imports. So a file can pass `pnpm format` and turn Root checks red.
  `npx biome check --write <file>` applies the fix. Measured 2026-09-24.
- **GitHub runs pull-request checks on the merge commit, not on the branch.** When CI is red and a
  local `pnpm ci:check` is green, suspect a stale merge base first: `git merge origin/develop`, re-run,
  push. Biome's "Found N infos" line exits 0, so find the step that exits non-zero (2026-06-09,
  PR #235).
- **Run `pnpm format` after editing one cell of a Markdown table.** Prettier pads every cell to the
  widest in its column, so one changed cell re-pads the whole table, and a commit without the
  realignment fails Root checks (2026-07-03).
- **Keep a gate's output and exit code visible.** `cmd >/dev/null 2>&1 && echo ok` prints nothing on
  failure, and nothing is easy to read as a pass. Run `cmd; echo "exit: $?"` (2026-06-05, PR #198:
  a failed typecheck was committed this way). The failure there was `tsc --checkJs` typing a
  `catch (err)` binding as `unknown`; read its fields through a JSDoc cast,
  `/** @type {{ status?: number }} */ (err).status`.
- **An `rg --glob` pattern with a slash is anchored to the working directory, not to the search
  path.** `rg <path> --glob '!test/**'` still searches `<path>/test/`. Write `--glob '!**/test/**'`.
  It fails towards more matches, so a criterion written as "this `rg` finds nothing except under X"
  can become unsatisfiable (2026-08-13, #348; re-measured 2026-09-24).

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
- The two `review_*` bullets are the rule's **configuration**, which is still what it holds and what
  would resume the moment it is re-enabled. They are not what happens today.
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
- **Reading and flipping it, since no Settings page shows a ruleset.** List with
  `gh api repos/<org>/<repo>/rulesets`, read one with `.../rulesets/<id>`, and the field to judge by
  is `enforcement`. Turning it back on is `gh api -X PUT .../rulesets/<id> -f enforcement=active`,
  which needs repository admin and applies to every pull request in the repository, not to yours.
  Measured 2026-09-22.
- **Requesting the review by hand** is the GraphQL `requestReviews` mutation with
  `botIds: ["BOT_kgDOCnlnWA"]` for `copilot-pull-request-reviewer[bot]`. Re-derive that id rather
  than trusting this line, from any pull request the bot has reviewed:
  `gh api repos/<org>/<repo>/pulls/<n>/reviews --jq '.[].user.node_id'`. A hardcoded id with no way
  to re-derive it is the next stale constant. Measured 2026-09-22 against pull request #510, where a
  request by hand was answered in two minutes on a **draft** — so the draft state changes nothing
  while the ruleset is off.
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
- **Check which field a work-item type renders before writing to it.** On one board measured
  2026-09-01 the Bug form shows `Microsoft.VSTS.TCM.ReproSteps` and not `System.Description`, so
  text written to the description was stored and never seen. User Story and Task render
  `System.Description`. After any programmatic write, read the fields back.
- **Editing a work item never removes old text.** Every revision stays readable in the History tab
  and through `az devops invoke --area wit --resource revisions`. To stop an item carrying something,
  create a new item and remove the old one (2026-08-31).
- **`az boards work-item update --fields "<Field>=<value>"` replaces a scalar field cleanly;
  `System.Tags` is the exception**, because Azure DevOps merges tags additively, so a tag removal
  fails where every other field succeeds. Do not read a tag failure as "the CLI cannot write work
  items" (2026-09-03).
- **`--description ""` is accepted and clears the field with no warning.** A generator that failed
  before a write loop blanked four descriptions through `--description "$(cat missing.html)"`
  (2026-09-02). See the destructive-write rule in [Environment](#environment).
- **`az devops invoke` parses `--api-version` as a float.** `7.1-preview.4`, as Microsoft's API pages
  print it, fails with `could not convert string to float: '7.1.4'`. Pass `7.1-preview`; the service
  picks the revision (2026-09-05). Work-item comments have no `az boards` subcommand, so this is
  their route.
- **The `azure-devops` MCP's `wit_query action=wiql` returns only `id` and `url` per item.** The
  `SELECT` columns come back only as `columns` metadata. Reading work items is two calls: the `wiql`
  for ids, then `wit_work_item action=get_batch` with a `fields` array (2026-08-27).

## Archon

Measured on v0.7.0 and v0.8.0 except where a bullet names its own version. A version pins a fact
here: the 0.x line ships every few weeks, and two machines in this project run two versions, so
every bullet added since carries the version and date it was measured on.

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
- **Read a verb's meaning from `archon workflow --help`, and read the binary when help is silent.**
  On v0.7.0 help listed none of `approve`, `reject`, `resume` or `abandon`, so a session concluded
  there was no way to stop a run. On v0.10.1 (measured 2026-09-24) help lists `resume`, `cancel`,
  `abandon` and `respond`, and names `approve` and `reject` only as sugar inside `respond`'s line.
  `cancel` and `abandon` are **not** aliases on v0.10.1: `cancel` stops a run started with
  `--detach`, and `abandon` marks a run cancelled without stopping host work. To read the binary:
  `strings "$(readlink -f "$(command -v archon)")" | grep -oE '.{55}"abandon".{55}'`. **Absence
  from `--help` is not absence from the tool.**
- **`abandon` works on a paused run and on a live one**, but on a live one it only marks the row
  cancelled and does not stop host work (v0.10.1 help, 2026-09-24). So the proof recipe for a gated workflow
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
  were uncommitted.** The copy reads the clone's working tree, not a ref, and it is gated on the
  `.archon` directory mtimes: certain at worktree creation, intermittent on resume. So a run that
  shows no clobber proves nothing; never plan one as evidence. Read from the v0.7.0 binary,
  2026-08-24.
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
- **A node gets `CLAUDE.md` and nothing else by default.** `AGENTS.md` never reaches it, a project
  skill reaches it only with `skills: [<name>]` on the node, and an MCP server only with `mcp:`.
  `settingSources: [project]` changes none of this, and `skills: all` cannot be expressed. A
  misspelt skill name loads nothing and the node continues. Measured on v0.10.1, 2026-09-22.
- **A node's `skills:` limits the node's own agent, not a subagent it spawns.** A `general-purpose`
  subagent sees every skill the host has, whether or not the node declared any: user, plugin and
  project skills, 58 on the machine measured. So a Box that delegates runs on whatever that machine
  has installed, and the YAML does not show it. Three more results from the same run:

  - A declared skill with `disable-model-invocation: true` is not offered. `Skill` refuses it, and
    the node still finishes green.
  - An undeclared skill fails with `Skill <name> is not in this session's skills allowlist`, and the
    node still finishes green.
  - A skill's `references/` files are an ordinary disk read. The declaration only gives the agent
    the base directory.

  Measured on v0.10.1 with Claude Code 2.1.281, 2026-09-24 ([#521](https://github.com/unic/unic-agents-plugins/issues/521#issuecomment-5817026080)). Not measured: whether a subagent inherits the host's MCP servers, or inline `agents:` on a node.

- **To stop a run started with `--detach`, use `archon workflow cancel <run-id>`.** `abandon`
  marks the run cancelled without stopping host work, so it is orphan cleanup, not a stop. Source:
  `archon workflow --help` on v0.10.1, measured 2026-09-24. Whether `cancel` stops a run started
  without `--detach` is unmeasured. Stopping the launching task is not a stop either: on 2026-08-26
  a `TaskStop` on the launching Claude Code task left the run working in later nodes, and on
  2026-08-27 an outside kill of the launching task took two runs down with `SIGTERM`; that
  task-level behaviour is unverified since v0.8.0. A run also keeps working after it opens its pull
  request, and later nodes can push more commits, so judge a run by `archon workflow get <run-id>`
  and by what reaches GitHub.
- **The binary answers "why" and "does this verb exist".** It is a Bun single-file bundle, so
  `strings -n 6 "$(readlink -f "$(command -v archon)")"` extracts the JavaScript. The bundle is
  minified onto few lines, so grep with a window (`grep -oE '.{200}<event name>.{200}'`) and search
  by logger or event name. Read the source before designing a reproduction run (2026-08-24, #411).
- **`$ARTIFACTS_DIR` is outside the repository**, under `~/.archon/workspaces/<workspace>/artifacts/`,
  so nothing written there shows in a pull request. It is reused on resume, so delete a
  presence-checked file before it is re-written, or a stale copy certifies the new attempt. It is
  not `unic-archon-dlc`'s repo-relative `artifacts_dir` key. Measured on v0.7.0, 2026-08-03.
- **Never put `$node.output…` syntax in a dispatch prompt.** Archon interpolates the prompt into
  nodes and resolves every `$node.output.*` token; an unknown one fails the run at node 1 in about
  15 ms with no node error. Describe node outputs in prose. Only `$node.output` was measured;
  write `$ARTIFACTS_DIR` and other `$`-tokens in prose too, as a precaution. A sub-second failure at
  node 1 means template resolution, not the model
  (2026-08-05).
- **A `cancel:` node ends the run `cancelled`, not `failed`**, and the CLI still exits non-zero. A
  node after a conditional `cancel:` is skipped on the green path unless it carries
  `trigger_rule: all_done`. A `script:` node ignores `output_format`: to be read by a `when:`, it
  must print `JSON.stringify(...)`. `when:` parses only `$nodeId.output <op> 'VALUE'` with `&&` and
  `||`, and skips the node on anything else. Measured on v0.7.0, 2026-09-04.
- **A config-key probe needs five runs, one of them with no `worktree:` block at all** as the
  control, and remote names unique to the run: `~/.archon/archon.db` keys a codebase by remote URL
  and reuses its stored path, so a reused name breaks the next probe. Measured on v0.7.0,
  2026-08-25.
- **`archon.db` stores UTC; `stat` and `ls` print local time.** The offset once turned a mid-run
  install into a post-run human one. Convert in the query, `datetime(created_at, 'localtime')`, or
  on the file side with `TZ=UTC stat -f '%SB' <path>` on macOS or `TZ=UTC stat -c '%w' <path>` on
  Linux (2026-09-03, #430; the Linux form is unmeasured here).
- **A killed run is recoverable from `archon.db`.** Every `tool_called` row in
  `remote_agent_workflow_events` carries the tool's full input, so each `Write` and heredoc a node
  made is there verbatim after the worktree is gone; `node_completed` rows show how far it got
  (2026-09-02). Harvest the worktree first; the database is the fallback.
- **A resumed run keeps only the resumed segment's cost and start time.** Resume after a `hitl` gate
  rewrites `started_at` and `metadata.total_cost_usd`, so the database reports a fraction of the
  real cost. Check per-node `duration_ms` in the run's `.jsonl` log before quoting a cost
  (2026-08-26).

## Archify

Measured on the vendored Archify `version: "2.17"` (`.agents/skills/archify/SKILL.md`
frontmatter) on 2026-09-25, while drawing the `unic-archon-dlc` pipeline diagrams (#564) and
command diagrams (#565).
Re-check every bullet in the commit that upgrades Archify, and update or delete it there.

- **Put what a workflow node writes in its `sublabel`.** A node's `tag` renders with
  `data-detail="fine"` (`.agents/skills/archify/renderers/workflow/workflow-compiler.mjs:4202`),
  so the viewer shows it only when zoomed in, and a PNG export leaves it out. `validate`,
  `deliver` and `visual-check` all pass with the text invisible.
- **Give `mainPath` only a chain whose columns never decrease, and wrap a longer chain.** `col`
  runs from 0 to 5 (`.agents/skills/archify/schemas/workflow.schema.json:275-278`), and
  `mainPath` refuses a step to a lower column with "moves backward from col N to M"
  (`workflow-compiler.mjs:2441`). A chain of more than six nodes therefore needs a lane per extra
  node. The four pipeline diagrams here left the `workflow` type for this reason, as the next
  bullet describes.
- **Choose the `architecture` type for a flow that runs top to bottom, or for a chain longer
  than six nodes.** Workflow lanes are always horizontal rows, and `workflow.schema.json` has no
  orientation field. The `architecture` type places each component by `pos`, so the layout is a
  matter of coordinates. Every diagram under `apps/claude-code/unic-archon-dlc/docs/architecture/`
  uses it. The box set places its Boxes in columns. Each pipeline stacks one region per group of
  nodes from top to bottom, and places that group's nodes left to right inside its region.
- **Size a diagram by the height of a 1440 by 900 screen.** The viewer scales the diagram to the
  width of its panel, so a tall, narrow viewBox grows downwards. `deliver` refuses a viewBox
  wider than about 1240 at that screen, because node text would drop below 6 px, and
  `visual-check` refuses any page taller than the screen. Ten pipeline nodes in one column
  measured 2161 px tall. Rows of three or four nodes fit, with one card below.
- **Give each step its own box only up to about eight steps, and group a longer command into
  phase boxes.** `deliver` refuses two consecutive boxes closer than 24 px ("Connection
  "step-1->step-2" is too short (16px; minimum 24px)"), so the screen height in the bullet above
  holds about eight boxes in one column. The first `/tickets` draft, eleven steps in one column,
  measured a 1207 px page at 1440 by 900. Rows of three or four steps, as in the pipelines, fitted, but the maintainer
  rejected them as hard to read. A phase box names its step range, for example
  `4-7 Slice and check`.
- **Keep every node that is not a member clear of a region's title, or the frame grows over it.**
  The renderer lifts a region title above any component the title overlaps, member or not
  (`.agents/skills/archify/renderers/architecture/render-architecture.mjs:248-255`), and under a
  quality profile it extends the frame up to the lifted title (`:267-269`). A one-member "Tracker
  writes" region in the `/specs` command diagram framed the two nodes above its member. Removing a
  region can also break `visual-check`. The viewBox narrows, the viewer scales the narrower diagram
  up to its panel width, and the page grows taller. Dropping that region took the `/specs`
  page from under 900 px to 909 px.
- **Expect nested region labels to stack 2 px apart, whatever `pad` says.** An `architecture`
  region puts its label just above its first member, and lifts it only as far as clears another
  label (`.agents/skills/archify/renderers/architecture/render-architecture.mjs:212-215` and
  `:254`). `pad` moves the frame, not the label, and the top pad is never below 22 px
  (`:118-122`). A `pad` larger than the label needs leaves an empty band above the label.
- **Export a PNG preview through the viewer's own Export > PNG, driven over CDP.** The Playwright
  MCP refuses `file:` URLs, and the viewer's PNG button fires no download while
  `window.showSaveFilePicker` exists (observed, not traced in the vendored source). The route that
  worked, as one Node ES module run from the worktree root:
  1. Import `ChromeVisualBrowser` and `findChrome` from `.agents/skills/archify/bin/visual-check.mjs`.
     Construct `new ChromeVisualBrowser(findChrome())`, which launches Chrome, and await its
     `sessionPromise` for the `sessionId`.
  2. Send every CDP command with `browser.cdp.send(method, params, sessionId)`. Send
     `Emulation.setDeviceMetricsOverride` (1600 by 1000). Per export, send
     `Browser.setDownloadBehavior` without a `sessionId`, with `behavior: 'allow'` and a fresh,
     empty, absolute `downloadPath`.
  3. Navigate to the HTML's `file:` URL with `?theme=light` or `?theme=dark`, and wait for
     `Page.loadEventFired`.
  4. With `Runtime.evaluate`, set `window.showSaveFilePicker = undefined`, click the button whose
     text includes `Export`, wait 300 ms, and click the button whose text includes `Lossless image`.
  5. Poll the download directory for the `.png`, and rename it to `<diagram>.<theme>.png`.
  6. Scale each file to 2620 px wide with any image tool. On macOS,
     `sips --resampleWidth 2620 <in> --out <out>` does it. `sips` does not exist on Linux or
     Windows.
  7. Call `browser.close()`.

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
  very branch it exists to protect. This repository now points `core.hooksPath` at the main work
  tree's `.githooks` on `pnpm install`, which has the same limit: the main work tree must be on a
  branch that carries the hooks, and `prepare` warns when it is not.
- **Global `push.default` was `matching` on the maintainer's macOS machine until 2026-09-22.** A
  bare `git push` pushed every name-matching local branch, other worktrees' branches included. It is
  `simple` there now (re-measured 2026-09-24). An earlier version of this line dated the fix
  2026-09-01, which was false. The Linux machine was never measured, and a global setting does not
  travel, so push with an explicit refspec everywhere.
- **`git check-ignore` never matches a tracked file.** It exits 1 on a tracked path whether or not a
  rule matches, so that exit code says nothing about the rule. Use `git check-ignore --no-index`
  (measured 2026-09-24).
- **`git rev-parse --git-dir` and `--git-common-dir` print a relative path**, relative to the working
  directory. Joined into a path, `git -C <repo> rev-parse --git-common-dir` points into your own
  directory. Pass `--path-format=absolute` whenever the output becomes part of a path (2026-09-22;
  re-measured 2026-09-24). The tell: identical sizes and timestamps from things that should differ
  mean you measured one thing N times.

## Writing and reading claims

These are not tool facts. They are the shapes in which agent sessions, including this one, have
been wrong — and each was caught by a check that was one command away.

- **Ask what produced the signal that something was checked.** The expensive failures in this file
  share one property: the observable that reads as "checked" is produced by something other than
  the check. A workflow node that lost its MCP servers finishes green, because green is produced by
  the node ending, not by the servers answering. A section of this file was published already
  false — the ruleset it described had been disabled twelve days before the file existed — and read
  as checked because it arrived through a reviewed, merged pull request, while a rule block renders
  identically whether or not anyone contrasted it with the ruleset. An entry kept through a review of a memory index looks reviewed
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
  no ticket named. **An index line that drops a fact costs a re-read; one that drops a wrong
  instruction costs whoever follows it.** A memory entry's one-line summary read "it is a repo
  ruleset; review_on_push causes the cost, draft suppresses it, disable never delete" while its body
  still advised `gh pr ready --undo` → push → `gh pr ready` to dodge a review round — a dance that
  buys nothing once enforcement is off, and nothing in the summary hinted it was there.
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
- **A command is evidence only if it can see the shape of the fact** (2026-08-28). A grep for a
  flattened name cannot match a nested source, every `git` subcommand is blind to gitignored build
  output, and an on-disk build can be days stale. For anything that renders, build it and read the
  computed value.
- **Run a check from where the artefact resolves paths, and never truncate it** (2026-08-25, #383:
  three false passes in one session). A relative Markdown link resolves from its file's directory,
  and a `| head` cut a sweep off before the file that held the defects. When the answer is
  "nothing found", run the command once against a known-present case.
- **An absence under the default configuration is not a limit** (2026-09-22). Before writing that
  something cannot reach a node or a tool, spend one run trying to pass it: look for the declaring
  field in the validator's errors or the binary. Until then, write "not by default", not "not
  possible".
- **A probe proves the items it called and nothing beside them** (2026-09-06). Two passing calls
  became "the defaults carry what is needed", and the first real run hung on the one tool the probe
  never called. List what the real run needs and test each item, or set the field.
- **Never ask a session what its own prompt contains** (2026-09-06). Three runs gave three
  contradictory answers. Make it do the thing and report the tool result, with one case that must
  fail as the control.
- **Re-read a document at the moment you claim it leaves something open** (2026-09-05, #456). A
  sentence that joins a query run just now with a body remembered from hours ago lends the stale
  half the fresh half's authority. If part of a claim came from a fresh query, ask which part did
  not.
- **Grep for the fact, not for the heading** (2026-08-31). A regenerated document folds content into
  other sections, so a heading missing from a structural diff is not missing content.
- **A predicted number copied from a ticket is not a done criterion until you have seen the
  mechanism that produces it** (2026-09-08, #476: the predicted `unchanged: 4` could never happen,
  because the content hash includes provenance). Prefer a criterion that reads one field with one
  meaning over a derived count.
- **Prose that describes the state a change will create reads as the state that exists**
  (2026-08-23). Mark each present-tense claim as measured now or created by this change, and write
  the second kind as intent. In review, check each present-tense claim in the diff's prose against
  the tree.
- **A count stated beside the list it counts drifts on the next edit** (2026-08-25). State it once,
  or drop it and let each item carry its own marker. In review, check every "the N …" against its
  list.

## Environment

- **Absolute paths in every `Bash` call** where `cd` does not persist between calls, and **never a
  foreground `sleep`** where the harness blocks it: it kills the compound command silently, so a
  polling read comes back as "nothing yet".
- **A pipe hides the exit code of every command before the last** (2026-09-23).
  `timeout 90 git fetch … | tail -5; echo $?` printed "command not found: timeout", because macOS
  ships no GNU `timeout`, and then printed exit 0, because `$?` reads `tail`. The fetch never ran,
  and the output looked like a fetch with nothing new. The "judge by exit code" bullet in
  [Judging a command](#judging-a-command) does not cover this, because the exit code it reads
  belongs to `tail`. Run the command without the pipe, or set `pipefail` first (`set -o pipefail` in
  bash and zsh). Judge a fetch by the timestamp of `.git/FETCH_HEAD`. In a linked worktree that file
  is per worktree, and `git rev-parse --git-path FETCH_HEAD` prints its path.
- **Run `pnpm install --frozen-lockfile` in a new worktree before any gate.** A fresh worktree has
  no `node_modules`, and `npx biome` then falls back to another install that exited 0 on a file
  the pinned Biome fails (measured 2026-09-24). `pnpm ci:check` fails there with "biome: command
  not found" (2026-09-25).
- **Only a process in a new session outlives the session that starts it on macOS** (2026-08-28).
  `nohup … &`, `nohup … & disown` and `( nohup … & )` all keep the parent's process group and die on
  the `SIGINT` that reaches it; `setsid` does not exist on macOS. Node's
  `spawn(cmd, args, { detached: true, stdio: [...] }).unref()` works on POSIX and Windows. A detached
  dispatch writes nowhere by default, so redirect its output or the run id is lost.
- **Gate a destructive write on its generated input** (2026-09-02). Before a write that replaces a
  field, body or file wholesale, keep a copy of the current value and check the new input exists
  and is not trivially small (`[ -s "$f" ]`). Generate and verify every item before the first write;
  never interleave generate and write per item.
- **`npm install -g` lands inside whichever fnm Node version the shell holds**, and a repository's
  `.nvmrc` can pin that per directory, so the tool is invisible outside that repository
  (2026-09-21). Check `command -v <tool>` from a plain login shell, and prefer a package manager that
  does not nest in a Node version for a binary that must resolve everywhere.
- **Windows CI checks this repository out with CRLF**, because there is no `.gitattributes`. A test
  that reads a file from disk and matches a pattern across a line break passes on macOS and Linux
  and fails on Windows. Normalise on read, `.replace(/\r\n/g, '\n')`. A template literal in the test
  source is already LF (2026-08-10, PR #311).
- **In pnpm 11, `nodeVersion` in `pnpm-workspace.yaml` only feeds the `engines` check**, and
  `useNodeVersion` is removed. The runtime pin is `devEngines.runtime` in `package.json`, with
  `onFail: "download"`. Prove a pin with `pnpm node --version` inside the repository against a shell
  outside it (measured 2026-09-16 on pnpm 11.1.1; the release-note half is unverified here).

## Claude Code

Measured on the Claude Code build each bullet names. Re-measure after an upgrade.

- **Only a routine runs unattended.** `CronCreate` with `durable: true` fires only while a REPL is
  open and idle, and on build 2.1.263 its schema says `durable` has no effect. Routines run in the
  cloud with no terminal, can use claude.ai connectors but no local MCP server, and cannot be deleted
  from the CLI (2026-09-06).
- **A routine's default `allowed_tools` omits `Artifact`**, and the failure is a hang: the run parks
  at `worker_status: requires_action` on a permission prompt and the old page stays up. Set
  `["preset:default", "Artifact"]`, and watch `list_runs` for `requires_action` (2026-09-06).
  Connectors attach by themselves and arrive deferred, so a run must `ToolSearch` first.
  `extra_marketplaces` and `enabled_plugins` are discarded or rejected server-side.
- **A routine's sandbox can obtain what it needs at run time** (2026-09-06). The account's claude.ai
  skills sync into `~/.claude/skills/synced/` and are invocable, and a skill written to
  `~/.claude/skills/<id>/SKILL.md` mid-run is invocable in the same turn. `environment_id` is a run
  location, not a repository; the repository is `session_context.sources[]`. A routine needs exactly
  one of `cron_expression` or `run_once_at`. `get_run_log` lags by up to a minute and truncates a
  long final answer, so ask the run for short output.
- **`claude plugin uninstall` and `claude plugin update` default to `--scope user`.** A
  project-scope install needs `--scope project`, run from the project that owns the record, and the
  default-scope error names a different project's enablement (2026-08-24, 2026-09-05).
- **A `version` in `plugin.json` pins a plugin against `autoUpdate`.** A consumer receives a new
  version when the version string changes on the marketplace's branch, not on every commit, so here
  it arrives when the bump merges to `develop`, before the tag. The exact firing moment is
  undocumented. Source: the version-management note on
  <https://code.claude.com/docs/en/plugin-marketplaces>, read 2026-08-24.
- **`CLAUDE_PROJECT_DIR` is the directory the session started in, not the git root**, and it
  reaches hook processes only: a `Bash` tool call prints it empty. Project settings do not walk up
  from a subdirectory, and a hook in a worktree sees the worktree, not the main clone. Anchor
  per-repository state to `git rev-parse --path-format=absolute --git-common-dir` (build 2.1.278,
  2026-09-22, #516).
- **A skill whose frontmatter sets `disable-model-invocation: true` refuses the `Skill` tool**, and
  says not to replicate its workflow. Here that includes `wayfinder`, `grill-with-docs`, `to-spec`,
  `to-tickets`, `triage`, `implement` and `wait-what`, while `grilling` is not gated (re-measured
  2026-09-24 by grepping `.claude/skills/*/SKILL.md`). When the maintainer types `/wait-what` at you,
  re-state your last point in plainer words; do not report the refusal as a blocker.

## Confluence

- **Confluence storage format drops HTML comments**, so an injection marker must be a visible
  element such as a panel. `panel-warning` comes back as a `note` macro, and a `<time>` element
  loses its label. Read the storage value back after the first write of a new block shape
  (2026-08-26).
