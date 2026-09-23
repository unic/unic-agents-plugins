# DLC e2e fit-gap: which steps work by context, 2026-09-23

Research for [#539](https://github.com/unic/unic-agents-plugins/issues/539), under the map
[#538](https://github.com/unic/unic-agents-plugins/issues/538).

**Question.** Can the DLC as it stands, adapted by context the way an existing Consumer adapts it,
plus a Practice Pack for e2e, run `/specs`, `/tickets`, `/build`, `/pr-review` and `/qa` to produce a
reviewed Playwright suite at the second Consumer? Which steps work with context alone, and which Box
changes are unavoidable?

**Sources.** This repository only, on `develop` at `ac95469`: the four
`apps/claude-code/unic-archon-dlc/.archon/workflows/unic-dlc-*.yaml` files, `commands/specs.md`,
`commands/tickets.md`, `commands/setup.md`, the plugin `README.md`, `CONTEXT.md` and `docs/adr/`, the
vendored Methods under `vendor/mattpocock-skills/skills/engineering/` (`tdd`, `implement`,
`code-review`, `to-spec`, `to-tickets`), plus `docs/agents/agent-tool-traps.md` and
`docs/research/2026-08-31-dlc-run-2-findings.md`. Every citation names a step or node, never a line.
Read only: no Box, command or ADR was edited.

**The two cases.**

- **Case A.** e2e tests for a feature that already exists.
- **Case B.** e2e tests written first for a new feature, which `/build` then implements across
  frontend, backend and API.

**The three classes.**

1. Works with config (`.archon/unic-dlc.config.yaml`) and `docs/agents/` context alone.
2. Needs a Practice Pack skill or Method.
3. Needs a Box change.

## Answer

| Step         | Case A: existing feature                                       | Case B: test first, new feature                                |
| ------------ | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `/specs`     | 1                                                              | 1                                                              |
| `/tickets`   | 1, and 3 only if testability must be refused rather than asked | 1, and 3 only if testability must be refused rather than asked |
| `/build`     | **3, unavoidable**                                             | 2, and 3 only if a browser MCP server must reach the RED node  |
| `/pr-review` | 1                                                              | 1                                                              |
| `/qa`        | 1, and 3 only if an AFK e2e failure must file a finding        | 1, and 3 only if an AFK e2e failure must file a finding        |

One Box change is unavoidable: `/build`'s RED phase for Case A. Every other class-3 entry is
conditional on a decision the map has not taken yet.

## The known facts, verified

**/build's RED "exit code == 0" branch blocks the whole build.** Verified. In `unic-dlc-build.yaml`,
node `run-build`, § RED step 4: "If exit code == 0 (test unexpectedly PASSES before any impl): Do NOT
commit. The test does not capture new behaviour. Update build-state.json: red_unexpected_pass = true".
§ Step 2 opens with: "First, if ANY slice has `red_unexpected_pass: true` in build-state.json, the
build is blocked". It prints "BLOCKED: <id> red-unexpected-pass" and does not emit COMPLETE. So one
slice blocks every slice after it, not only itself.

The rule is a decision, not an accident. ADR `0023-build-generic-red-green-refactor-loop` § 3 says a
test that passes early is flagged "because a test that passes before any implementation is not
testing the new behaviour", and that "Slices carrying `test_command_planned: true` write the test as
part of the slice, then follow the same exit-code gate". So `test_command_planned` is no way round it.

**`/setup` replaces `.archon/methods/` wholesale.** Verified. `commands/setup.md` Step 5, the Methods
bullet: "Copy clean: replace `.archon/methods/` wholesale, so a Method dropped from a later Plugin
version cannot linger." The managed `CLAUDE.md` block it writes says the same to the Consumer:
"`.archon/methods/` is replaced wholesale on every `/unic-archon-dlc:setup` run." The only exception is
a `LICENSE` file. Step 5 also retires both old override paths: "a `.archon/methods.local/` directory,
and any `methods.<name>.source` key in the config" now "resolve nothing".

**Nodes reach MCP servers only through a node-level `mcp:` line.** Verified in
`docs/agents/agent-tool-traps.md` § Archon: "From v0.9.0 a workflow node inherits no ambient MCP
server, and a node that lost them finishes green", and "The node field is `mcp:` and it takes a
literal relative path to a file holding `mcpServers`". It has "no workflow-level form". None of the
four Box files carries an `mcp:` line today (a search for `mcp:` under `.archon/` finds nothing). That
is [#425](https://github.com/unic/unic-agents-plugins/issues/425), still open, and it affects every
tracker call in every Box, not only e2e.

## Per step

### `/specs`: class 1 in both cases

`/specs` is a command, so it runs in the live session, not in an Archon node.

- **It reads the Consumer's testing bar.** Step 5, § Read the Consumer's testing bar first, reads
  "its root `AGENTS.md` and `CLAUDE.md`", the ADRs "that decide a testing approach", and "the tests
  that exist in the repository". Then: "**Propose from that bar.**" A Consumer that writes "an
  acceptance criterion is an e2e scenario at the browser seam" into its `CLAUDE.md` gets e2e seams
  proposed at Halt 2 without any Box change.
- **The Method points at the e2e seam already.** The `to-spec` Method, step 2: "Use the highest seam
  possible." A browser-level test is the highest seam a web feature has.
- **The PRD shape is config.** Step 7 reads `templates.prd`, and "every `##` heading in
  `PRD_TEMPLATE` must appear in the content", and "If a heading is missing, fill that section and
  check again. Never write a partial PRD." So a template heading such as `## E2E scenarios` is
  enforced as present on every run, from config alone.
- **Case A needs `/specs` too.** `/qa`'s `bootstrap` sets `no-prd` when
  `<artifacts_dir>/<slug>/PRD.md` is missing, and `/tickets` Step 2 stops without it. So an existing
  feature still goes through `/specs`, with the feature itself as the source. Step 4's
  `source-present` branch reads a tracker item, a docs page or a design, which fits "the feature as
  documented today".

**Limit.** The heading check proves a section exists, not that each criterion is testable. Refusing
an untestable criterion would need new text in Step 5 or Step 7: a command change, so class 3.

### `/tickets`: class 1 in both cases, class 3 to refuse rather than ask

- **The Nyquist gate asks for a seam, but does not demand a command.** Step 5 (nyquist-map): "Set
  exactly one of: `test_command` ... `test_command_planned: true`", and planned is used "when no
  runner exists yet or the test is itself the deliverable. This is not a failure". Step 6 dimension 4
  checks only that "every slice has `test_command` or `test_command_planned: true`".
- **Case A fits the planned wording exactly.** "The test is itself the deliverable" is Case A. But
  planned leads straight into the `/build` block above.
- **Case B fits `to-tickets`.** The Method: "Each slice cuts a narrow but COMPLETE path through every
  layer (schema, API, UI, tests)". Frontend, backend and API in one slice is the Method's own shape.
  The Harness litmus in Step 4, "one slice = **one demoable behaviour**", maps to one e2e scenario.
- **Context levers exist.** `templates.issue` is config, so an issue body can carry the scenario.
  Step 3 reads "all ADRs in `docs/adr/`", and Step 6 checks "every binding decision in `CONTEXT.md` /
  the ADRs is addressed by some slice". A Consumer ADR that says "every user-facing slice carries a
  runnable e2e `test_command`" reaches the plan-checker as a decision to cover.

**Where the testability demand could sit.** Three places, weakest first:

1. Consumer context only: the `CLAUDE.md` testing bar (read by `/specs` Step 5), a `## E2E
scenarios` heading in `templates.prd` (enforced present by `/specs` Step 7), and a Consumer ADR
   (checked by `/tickets` Step 6 decision coverage). Class 1. It asks, and the human at the gate
   decides.
2. `/tickets` Step 5 and Step 6: forbid `test_command_planned` for a slice that carries a
   user-facing criterion, and add a fifth dimension that maps each PRD criterion to a slice with a
   runnable `test_command`. Class 3, a command change.
3. `/specs` Step 5: refuse Halt 2 when a criterion names no observable outcome at a seam. Class 3.

The run-2 register warns about option 1: "a criterion is not a mechanism". A rule written into every
slice as a criterion "failed three times" there (`docs/research/2026-08-31-dlc-run-2-findings.md`,
§ F1). It also records a tension between narrow per-slice commands and cross-slice regressions (row
53): "`/tickets` validates that a command exists, never that the set can see a cross-slice
regression."

### `/build`: class 3 for Case A, class 2 for Case B

**Case A is blocked by design.** A slice that tests an existing feature writes a test that passes on
the first run. RED step 4 then sets `red_unexpected_pass`, and Step 2 blocks the build. Nothing in
config or context changes that: the exit-code rule is written in the node prompt, and ADR-0023 § 3
states the premise it rests on. Even if RED passed, GREEN step 1 asks for "the MINIMUM implementation
to make the committed test pass" and step 3 commits "the implementation file(s)", which do not exist
for Case A.

A Box change here also needs a new anti-cheat proof. A characterisation test that passes proves
nothing on its own. The loop needs another way to show the test can fail, for example by breaking
the behaviour and restoring it. Which proof is a decision for the map, not for this note.

**The Consumer-side escape hatch is still a Box change.** The plugin `README.md`: "Wanting a variant
of a bundled Box is the one supported escape hatch: copy it to a name outside the `unic-dlc-*` set."
`/setup` then leaves it alone. That avoids editing the plugin, but it forks the Box in the Consumer,
and the fork drifts from every later plugin release.

**Case B works mechanically with context.**

- RED step 2 runs "the slice's `test_command`". A Playwright spec against a feature that does not
  exist exits non-zero, so RED commits and records `red_exit`.
- GREEN implements across layers in one fresh iteration, as the slice demands.
- `verification` step 1b runs the `e2e` key "IN ADDITION to step 1, never instead of it", and "A red
  e2e is a blocker". `goals-check` needs "BOTH a test and an implementation" per criterion, which Case
  B produces.
- The environment is context. `bootstrap` runs `sdlc_needs.install` once for the run. A Consumer can
  put the browser install in that command. Starting the app for the test is the Consumer's own
  Playwright config, since node `verification` says "append no flag of your own to a key that is
  set". [NEEDS SOURCE]: whether the backend and API the second Consumer needs
  can start inside an Archon worktree is not measured anywhere in this repository.

**Why Case B is class 2 and not class 1.**

- **The Methods know nothing about browser tests.** `run-build` Step 0 reads only
  `.archon/methods/tdd/` and `.archon/methods/implement/SKILL.md`, "by this literal repo-relative
  path", and RED step 1 says of `tdd`: "It is the reference; do not re-derive its rules or substitute
  your own." `tdd` covers test shape in general. Locators, waiting and fixtures are not in it.
- **A Pack cannot live where the Methods live.** A Pack placed in `.archon/methods/` is deleted by the
  next `/setup`, and no node would read it anyway, since every node reads a fixed list of paths. That
  is [#520](https://github.com/unic/unic-agents-plugins/issues/520).
- **One context channel reaches the RED node.** `run-build` Step 0 point 1 tells the node to read
  "`<ARTIFACTS_DIR>/<SLUG>/PRD.md` § Testing Decisions" for every slice with a `test_command`. That
  section comes from `/specs` Halt 2, which comes from the Consumer's testing bar. So e2e conventions
  written in the Consumer's `CLAUDE.md` can travel `CLAUDE.md` → PRD Testing Decisions → RED. The
  `tdd` Method adds one more: "read `CONTEXT.md` (if it exists)".
- **Prose alone reached the implementer badly last time.** The run-2 register: "the documentation
  reached the planning legs and the review nodes, and not the implementer", and a Consumer ADR was
  "loaded every turn, violated again". So the Pack's rules that matter most should be mechanisms the
  `test_command` or a lint key runs, not prose. The map's CI rule, "a generated test depends on
  nothing agent-side", is the first candidate.

**Two weaknesses in Case B that no context fixes.**

- **RED can fail for the wrong reason and still pass the gate.** RED step 3 checks only
  "If exit code != 0". A spec that fails because the server did not start, or the browser is missing,
  exits non-zero too, and is committed as a valid RED. The `tdd` Method says "Red before green" and
  nothing about why a test is red. A Pack can ask the node to check the failure reason. Only a Box
  change can make the gate check it.
- **A browser inside the node needs a Box change.** If the Pack wants the RED node to explore the page
  through a browser MCP server, `run-build` needs an `mcp:` line, which waits on #425. Using
  Playwright's own CLI through `Bash` needs no MCP. [NEEDS SOURCE]: whether a CLI-only RED writes
  usable locators for the second Consumer's pages is unmeasured.

### `/pr-review`: class 1 in both cases

- **Standards come from the repository.** The `code-review` Method, step 3: "Anything in the repo that
  documents how code should be written". The `review` node lists "CLAUDE.md / AGENTS.md /
  CONTRIBUTING.md / CODING_STANDARDS.md — whatever exists". So e2e standards in one of those files, or
  in a file they point at, reach the Standards axis. [NEEDS SOURCE]: whether the sub-agent follows a
  link out of those files is not measured; putting the rules in the files themselves avoids the
  question.
- **Spec works for both cases.** `prep` § 3 builds the Intent Brief from linked items, docs, the PR
  body and `PRD.md`, with "a numbered Acceptance Criteria list". The Spec axis then checks the tests
  against the criteria, which is what an e2e suite for Case A is.
- **The review runs no tests.** `bootstrap`: "This Box runs no build, lint, type-check or test command
  by instruction". That matches settled point 4 of the map, which keeps both axes unchanged.
- **The tracker calls depend on #425.** `prep` and `post` both reach the tracker through the server
  § Access names. With no `mcp:` line, that access is absent from v0.9.0 on. This is a general Box
  defect, not an e2e gap.

### `/qa`: class 1 in both cases, class 3 only for AFK findings or an e2e floor

- **It runs the suite.** Node `e2e` runs "the `e2e` key of `$bootstrap.output.sdlc_needs`" and sets
  pass, fail or unresolved. A zero-test pass is reported as "**suspicious**".
- **A red e2e holds the merge.** Node `merge`: `when: "$test.output.result == 'pass' &&
$e2e.output.result != 'fail' && ..."`. So a failing e2e test never merges, in either gate mode.
- **An unresolved e2e does not hold it.** Node `e2e`: "Unresolved is non-blocking here — only the test
  floor holds the merge". For work whose whole output is an e2e suite, the map may want e2e as a
  floor. That is a change to the `merge` clause, so class 3.
- **A failing e2e files a finding only through a human.** Findings are filed in `uat-gate`'s
  `on_reject`, and `uat-gate` runs only `when: "$bootstrap.output.gate == 'hitl'"`. Under `afk` the
  gate is skipped, `merge` is skipped by its `when`, and no tracker item is created. Filing one
  automatically is a Box change. This is the map's open point "What `/qa` does with a failing e2e
  test".

## What this does not settle

- Which proof replaces "exit code != 0" for a characterisation slice in Case A.
- Whether the Case A change is a plugin Box change or a Consumer-owned variant under another name.
- Whether testability is asked (context) or refused (command change) in `/specs` and `/tickets`.
- Where the e2e Practice Pack lives so that `/setup` does not delete it, which is #520.
- Whether the second Consumer's backend and API start inside an Archon worktree.
- The iteration cap and the time cap for a full-stack GREEN iteration. `run-build` sets
  `max_iterations: 60` and `idle_timeout: 900000` for the whole loop; nothing here measures an e2e
  slice against either.

## Source map

| Claim                                                                         | Source                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| RED exit 0 sets `red_unexpected_pass`; Step 2 blocks the build                | `unic-dlc-build.yaml`, node `run-build`, § RED step 4 and § Step 2                  |
| Planned slices follow the same exit-code gate                                 | ADR `0023-build-generic-red-green-refactor-loop`, § 3                               |
| GREEN writes and commits implementation files                                 | `unic-dlc-build.yaml`, node `run-build`, § GREEN steps 1 and 3                      |
| RED reads PRD § Testing Decisions for confirmed seams                         | `unic-dlc-build.yaml`, node `run-build`, § Step 0 point 1                           |
| RED reads only `tdd` and `implement`, by literal path                         | `unic-dlc-build.yaml`, node `run-build`, § Step 0                                   |
| `verification` runs e2e in addition to test; red e2e blocks                   | `unic-dlc-build.yaml`, node `verification`, step 1b                                 |
| `goals-check` needs a test and an implementation per criterion                | `unic-dlc-build.yaml`, node `goals-check`, step 3                                   |
| `bootstrap` installs once from `sdlc_needs.install`                           | `unic-dlc-build.yaml` and `unic-dlc-qa.yaml`, node `bootstrap`                      |
| `/setup` replaces `.archon/methods/` wholesale                                | `commands/setup.md`, Step 5, the Methods bullet, and the managed `CLAUDE.md` block  |
| Variant Box under another name survives `/setup`                              | plugin `README.md`, the variant paragraph; `commands/setup.md` Step 5, The Boxes    |
| Nodes get MCP only through `mcp:`; no workflow-level form                     | `docs/agents/agent-tool-traps.md`, § Archon                                         |
| No Box carries an `mcp:` line                                                 | search of `apps/claude-code/unic-archon-dlc/.archon/` for `mcp:`, no match          |
| `/specs` reads `CLAUDE.md`, `AGENTS.md`, ADRs and tests for the bar           | `commands/specs.md`, Step 5, § Read the Consumer's testing bar first                |
| PRD template headings are enforced present                                    | `commands/specs.md`, Step 7                                                         |
| "Use the highest seam possible"                                               | `vendor/.../to-spec/SKILL.md`, step 2                                               |
| Nyquist allows `test_command_planned`; plan-checker checks presence only      | `commands/tickets.md`, Step 5 and Step 6 dimension 4                                |
| Plan-checker checks decision coverage against ADRs                            | `commands/tickets.md`, Step 6                                                       |
| Slices cut through every layer                                                | `vendor/.../to-tickets/SKILL.md`, slice rules                                       |
| `tdd` says "Red before green", reads `CONTEXT.md`                             | `vendor/.../tdd/SKILL.md`, § Rules of the loop and opening section                  |
| Standards sources are whatever the repo documents                             | `vendor/.../code-review/SKILL.md`, step 3; `unic-dlc-pr-review.yaml`, node `review` |
| `/pr-review` runs no test command                                             | `unic-dlc-pr-review.yaml`, node `bootstrap`                                         |
| Intent Brief carries a numbered criteria list                                 | `unic-dlc-pr-review.yaml`, node `prep`, § 3                                         |
| `/qa` e2e unresolved is non-blocking; fail holds the merge                    | `unic-dlc-qa.yaml`, nodes `e2e` and `merge`                                         |
| Findings are filed only on a HITL UAT reject                                  | `unic-dlc-qa.yaml`, node `uat-gate`, its `when` and `on_reject`                     |
| `/qa` and `/tickets` need `PRD.md`                                            | `unic-dlc-qa.yaml`, node `bootstrap` step 3; `commands/tickets.md`, Step 2          |
| Documentation did not reach the implementer; "a criterion is not a mechanism" | `docs/research/2026-08-31-dlc-run-2-findings.md`, § F and § F1 row 3                |
| Narrow per-slice commands miss cross-slice regressions                        | `docs/research/2026-08-31-dlc-run-2-findings.md`, row 53                            |
| Loop limits `max_iterations: 60`, `idle_timeout: 900000`                      | `unic-dlc-build.yaml`, node `run-build`                                             |
