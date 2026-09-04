# 0037. The config declares the SDLC's needs; the Plugin names no tool

**Status:** Accepted (2026-09-04)

## Context

A Box could not check a claim about a build, a lint, a type-check or a test run, for three reasons
stacked on one another. An Archon worktree may or may not carry installed dependencies and no Box asked
for them. `/pr-review` instructed no check anywhere. And the config mapped a command one key per intended
node — `build.e2e_command`, `qa.e2e_command` — so a command had an owner rather than a home, and a node
that wanted one the config did not carry fabricated it instead.

The three interacted. One run's `verification` reported a green suite because that worktree happened to
have dependencies and the node happened to fabricate a command that suited the project. Both were luck.
On a project of another stack the same node runs a command that does not exist and reports a failure
that says nothing about the code.

## Decision

**The config carries one abstract block, `sdlc_needs`, that maps what a software development process
needs; any Box may reach the whole of it; and the Plugin names no tool, ever.** A tenant fills in
whatever their stack uses, and a node decides at run time which of those needs it has.

1. **A key names a need, never a tool.** `test` is a need; a runner invocation is a tool. `check-types`
   is somebody's script name; `typecheck` is the need. This is the rule already written in `AGENTS.md`
   for formatter exclusions, applied to commands — and it is stated **inline in every prompt that
   resolves a key**, because a Box node imports nothing and a rule living only in a document is
   invisible at run time ([ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5). The Plugin
   broke the formatter version of this rule in five places while it lived only in a document, which is
   the evidence that a document-only home does not hold.

2. **Discretion to add, never to subtract.** Any node reaches any key it judges it needs. A short floor
   is mandatory at the two gates that advance work, and abstaining there is a reported non-result, not
   silence. A key no node reads is intended rather than a gap: the block declares what a project **can**
   do, and `build`, `lint`, `format` and `dev` are declared today with no reader precisely so that
   giving one a reader later costs no tenant a reconfiguration.

3. **A command that cannot run is never a pass.** Every node that runs a command reports `pass`, `fail`
   or `unresolved`. One `unresolved` covers both causes — the need is not declared, or it is declared
   and will not run — and the cause goes in the prose, not in the state. A `pass` reporting a zero count
   is reported as suspicious rather than as a green result: that is the shape a command declared against
   the wrong target takes.

4. **The floor is `test`, at two gates.** `/qa`'s `merge` and `/build`'s `evidence` verdict cannot
   advance without a `test` outcome, so `/qa` gains a `test` node of its own — before this it ran no test
   at all and merged on an e2e result that was almost always a skip. One need, one node, one outcome
   field. No other need is mandatory anywhere, so `merge`'s `when:` reads `== 'pass'` for `test` and
   `!= 'fail'` for the rest.

5. **Abstaining and failing to resolve are different, and the difference is _wanting_ the need, not
   declaring it.** A node that never reaches for a check reports nothing; a node that wants a check and
   cannot run it reports `unresolved`. `/qa`'s `e2e` node exists to run the end-to-end suite, so it wants
   it always and a null key there is `unresolved`, never a skip — which is why `skip` leaves the `result`
   enum of `e2e` and `coverage-gate`. `/build`'s `verification` runs e2e only **in addition** to the test
   suite when the key is declared, so it wants no e2e run when the key is null and omits the field
   instead. Without this distinction one implementer holds a merge on an unrunnable e2e and another does
   not, and both satisfy the criteria.

   The same test settles coverage, where the two Boxes land differently on purpose. `/qa`'s
   `coverage-gate` exists to gate on coverage, so it wants a figure always: a null `coverage` key **or**
   a null threshold is `unresolved` there, because a figure nobody can judge is not a pass. `/build`'s
   `verification` runs coverage only when a threshold is configured, so with no threshold it wants none
   and omits the field. A tenant who declares `coverage` and no threshold therefore sees a standing
   `unresolved` in `/qa` and silence in `/build`. That is the rule working, not an inconsistency — but it
   is the asymmetry most likely to be read as one, which is why it is written down here.

6. **A Box that runs checks installs once, at `bootstrap`, and says what it did.** One Archon worktree
   serves a whole run, including `/build`'s fresh red and green contexts, so one install covers
   everything. `/build`, `/qa` and `/pr-review` install with no exception between them, `/pr-review` included even though it is instructed to run no check:
   a review sub-agent that decides on its own that it needs to run something should fail on the merits of
   that decision rather than on which worktree the run drew, and one uniform rule is less to remember
   than a rule with an exception. `/explore` is the fourth Box and does not install: it runs no check,
   so it has nothing to prepare for, and this ticket left it alone by name. `bootstrap` reports either that it ran the declared install command or
   that none is declared. That second report is what stops a later green check reading as proof of a
   deliberately built environment, because dependencies may still be present by the luck this decision
   exists to remove.

7. **A check that could not run reaches the reader as its own block.** Any summary carrying a check
   outcome or an install report also carries, in a structurally separate block, which needs went
   `unresolved` and whether an install ran. The block is **durable** — a file under
   `<artifacts_dir>/<slug>/`, never console output that dies with the worktree. `/build` has `report`
   and `/pr-review` has the summary `post` publishes; `/qa` had neither, so `uat-prep` gains the `Write`
   tool and files `qa-checks.md`. Every field added to a node's output in this decision has a named
   reader in the same change.

8. **`/pr-review` says out loud that it runs nothing.** It gains no procedure that checks a claim
   against an author's assertion — that belongs to a Method, not to this Harness
   ([ADR-0030](0030-harness-hosts-methods.md)) — so its summary block names which needs the project
   declares and states that this Box executed none of them. Without that sentence the admission lives
   only in the Plugin's own issue tracker, where the developer reading a review never sees it.

9. **The two `e2e_command` keys are retired, and the retirement is deliberate.** The
   `qa.e2e_command ?? build.e2e_command` pair becomes the single `sdlc_needs.e2e`. The per-Box override goes on purpose: all
   four values were `null` in the only Consumer that exists, so nothing had ever used that tier, and a
   tier nobody uses is a second place for a value to disagree with itself. `build.coverage_threshold`
   stays where it is — it is a number, not a need.

### Three things a later reader would otherwise re-derive

**Why the block is `sdlc_needs`.** A key names a need, so a name that named the tools a need resolves
_to_ would encode the opposite of the block's own rule: `toolchain` lost on that. `commands` is reserved
twice over in `CONTEXT.md` — a Claude Code slash command claims it, an Archon workflow command template
claims it again — and `capabilities` is taken by System-skill. `lifecycle_needs` says less than the term
the vocabulary now carries. The name is snake_case because every key in the live Consumer config is
snake_case without exception, so this is measured rather than chosen by taste.

**Where SDLC comes from.** Anthropic's _The AI-Native SDLC playbook_
(<https://claude.com/blog/the-ai-native-sdlc-playbook>), which defines the lifecycle as idea to
production across Plan, Design, Build, Test, Deploy and Maintain, and names build, test and lint commands
alongside linting, formatting and type-checking. Eight of the nine keys come from that vocabulary.
`coverage` is the ninth and does not: it exists because `/qa`'s `coverage-gate` and `/build`'s
`verification` both hold a threshold, and once the fabricated literal is removed neither has anything to
execute. The alternative considered was reading a coverage figure out of whatever the `test` command
already reported, with no ninth key; it was rejected because it makes a project whose test command emits
no coverage permanently unresolved whenever a threshold is set, and because the only way to avoid that is
for a Box to append a coverage flag of its own to a project's command — which is naming a tool by
another route. No node appends a flag to a declared command.

**Why criterion 16 widens an existing sweep rather than adding a third.** `/setup` already reads this
project's manifests, task files and scripts once, to find what formats or lints. That same read now
harvests the whole of the SDLC's needs, and the sweep's heading widens with it; the values are offered as
proposals a human confirms or corrects, one need at a time, so a tenant of any stack sees a proposal
drawn from what was detected rather than an empty prompt. A second sweep re-reading the same manifests
for a second purpose is exactly the drift this Plugin keeps filing defects about.

## Consequences

- A Consumer that already has a config needs `/unic-archon-dlc:setup reconfigure` to gain the block:
  `/setup` writes a tenant-owned file once and thereafter only reports on it
  ([ADR-0019](0019-conversational-setup.md), [ADR-0036](0036-setup-owns-a-named-install-set.md)). Until
  it does, every need is null, every check is `unresolved`, and the two gates hold. That is the correct
  failure and it still stops the run.
- Nothing detects a **semantically wrong** command. A tenant who declares a no-op for `test` passes for
  ever. Proposing from detection reduces the chance at declaration time and a zero-count pass is reported
  as suspicious; past that, this is the tenant's problem, and a Harness that judged a tenant's toolchain
  would be naming tools again.
- Outside the floor, a node that simply does not want a check reports nothing, and a reader cannot tell
  that from a node that never considered it. That is the price of discretion, named here so silence is
  not read as coverage.
- Nothing checks that the **next** node to read the block carries the inline rule of decision 1. This
  Plugin does not grep agent prose, so between two hands a missing sentence surfaces on a read or not at
  all.
- **The nine keys are written by hand everywhere that must enumerate them** — each Box's output schema
  and its `bootstrap` prompt, the `/setup` step that asks for them, the README configuration table, and
  the `CONTEXT.md` entry — and nothing checks that those copies agree. Prose describing the block leaves
  the list to count itself, because a number written beside a list drifts the first time a surface is
  added — which happened inside this very decision, when the prompts gained the enumeration. **An
  instruction is the exception**: a `bootstrap` prompt says "ALL NINE keys" on purpose, because a node
  checking its own output needs a number to check against, and "emit them all" is not checkable. So a
  tenth key changes six enumerations and three instructions, and the instructions are the ones that
  must not be softened to avoid the count. This is the cost of the decision, and it is structural rather than careless: a
  schema must enumerate, a table must document, a prompt must instruct. A tenth key must land in all
  six; one that lands in five surfaces as a Box rejecting an object that validates everywhere else. A
  generator would fix it and would be the module this Plugin's no-code rule exists to refuse.
- **In `/build`, the install now runs before `slopcheck`.** `bootstrap` precedes it in the graph, so a
  dependency already committed on the branch is installed — running whatever its install scripts run —
  before the registry check that exists to catch a hallucinated or squatted name. The exposure is
  narrow: at `bootstrap` the tree is the branch as a human left it, and every package a slice adds
  arrives in `run-build`, which is downstream of `slopcheck`. Narrowing it further would mean installing
  somewhere other than `bootstrap` in one Box only, which is the per-Box exception decision 6 refuses.
  Named here so that the next reader weighing the two knows the trade was made rather than missed.
