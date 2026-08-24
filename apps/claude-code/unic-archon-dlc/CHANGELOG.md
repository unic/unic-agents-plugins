# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)

## [0.24.2] — 2026-08-24

### Breaking
- (none)

### Added
- (none)

### Fixed

- **`/pr-review` stops relearning an inline thread's anchor shape by failing.** The `post` node was told to open inline threads and left to discover what a host accepts. Measured on `DXP-DesignSystem` [!5783](https://dev.azure.com/FZAG/dxp/_git/DXP-DesignSystem/pullrequest/5783) on 2026-08-21: the first batch of four was rejected for carrying only a start line and a start offset, and the retry succeeded carrying all four right-file coordinates. The constraint was then saved to the agent's own memory on one machine, so nothing in the Plugin changed and every Consumer — and every fresh context — paid the same failed batch again, which is exactly what [ADR-0012](docs/adr/0012-fresh-context-red-green-separation.md) exists to prevent. The `anchor` branch now carries a generic rule — ask the tracker for an anchor's full shape before the first call and build all of it, never probe by sending a batch and reading the rejection — with the dated evidence beside it, and says that the tenant fact belongs in `docs/agents/issue-tracker.md` § Access. The `fixed` reply branch gains one clause: replying and changing a status may be two separate operations on the same thread ([#407](https://github.com/unic/unic-agents-plugins/issues/407)).
- **`unic-dlc-qa.yaml`'s Method-table pointer names the Plugin whose README it means.** A Box is copied into a Consumer's `.archon/workflows/`, so a bare `README.md` in one resolves against the **Consumer's** root: `DXP-DesignSystem`'s README has a `## Dependency Management` and no Method table, and the pointer led to the wrong document. That is harder to notice than the `lib/methods-manifest.mjs` it replaced, which resolved nowhere. The sweep of all four Boxes required by the ticket found no second instance — every other bare path (`docs/agents/`, `docs/adr/`, `CONTEXT.md`, `README.md` where a node reads the repository under review, `.archon/methods/<name>/SKILL.md`) means the Consumer's own file by design ([#401](https://github.com/unic/unic-agents-plugins/issues/401)).

### Documentation

- **Two doctrines, one for each fix above.** `AGENTS.md` § Plugin doctrines gains a narrow carve-out to the rule that forbids a provider name in a prompt: a **dated evidence citation** may name a host, because a rule earned by a rejected call cannot be re-checked without the run that earned it. A payload, subcommand or flag written as something to send stays forbidden, whether or not a date sits next to it. [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) is amended, not superseded, and the amendment states the premise that failed: a server does not always discover its own API. A second bullet states that a Box is read where it runs, so every reference in one resolves in the Consumer — which of them are bare by design, when a reference has to name this Plugin, and that a bare `ADR-NNNN` in a Box always means a Plugin ADR ([#407](https://github.com/unic/unic-agents-plugins/issues/407), [#401](https://github.com/unic/unic-agents-plugins/issues/401)).

## [0.24.1] — 2026-08-24

### Breaking
- (none)

### Added
- (none)

### Fixed

- **A finding no line of the diff owns keeps one identity across iterations.** `/pr-review`'s finding contract said "one per finding" for the inline plan, which left a finding about the pull request itself needing a `file` it does not have — so a run invented one. The hash is derived from the file, so the same finding hashed differently on every run. Measured on `DXP-DesignSystem` !5775 across two real runs: prior finding `9693284bac96` was left with a live thread and no verdict, and two `still-present` findings carried hashes absent from the prior set, which would have opened duplicate threads the moment either became anchorable again. The Box now separates **anchorable** from **scoped**. An anchorable finding names a file in the changed-file list and a line of its diff. Every other finding is scoped, takes `line: null`, and takes `file` from a closed vocabulary of exactly three literal tokens — `pull request`, `work item`, `repository` — so its hash is the same on every iteration. `reconcile` carries a matched finding's prior hash forward instead of recomputing it, because the thread's marker is the finding's identity and a live thread opened by an earlier iteration holds whatever hash that run computed; only a first appearance computes one. `reconcile` also emits a verdict for **every** prior finding and states the count of prior findings beside the count of verdicts — the review gate now shows both — so a prior thread is never dropped in silence — and `post` prints both counts too, because in AFK the gate is skipped and that line is then the only place the run says every prior finding was answered. A `fixed` finding is named by title under the delta line rather than only counted. The thread plan splits in two: a `reply` entry, one for every prior finding that owns an anchored thread, found by its marker alone and carrying no file and no line; and an `anchor` entry, only for a finding that is anchorable and owns no thread yet ([#394](https://github.com/unic/unic-agents-plugins/issues/394)).
- **Every finding in the `/pr-review` summary now carries its hidden hash marker.** The marker was written only into the inline-thread bodies, so a finding that reached the summary alone left no hash behind and the next iteration read it back as new — which is why the scoped-finding fix above does not work without this one. `synthesize` now opens each rendered finding with `<!-- unic-dlc-pr-review:finding=<hash> -->`, Markdown hides it from the reader, and `prep` reads a hash back from either surface: an anchored discussion sets `anchored` to "true", the summary body sets it to "false".
- **`reconcile` stops letting a changed `file` block a match.** It matched on aspect + file + semantic title, so a finding anchored in one iteration and scoped in the next — two different `file` values by design — read as no match, and step 3 would then rule a live finding `fixed` and reply "✅ resolved" to it. The match is the hash first, then aspect + semantic title, with `file` as corroboration. A second one-off note joins the pre-#281 aspect-rename note: a prior iteration posted by a Box older than the anchorable/scoped rule gave a scoped finding an invented path, so those match on aspect and title alone.
- **`reconcile` rewrites the summary's markers to the hash it settled on.** `synthesize` writes each finding's marker before any prior iteration has been read, so it holds the hash this run computed; for a matched finding that is exactly the hash the carry-forward just retired. Step 5 pasted those sections unchanged, which would have published the stale hash and made the next iteration read the finding back as new — the carry-forward would have worked everywhere except the one surface that outlives the run. A `fixed` finding is now listed with its own marker too, so a finding fixed in one iteration and back in the next returns as `regressed` rather than as new.
- **`post` searches the anchored discussions only when it matches a reply by marker.** The summary now carries the same marker for every finding it renders, so a search across all of a PR's discussions returns two hits for one hash. The summary is rewritten whole from `comment.md`, never replied to per finding.
- **The `reconcile` fallback match stops ignoring `file` in general.** Where no hash matches it compares aspect, semantic title and `file` — with the one exception the change exists for: `file` differing between a path and a scope token is not a mismatch, because a finding anchorable in one iteration and scoped in the next carries two different values by design. Two findings that share a title in two different files stay distinct. All three of these were found by the Box reviewing its own re-copy on [!5788](https://dev.azure.com/FZAG/dxp/_git/DXP-DesignSystem/pullrequest/5788), iteration 1.
- **`regressed` can fire at all.** `prior_findings` recorded no prior verdict, so a finding the previous iteration had RESOLVED read exactly like one it had reported — and the fixed-list markers added above fed it straight back in. It would have been re-reported as `fixed` on every later iteration, and `regressed`, one of the four classifications, could never happen. `prep` now records `prior_verdict` per prior finding, and `regressed` is defined against it.
- **`reconcile` publishes two counts that can come out wrong.** The prior-findings/verdicts pair is reached by looping until it matches, so printing it evidenced nothing. `defaulted_fixed` counts prior findings ruled `fixed` only because nothing matched them — high against a small delta means the match is failing, not that the author fixed everything — and `unmatched_priors` is the number that must be zero. The gate and `post` show both.
- **`post`'s closing line is outside the per-line section.** It sat under the `## Per-line discussions (when inline_comments == "true" …)` heading, which the node is told to skip when the tracker anchors nothing — so with inline off the counts vanished, in exactly the AFK case they exist for. It has its own heading now.
- **A tiebreak where one scoped finding matches two prior findings.** Making a path-versus-token `file` difference "not a mismatch" lets one scoped finding match two priors that share a title in different files, while the verdict rule needs each prior hash used once. Closest semantic title, then anchored, then lexically smallest hash; a prior not picked stays unmatched and is ruled `fixed`.
- **`SESSION/inline.json` is `SESSION/threads.json`.** The file stopped being the inline plan when reply entries with no file and no line joined it, and three call sites already said "thread plan" while the name said "inline". A parenthesis apologising for the name is not the fix for a name.
- **No plugin version number inside the Box prose.** A migration note said "posted before 0.23.1". A version written into prose that ships to a Consumer drifts on its own; the note names the rule the older Box lacked instead. These six were found by the Box reviewing this change's own re-copy on [!5788](https://dev.azure.com/FZAG/dxp/_git/DXP-DesignSystem/pullrequest/5788), iteration 2.
- **A prior finding that was reported fixed and stayed fixed is `retired`, not fixed again.** `prior_verdict` alone did not stop the ledger growing: an already-fixed prior with no match fell through to `fixed` on every later run, was re-listed with its marker, and was read back the next time — so the fixed list grew without bound and the "since iteration N−1" delta counted findings fixed several iterations ago. Measured on iteration 3 of [!5788](https://dev.azure.com/FZAG/dxp/_git/DXP-DesignSystem/pullrequest/5788): 17 fixed against 20 prior findings, inflated by iteration 2's seven. `retired` is a fourth verdict, it leaves the ledger, and it is excluded from the delta. The ceiling is stated where the rule is: a retired finding that reappears two iterations later reads as `new`, because nothing carries its hash any more.
- **`defaulted_fixed` was the `fixed` count under another name, and is now `unverified_fixed`.** "Ruled fixed only because nothing matched them" and "a prior finding with no match this run" are the same condition, so the number carried no information — the exact vacuity it was added to fix. `unverified_fixed` counts `fixed` verdicts resting on absence alone: the prior named a file and a line and this run's diff does not touch that file, so nothing in the diff could have fixed it. A scoped prior counts too, because no diff localises a finding about the pull request or the repository. Found by iteration 3 reading the two definitions against each other.
- **The summary renders every finding, and two nodes check that it did.** Nothing required it. Measured on iteration 2 of [!5788](https://dev.azure.com/FZAG/dxp/_git/DXP-DesignSystem/pullrequest/5788): `findings.json` held 14 findings, five of them `important`, and the posted summary rendered 13 under an `Important (4)` heading. Finding `98a0a1248ed7` passed the confidence threshold, was counted at the review gate, and never reached the pull request — so a reader saw counts that disagreed with the list, and because the summary is where the next iteration reads hashes back, that finding would have returned as `new` for ever. `synthesize` now checks that the severity headings sum to the length of `findings.json` and that every hash appears once as a marker; `reconcile` checks the sections it was handed before finalising, and renders a dropped finding itself rather than publishing a summary that disagrees with its own counts.
- **The `/pr-review` finding contract moves into the `review` node's own prompt.** It sat in a YAML comment above the node, and the prompt told the agent to "apply the contract from the workflow comment above" — a comment is not part of a prompt, so the rule the node had to honour was invisible to it at run time. This is the root `AGENTS.md` prose-Box bar, part 2: every prompt that must honour a rule carries it inline. The comment now points at the prompt instead of restating it.

## [0.24.0] — 2026-08-24

### Breaking

- **`/archon-upgrade` no longer claims to write nothing at all — it writes nothing in the repository it assesses.** The absolute is retracted deliberately, because Step 6's probe is the one method that answers "does the installed Archon still read this key" honestly, and it is behavioural: grepping a binary proves a string is present, not that anything reads it, and `archon doctor` reports nothing about config resolution. The probe writes a config and a one-node workflow inside a throwaway git repository it creates outside every clone; Archon then writes a workspace directory under `~/.archon/workspaces/`, a row in its own store, and one worktree per run. Step 6 deletes the repository and the workspace directory before the report prints; the store row has no cleanup path and stays, named in the report. The command still has no apply mode, amends no ADR, files no issue, and touches no file in the repository under assessment ([ADR-0035](docs/adr/0035-archon-upgrade-report.md), amended).
- **`/archon-upgrade` on the floor version now reports instead of stopping.** Installed `0.7.0` against floor `0.7.0` used to print `nothing to do` and stop, which skipped both unconditional steps — so the ADR-0011 trap re-assertion, the only place those four conventions are re-asserted, never ran on the version most Consumers have installed. That branch now skips Steps 2–4 and runs Steps 5 and 6: they assess what is already shipped, not the new release.

### Added

- **`/archon-upgrade` probes whether the installed Archon still reads the config keys this Plugin depends on.** Step 6, unconditional like the trap pass: it needs no release notes, no network and no AI. It gives each key a distinctive value in a throwaway git repository outside every clone, runs a one-node Archon workflow there, and reads the verdict out of Archon's own output — **READ — value `<x>`**, **NOT READ**, or **INCONCLUSIVE** — which also covers a reworded Archon message, because a message you cannot read a branch or a remote out of is not evidence that nothing read the key. The second verdict is the failure the step exists for, and it was silent everywhere before: this repository's committed top-level `baseBranch:` was inert for weeks while prose cited it as the Gitflow fix ([#396](https://github.com/unic/unic-agents-plugins/issues/396), [ADR-0035](docs/adr/0035-archon-upgrade-report.md) amended). Two keys start the list, in one table in that step, and the prose says the path is Archon's to change — so Step 4's remote-resolution precedent now points at the table instead of naming the key a second time. A key found later joins the table through its own ticket. The step also carries two control runs — the nested keys absent, and the same names at the **top level** of the file — because a report showing only READ rows has not shown that a row could come out the other way. One wording trap is named in the prose: on 0.7.0 Archon says `Configured base branch '<x>'` even when nothing is configured and `<x>` is its own stored default, so only the distinctive value counts as a read.
- **Measured on Archon 0.7.0: `worktree.remote` is read, and it governs base-branch resolution only.** Named as a second remote, the binary's startup error resolves the base branch against that remote where a control run naming no key says `origin`; in the same run the workspace path still came out of `origin`. So the shared `~/.archon/workspaces/_git/` directory every `dxp` repository lands in is a different thing — Archon reading the second-to-last URL segment as the organisation — and this key is not its fix ([ADR-0033](docs/adr/0033-archon-070-schema-target.md) amended). The verdict belongs to 0.7.0, which is why Step 6 re-probes it rather than an ADR asserting it.

### Fixed
- (none)

## [0.23.0] — 2026-08-19

### Breaking

- **`lib/` and `test/` are deleted — the plugin ships zero code and zero runtime dependencies.** Twelve modules and nineteen test files, 6413 lines. The `yaml` dependency goes with them, and so do the `test` and `typecheck` scripts, `tsconfig.json`, and `test/test-enumeration.test.mjs`, which existed to guard the `test` script's hand-list of files. `verify:changelog` stays: CI runs it on every PR. The plugin is now seven command prompts, four Archon Box YAMLs, the Method Bundle and its documentation — which is the bar the root `AGENTS.md` sets with `auto-format`.
- **Every command reads config, the tracker contract and its Methods with its own tools.** No command shells out to Node, imports a plugin module, or reads `$CLAUDE_PLUGIN_ROOT`. This is what makes them run at all: measured on 0.22.0 in a Consumer that installed the plugin through the marketplace, all seven commands loaded and **none ran past Step 1**. `$CLAUDE_PLUGIN_ROOT` is not set inside the Bash tool, so each Step 1 halted while printing advice the operator had already followed; and `lib/config-schema.mjs`, `lib/methods-bundle.mjs` and `lib/schema-traps.mjs` imported bare `yaml`, declared `"yaml": "catalog:"` — the pnpm workspace protocol, unresolvable outside this monorepo whether or not `node_modules` is present. Shipping the directory would have moved the failure, not fixed it. The four Archon Boxes were unaffected and are untouched: they never imported `lib/`, which is what made the prompt-node shape the model for the rewrite ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5, amended — the rule no longer exempts the commands).
- **A Method resolves at one path: `.archon/methods/<name>/SKILL.md`.** The `config` tier (`methods.<name>.source`) and the `local` tier (`.archon/methods.local/<name>/SKILL.md`) are retired, and with them the resolution order, the `methods: to-spec(bundle) · …` tier line every command printed, and the `forked_from` frontmatter convention. The tiers only ever reached the command half — an Archon node could not import `resolveMethod`, so the Boxes had been reading the single literal path since they shipped. Retiring them makes the two halves agree. To change a Method now, edit the installed file and expect the next `/setup` run to overwrite it. A `.archon/methods.local/` directory left by an earlier version is reported once as retired and left on disk. `methods.<name>.source` leaves the config reference, and `.archon/methods.local/` leaves the Consumer `CLAUDE.md` block ([ADR-0031](docs/adr/0031-methods-bundled-three-tier-resolution.md), amended).
- **The four Box prompts stop naming `resolveMethod`.** Seven node prompts told an agent "never call `resolveMethod`, since an Archon node cannot import plugin `lib/`" — a prohibition on a symbol that no longer exists, in a directory that no longer exists. Each now states the rule the deletion actually leaves: a Method lives at one path, an Archon node cannot import **anything** from the Plugin, and the override tiers are retired. Only prompt prose changed — every node's `depends_on`, `when`, `approval` gate, `always_run`, `context`, `loop` and `allowed_tools` is byte-identical to `0.22.0`. The `lib/*.mjs` mention in `unic-dlc-explore.yaml`'s repo-survey step stays: it is advice about the **Consumer's** own code, in whatever repository the Box runs in, and never referred to this Plugin. Consumers carrying a hand-copied Box need a re-copy — the Boxes are the manual half of the port ([#373](https://github.com/unic/unic-agents-plugins/issues/373)).
- **No config key is mandatory.** The most a missing config now does is stop a command, and only when `.archon/unic-dlc.config.yaml` is absent or unreadable; a config that parses is one every Box can run on, with each absent key falling back to the default now stated in the command's own Step 1 table. Two commands do not even stop: `/cleanup` and `/improve-architecture` are off-line and touch no tracker, so an absent config leaves them warning once and continuing on defaults — which is what they did before this change, and is deliberately unchanged. `project.branching` was the one entry in `MANDATORY_PATHS`, and `/build`'s bootstrap node already defaulted it — so the old refusal stopped a command over a key a Box was happy to default. `/setup` still treats it as the key that decides a `partial` config from a `full` one.
- **The dependency list is the table under [README.md § Dependencies](README.md#dependencies) itself.** It was a mirror of `providedTo` in `lib/methods-manifest.mjs`, checked by `test/methods-manifest.test.mjs`; both are deleted, and nothing generates or checks the table now. Edit it by hand, in the same commit as the command or Box whose Methods changed, and restate the list nowhere else. What this gives up is the upstream-rename tripwire, and it is worth naming: that test compared two hand-written surfaces inside this repository and never watched upstream, so it could not have caught the v1.1.0 rename wave it was written for. The pinned licence hash and the `upstreamPath` closure check go the same way. The upstream repository, tag and commit stay recorded in `vendor/mattpocock-skills/README.md`, and the root `AGENTS.md` now names the moment the check happens: diff the vendored tree against the new upstream tag by hand, in the commit that moves the pin.

### Added

- **The prose-Box quality bar, in the root `AGENTS.md`.** A Box is prose, so its bar is a run and a read: it runs where it ships (installed through the marketplace into a Consumer, with no `node_modules` and no hand-set environment variable), its rules are stated inline in every prompt that must honour them, and what it depends on is written once. The passage names what the bar gives up rather than hedging it — an unsafe `git add -A` and a repository derived from a remote URL now merge green if nobody reads the diff, since `test/box-staging-and-repo-pinning.test.mjs` grepped every Box YAML for both and nothing replaces it. Closes the question #380 asked.

### Fixed

- **`setup.md` and `archon-upgrade.md` declared `allowed-tools: ['Bash']`.** A command that reads config in prose needs `Read`, so both would have failed on the first read even with `lib/` gone — the criterion "no command imports a plugin module" can pass while the command still cannot open a file. `setup.md` gains `Read`, `Write`, `Edit` and `Glob`; `archon-upgrade.md` gains `Read` and `Glob` and deliberately no `Write`, which is now the frontmatter's own statement of its read-only claim.
- **`/archon-upgrade` Step 5 checks the Boxes that are installed, not the ones in the plugin directory.** It read `$CLAUDE_PLUGIN_ROOT/.archon/workflows/` through `lib/schema-traps.mjs`; it now reads `.archon/workflows/unic-dlc-*.yaml` in the repository it runs in — the copies a run would actually use — and checks [ADR-0011](docs/adr/0011-archon-schema-target.md)'s four conventions itself. A file it cannot read is a FAIL, never a silent PASS. Step 1 compares `archon --version` against the `0.7.0` floor stated in the command.
- **The heredoc shell requirement is gone from all seven commands.** Each one opened with a note that Steps 1 and *n* need a POSIX shell, and that Windows means WSL2 or Git Bash. No command runs a heredoc now, so all seven work on cmd.exe and PowerShell unchanged.
- **The default PRD scaffold lives in `commands/specs.md` Step 7.** It was `DEFAULT_PRD_TEMPLATE` in `lib/config-schema.mjs`. `templates.prd` is still how a team overrides the PRD shape ([ADR-0018](docs/adr/0018-generic-core-config-compose.md), amended); the default is now prose in the one Box that writes a PRD.

## [0.22.0] — 2026-08-18

### Breaking

- **A `state`, `type` or `priority` role is single-valued, and a Box now retracts before it writes.**
  Moving the axis into the contract made a defect reachable that the config shape could not express:
  before this, every state role resolved to a single-value field, so writing one replaced the last. A
  contract may put a state role on a **multi-value** axis, where writing adds and the previous role
  stays — so `/tickets` wrote a role nothing cleared and a shipped item still read as ready for an
  agent. Every Box and command that writes a role now reads the other rows of that tier and retracts
  each one whose axis holds many values. A single-value axis retracts itself.
- **`docs/agents/triage-labels.md` carries a `Holds` column**, `one` or `many`, on every row. A Box
  reasons about cardinality and **never** about an axis name: `Tag` and `Label` are host words, and a
  rule phrased on one is wrong on the next host — the defect ADR-0016 forbids in a prompt, one level
  up. A contract written before this needs the column added.
- **`/qa`'s `merge` node writes the `resolved` role on every item the pull request links**, after the
  merge lands, reading the links collection `/build`'s `open-pr` created. This is the one point where a
  state role moves after `/tickets` wrote `ready-for-agent`, so it is where the retraction above fires.
  A tracker that cannot set the role says so and merges anyway; the PR is already merged when this
  runs, so a failure here is reported and never retried into a second merge.

- **The tracker contract left `.archon/unic-dlc.config.yaml` and moved into two repo-local prose
  files.** `docs/agents/issue-tracker.md` carries **Access** (which MCP server or skill serves this
  tracker), **Addressing** (the repository) and **Work-item scope** (the one filter every search
  applies); `docs/agents/triage-labels.md` carries the seventeen canonical roles, each row naming its
  value **and** the axis that carries it. Every Box and command reads those two files. Deleted from the
  config with it: the whole `tracker` block, `classification.labels`, `project.pr_strategy` and
  `project.repo_ref`. `MANDATORY_PATHS` is `project.branching` alone. A config that still carries the
  retired keys keeps them and validates — nothing reads them.
- **No Box derives a repository from a remote URL, and the `ambiguous-repo` guard is gone.** One remote
  has several spellings and a fork clone names two repositories, which is why the old `origin`
  derivation needed an override key and an ambiguity guard to correct itself. `docs/agents/issue-tracker.md`
  § Addressing states the repository as a fact, so all three are deleted. Each Box now has one guard,
  `guard-not-ready`, firing on every non-ready status. A node that cannot find the contract file STOPS
  and says so; it never guesses.
- **The merge style is the host's, not `/qa`'s.** `/qa`'s `merge` node reads no `project.pr_strategy`:
  it uses whatever the repository's branch policy allows, and where that policy allows a choice the
  team's own `CLAUDE.md` states the rule.

### Added

- **The transition table in `AGENTS.md` — every point the Harness writes a Canonical role, and which
  one.** The two holes above stayed invisible while the writes were scattered, and "before you write a
  role" cannot be checked without a list of the places that do. One row records that **`/build` writes
  no role on purpose**: `open-pr` links each work item to the pull request and every host surfaces that
  link on the item, so "an agent has started this" needs no `in-progress` role — adding one would
  change the protocol every Box shares to duplicate a signal the host already gives.
- **The plugin states that an extra row in `triage-labels.md` changes no Box.** A Box names its roles
  literally, so a team-added role is inert, by design: the Canonical roles are the protocol the Boxes
  share. A team owns each role's value, axis and cardinality, never the role set, and the door for
  different behaviour is a Method fork — a transition is procedure, not a parameter.

- **`/tickets` writes each published item's tracker id into `issues.json`.** A slice's `id` addresses
  nothing outside the file, so without a `tracker_id` nothing downstream can reach the tracker item:
  `/build`'s code-review pre-check cannot read its intent and `open-pr` cannot link it. The gap is
  host-agnostic — no host closes an item from a PR body that carries no id — so the id is written here
  on every host. A slice whose publish failed keeps `tracker_id` absent and is reported as unpublished,
  never given a placeholder.
- **`/build`'s `open-pr` links each work item to the PR through the registered skill's own link
  capability.** A pull request and a tracker item each carry a discoverable links collection, so the
  Box says "link" and names no text token — a token written into a prompt picks one host's convention
  and freezes it. Where no link capability exists, the ids go in the PR body under `## Work items` with
  a note that the links were not created.

### Fixed

- **The rule that a row with no axis writes nothing now appears at every surface that writes a role.**
  It shipped in `/triage` alone, which left the escape hatch documented in one place and unimplemented
  in three: `/tickets`, `/explore`'s `spike-ticket` and `/qa`'s finding-capture.
- **`CONTEXT.md` defines `Holds`.**

- **`/pr-review` promises a pull-request *discussion*, not a PR-level comment.** The review addresses
  the whole PR, so it posts a discussion on the pull request itself: one host carries that as a thread
  with no file anchored to it, another as a comment on the PR, and the Box asks which rather than
  assuming. Its marker scan also walks each thread's replies, because a host may nest a reply under its
  parent instead of listing every comment flat.
- **`/cleanup` names no provider and no subcommand where it tells a reader to compose the tracker.**
  The stale-PR row stated the rule and then broke it with two provider names and a subcommand inside
  the sentence that forbids them. It now says to read the server's own close capability from its
  current tool list, and to close nothing where none exists.
- **ADR-0024 says which of its rules are dead.** Its compose rule — that Matt's setup artefacts are
  never consulted in a DLC flow — is reversed: those two files are the contract now, and the two-writer
  problem the rule solved is solved instead by removing one writer. Its 2026-08-11 "the tier carries
  the axis" amendment is disproved: measured on a live tenant, five of the eight state roles cannot be
  states at all — writing a state while work is open moves an already-active item backwards on the
  board — so **the axis belongs to the role**. ADR-0025, 0028,
  0029, 0032 and 0033 carry a pointer to the amendment; ADR-0033's "Repository derivation" section
  describes a mechanism that no longer exists.
- **`CONTEXT.md` defines **Tracker contract** and **Axis** where it defined **Repository derivation**
  and **Label string**.**
- **`AGENTS.md` records that a project-scoped MCP server in the Consumer's `.mcp.json` reaches a Box.**
  Every Box that composes the server its contract names depends on this and nothing had tested it: an
  Archon run under `~/.archon/workspaces/…/worktrees/` loaded the registered tracker server and read
  work items, pull requests and threads. A personal-scope server does not travel that way.

## [0.21.0] — 2026-08-14

### Breaking
- (none)

### Added
- **The `/setup` Step 8 summary says which version it upgraded from, and which Boxes are new.** The
  summary listed the paths it wrote and the paths it swept, so an unchanged re-install and an upgrade
  read identically, and a newly shipped Box was indistinguishable from one that was already installed
  and overwritten. Both answers were already computed inside the install and discarded. Step 8 now
  opens with a version line in one of three forms — `first install`, `upgraded from: unknown`, or
  `upgraded from: {previous} → {current}` — and carries a `workflows added:` line beside the existing
  `workflows written:` and `workflows removed:` lines. All three name paths, never a count. The line
  is informational: Step 6 runs unattended on the upgrade path, so nothing here prompts or gates.
  `installArtefacts` returns `added`, derived from the two name sets its stale sweep already reads and
  issuing no second `readdir`; `installBoxWorkflows` returns `previousVersion`, parsed from the
  generated header of the first shipped-and-present Box in sorted order and read **before** the write
  loop — after it, every header names the version being installed. `previousVersion` is `null` on a
  fresh Consumer, against a file carrying no generated header, and against a header naming no version;
  headers are never cross-checked between files. No install record, no hash and no timestamp: install
  provenance is the per-file generated header, and a timestamp would dirty `git diff` on every
  idempotent re-run. See [ADR-0036](docs/adr/0036-setup-owns-a-named-install-set.md), amended
  2026-08-14 — its D1 wording ("one declared install set") describes the shared `installArtefacts`
  engine, which has two independent callers plus Step 5's own config write, and the record file it
  deferred to this change is not built.

### Fixed
- (none)

## [0.20.0] — 2026-08-13

### Breaking
- (none)

### Added
- (none)

### Changed
- **The `CLAUDE.md` block `/setup` writes describes the Consumer's own disk, and its heading is now
  `## unic-archon-dlc`.** Step 7 used to restate this Plugin's box set and pipeline order, both of
  which a Plugin release renames and reorders with no change on the Consumer's side —
  `/archon-upgrade` had already fallen out of the list unnoticed. The block now names no pipeline
  stage, and no Box but `/unic-archon-dlc:setup`, which it cannot leave out without losing the one
  name that says what regenerates it. It carries the config path and its `classification.labels` sentence,
  `.archon/workflows/` with the `unic-dlc-*.yaml` naming plus `archon workflow list` and
  `archon workflow run <name> "<slug>"` to see and run what is installed there, `.archon/methods/`
  as replaced wholesale on every run with `.archon/methods.local/` as the override tier, and a link
  to this Plugin's README for what each Box does. The `<!-- unic-archon-dlc:begin -->` /
  `<!-- unic-archon-dlc:end -->` markers are unchanged, so an existing Consumer's next `/setup` run
  replaces the old block in place. Step 7 now says in one voice that the **whole** marker-delimited
  block is what gets replaced, markers included — the canonical snippet it prescribes opens and
  closes with those markers, and "write this between the markers" would have nested a second pair on
  every refresh. The "auto-managed" framing is dropped: nothing detects a hand-edit between the
  markers, and nothing will. See
  [ADR-0024](docs/adr/0024-triage-intake-on-ramp.md) (amended 2026-08-13), whose known item this
  settles.
- **Amending a Plugin ADR now has a recorded form.** `docs/adr/README.md` binds every later amender
  to a dated `> **Amended (YYYY-MM-DD):**` blockquote below the status line, plus a status-line note
  and an index update — never the root repository's `## Amendment (YYYY-MM)` section. The rule is
  named here because the next amender reads this file, not the ADR index.
- **`AGENTS.md` and `CONTEXT.md` follow the rename**, `AGENTS.md`'s doctrine bullet states the rule
  the block now follows, and both stop listing `/handoff` as a Box this Plugin owns — it is one of
  Matt's skills, referenced in prose and never implemented here.

### Removed
- **`lib/dogfood-banner.mjs` and `test/dogfood-banner.test.mjs` are deleted.** No importer outside
  that test. Its `AGENT_DOC_BANNER` named `lib/agent-docs-writer.mjs` as its source and
  `runInstall()` in `lib/install-runner.mjs` as its regenerator — neither module exists — making it
  the last live claim in `lib/` that `/setup` writes agent docs.
- **`lib/handoff-generator.mjs` and `test/handoff-generator.test.mjs` are deleted.** No importer
  outside that test. `updateRoadmap` wrote a `docs/workflow/ROADMAP.md` that
  [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md) retired, and `/handoff` is Matt's
  skill, referenced and never implemented here. Both test file names left `package.json`'s `test`
  script with them.

### Fixed
- **Step 4's `docs` field no longer claims Step 6 writes `docs/agents/*.md` files.** It installs the
  Methods bundle and the Box workflows; the parenthetical was residue from a generator deleted in
  `b27d1e5`. Step 7 also stops calling itself a docs step, in its heading and in the
  "Follow these steps in order" paragraph.

## [0.19.0] — 2026-08-12

### Breaking
- **`defaultConfig()` no longer seeds `classification.labels`, and `getDefaultLabels` is deleted.**
  `lib/labels-config.mjs` now exports the three frozen role arrays and nothing else, and
  `classification.labels` joins `MANDATORY_PATHS` — so a config without one reads as `partial` and
  `/setup` collects it. **An existing installed config is unaffected**: the seed was already written
  to disk as literal data the last time `/setup` ran, `mergeConfig` still resolves
  `DEFAULTS < existing < answers`, and a hand-edited mapping keeps surviving re-runs exactly as
  before. That also means an existing project keeps its seeded mapping rather than being asked to
  confirm it — run `/unic-archon-dlc:setup reconfigure` to review or change it. See
  [ADR-0024](docs/adr/0024-triage-intake-on-ramp.md) (amended 2026-08-11, extended 2026-08-13).

### Added
- **`/setup` asks for the tracker's Label strings.** One question, the seventeen Canonical roles
  shown as three tier-grouped tables (`state`, `type`, `priority`) with a line on what each role
  means, offering the names this Plugin ships. `/setup` never probes the tracker, never creates a
  label, and reports nothing about labels in its summary: a tracker with a different vocabulary is
  answered by mapping a role onto a string it already carries. The `CLAUDE.md` marker block now names
  `classification.labels` and points at `reconfigure`, so the written mapping has a thread to pull
  (#329).

### Fixed
- **`validateConfig` reports a `classification.labels` short of a shipped Canonical role**, naming the
  exact role, so an older config self-heals through `/setup`'s own collect path instead of being
  silently completed from a default. An **extra** key — a hand-added `release` type, say — is still
  accepted, ignored and preserved through `migrateLegacy`.
- `test/labels-config.test.mjs` freezes the membership of all three role arrays instead of checking
  each expected name is present, so a new Canonical role fails CI until someone changes the list on
  purpose. No test name implies the mapping varies by tracker; it never did.

## [0.18.0] — 2026-08-12

### Breaking
- (none)

### Added
- **`/setup` installs the Box workflow YAMLs into a Consumer's `.archon/workflows/`.** Nothing wrote
  them before this release, so no Box was runnable outside this repo. Install is name-scoped to the
  `unic-dlc-*` naming, discovered by reading this Plugin's own `.archon/workflows/` at install time —
  never enumerated by name. `lib/artefact-install.mjs` generalises `installMethods`'s clean-replace
  logic into one tree-install engine covering both the whole-directory Methods install and the new
  name-scoped Box install; `installMethods` keeps its exact signature and every existing test. A
  retired Box is swept **by name, never by whether it carries the generated header** — a Consumer
  workflow whose name is outside the `unic-dlc-*` set is untouched, whatever its contents, which is
  what makes the README's variant escape hatch (copy a Box to a name outside that set) hold. See
  [ADR-0036](docs/adr/0036-setup-owns-a-named-install-set.md).
- Every Box command stub moves from `.archon/commands/` to `docs/boxes/` as operator documentation;
  `/setup` writes nothing into `.archon/commands/`. Each stub's invocation is now
  `archon workflow run <name> "<slug>"` — `--input` was never a real flag.

### Fixed
- (none)

## [0.17.0] — 2026-08-10

### Breaking
- (none)

### Added
- **`/archon-upgrade` — a read-only report of what a new Archon release means for this Plugin.** ADR-0011 tells authors to "re-validate behaviourally on each bump" and ships no mechanism for doing it; the 0.7.0 assessment was a manual read of a 210-file release against four Box YAMLs, two `lib/` modules and six command files, and the 0.x line ships a release every few weeks. The command compares the installed `archon` against `MIN_ARCHON_VERSION` and stops when they match; discovers Archon's own upstream repository at run time from `brew` and **asks rather than guesses** when that fails, so no Archon URL is hardcoded anywhere; reads the release notes for the range through `gh` and classifies each notable change **ADOPT / DEFER / VERIFY-ONLY / BREAKS-US**, naming the affected file and node plus one next step per row. Two classifications are locked and cited rather than re-derived — `workflow:` sub-runs are DEFER per [ADR-0033](docs/adr/0033-archon-070-schema-target.md) § Sub-runs, and Archon's own remote-resolution algorithm is VERIFY-ONLY per that ADR's § "Repository derivation", because a recorded, deliberate divergence classified BREAKS-US would relitigate a settled decision on every run. A separate mandatory sub-pass reads the notes for changed, removed and deprecated **defaults** against the Boxes' own node bodies: both real 0.7.0 defects were an upstream default a Box still assumed, and a new-field scan is blind to that shape. `allowed-tools` is `Bash` alone — the command writes nothing, and `test/archon-upgrade-command.test.mjs` asserts that structurally so a later edit cannot quietly grant it a write tool. See [ADR-0035](docs/adr/0035-archon-upgrade-report.md).
- **`lib/schema-traps.mjs` + `test/schema-traps.test.mjs` — ADR-0011's silent-failure traps, as tested code.** `/archon-upgrade` re-asserts them on every run: no `type:` discriminator, every `approval:` node paired with workflow-level `interactive: true`, every `loop:` carrying both `until` and `max_iterations`, no node-level `fresh_context:`. Putting that check in `lib/` rather than in a prompt regex is the point — an untested assertion inside a Markdown file fails open, which is the exact class of defect the traps describe, and it means the four bundled Boxes now have a CI-enforced conformance guard they did not have before. The checker returns violations rather than throwing, so a caller printing a PASS/FAIL grid cannot mistake a crash for a pass.
- **`parseVersion` is exported from `lib/archon-check.mjs`.** `/archon-upgrade` compares version triples — installed against the floor, and each release tag against both — rather than re-implementing the regex or comparing raw strings that may carry a program-name or `v` prefix. A test locks the contract now that it is public API.

### Fixed
- (none)

## [0.16.0] — 2026-08-10

### Breaking
- **The Archon floor moves to `≥ 0.7.0`.** `MIN_ARCHON_VERSION` in `lib/archon-check.mjs` rises from `0.5.0`, and `commands/setup.md` Step 1, `AGENTS.md`, `README.md`, `CONTEXT.md` and the four Box command docs under `.archon/commands/` restate it. A Consumer on Archon 0.5.x or 0.6.x is refused at the next `/setup` preflight with an upgrade message; an already-configured Consumer who does not re-run `/setup` is unaffected until they do, because the check runs only there and never inside a workflow run. The two fields this floor buys — `evidence_policy` and `always_run` — were verified behaviourally against the shipped 0.7.0 binary, not read from a release note ([ADR-0033](docs/adr/0033-archon-070-schema-target.md), amending [ADR-0011](docs/adr/0011-archon-schema-target.md) on the floor only).
- **`/setup` refuses a project with no git remote at all.** Every Archon Box derives its target repository from a remote, so a remote-less checkout could never run one; the refusal was previously silent until the first `/build` run discovered it at `guard-ambiguous-repo`. This is distinct from "no `origin` specifically", which that guard still handles at run time.
- **`verification` and `goals-check` in `unic-dlc-build.yaml` now return structured output.** Their `$verification.output` and `$goals-check.output` are the JSON-stringified result rather than prose. The prose is preserved in a `verdict` field and `report` reads `$verification.output.verdict` / `$goals-check.output.verdict`, so `report.md` is unchanged — but any local fork consuming those node outputs as text needs the `.verdict` suffix.

### Added
- **The evidence gate — `/build` can no longer reach `completed` on a red tree.** `unic-dlc-build.yaml` declares `evidence_policy: { required: true }`, so Archon refuses terminal `completed` unless `evidence.json` exists in the run's `$ARTIFACTS_DIR`. The engine gates on file **presence** only, which makes whatever writes that file the real gate — so a dedicated `evidence` **script** node is the only writer, never a prompt: a prompt asked to both judge the build and certify it grades its own homework, the failure [ADR-0012](docs/adr/0012-fresh-context-red-green-separation.md) already guards against for red/green. It refuses an unset **or empty** `ARTIFACTS_DIR` with a non-zero exit naming the contract — an empty value would make `join()` return a relative path without throwing, so the node would log a successful write while the engine looked in the real `$ARTIFACTS_DIR` and found nothing. It deletes both copies of any `evidence.json` a prior resumed attempt left behind — the `$ARTIFACTS_DIR` original and the repo-relative mirror, because the engine's presence gate reads only the former, so a stale mirror outlives an engine refusal and is the copy `open-pr` stages and a reviewer reads — reads what `verification` and `goals-check` now report — the `passed` boolean **and** the `failures` list, cross-checked, because `passed` is a self-report from the same prompt that wrote `failures` and a `passed: true` beside a non-empty `failures` array would otherwise certify a tree whose own certificate listed the failures — writes the file only when both verdicts are green, and mirrors it to `<artifacts_dir>/<slug>/evidence.json` so the certification survives `/cleanup` pruning the worktree. `open-pr` stages that mirror when it exists; on a withheld verdict the run still continues through `report`, `open-pr` and `build-pr-gate`, deliberately, so a human gets the report and a PR-shaped surface showing what failed — what the engine refuses is the terminal `completed` status. See [ADR-0034](docs/adr/0034-evidence-gate-deterministic-writer.md).
- **`always_run: true` closes the stale-resume hole.** It is set on every node whose exit code reports a fact about external or mutable state rather than about itself: `slopcheck`, `verification`, `goals-check` and `evidence` in `/build`; `verify-pr-base`, `e2e` and `coverage-gate` in `/qa`. Each carries an inline comment naming the specific fact its exit code fails to validate, because an Archon node imports nothing from the Plugin and a rule living only in an ADR is invisible at run time. This is the field that stops a resumed `/qa` run merging against a PR base retargeted since the first attempt — `base_ok` is a fact about the remote PR, and the resume cache was replaying it.
- **`/setup` reports what Archon's own remote resolution finds, and writes nothing.** The summary gains an `archon remote:` line showing whether Archon's `.archon/config.yaml` (a different file from this plugin's `.archon/unic-dlc.config.yaml`) resolves a remote via `worktree.remote`, falling back to Archon's own `origin`-then-sole-remote auto-detection. That file belongs to Archon; this plugin never writes it. Where Archon's algorithm and this Harness's own derivation differ — Archon falls back to a sole non-`origin` remote, this Harness cancels — the divergence is recorded in [ADR-0033](docs/adr/0033-archon-070-schema-target.md) deliberately, not re-aligned.
- **A regression guard for the repository derivation #289 settled.** `project.repo_ref` stays an optional override: absent from `MANDATORY_PATHS` and from `defaultConfig()`, and `/setup` still neither asks for it nor writes it. A new test in `test/config-schema.test.mjs` asserts both surfaces so a later change cannot quietly promote it to mandatory and break every installed Consumer on upgrade.
- **`resolveArchonRemote` in `lib/config-schema.mjs`, unit-tested.** `/setup`'s `archon remote:` fallback chain (`worktree.remote` → `origin` → the sole remote → `null`) was inline in `commands/setup.md` with no automated coverage; it is now a tested `lib/` function, matching how every other deterministic concern in this Plugin is verified.
- **`test/box-workflow-node-refs.test.mjs`.** Asserts that every dollar-prefixed node-output token in each of the four Box YAMLs names a node that file declares. Archon's DAG loader reads those tokens as real edges wherever they appear — script bodies, prompts and **comments** alike — and one naming a node that does not exist fails the whole file at discovery with `dag_structure_invalid`, so the Box silently stops loading. Nothing else here catches it: the YAMLs are data files with no parser in the suite, so `pnpm test` and `pnpm ci:check` stay green while a Box is unloadable. A placeholder token in an explanatory comment did exactly that during this version's development.
- **`test/build-qa-evidence-and-always-run.test.mjs`.** Structural regression guards for the `evidence` node's delete-before-write ordering (both copies), its withhold guard and its `passed`-versus-`failures` cross-check, the workflow-level `evidence_policy: { required: true }` key (parsed, not string-matched — the same words appear in comments and prompts in that file), `open-pr`'s conditional staging of the evidence mirror, and the exact `always_run` node set on both Box YAMLs — an Archon node cannot import `lib/` (ADR-0023 §5), so these are ordering/string assertions against the YAML source rather than unit tests, in the style of `box-staging-and-repo-pinning.test.mjs`.
- **`test/test-enumeration.test.mjs`.** `package.json`'s `test` script names every test file by hand, and nothing diffed that list against `test/`. A hand-maintained list fails open: an unlisted file never runs and the suite still reports green, which manufactures a number for coverage that did not execute — and it fires exactly when someone adds a guard. That happened on this branch, at 226/226. The structural fix is `node --test test/`, which changes how CI's per-package matrix invokes the suite and is therefore a separate decision.
- **Field-level parity in `test/box-workflow-node-refs.test.mjs`.** Archon validates that `$id.output` names a declared node; it does not check that `$id.output.<field>` names a declared property, so a rename on the producer side is silent and the consumer reads `undefined`. Every field-qualified node-output reference in all four Boxes must now appear in the producing node's `output_format.properties`. The file's header also records the two known divergences from the shipped 0.7.0 loader, both erring strict.

### Fixed
- **The evidence gate no longer certifies on a self-reported boolean alone.** It cross-checks `failures` against `passed` for both `verification` and `goals-check`, so a `passed: true` beside a non-empty `failures` array withholds instead of writing a certificate that contradicts its own body. Both prompts now state that `failures` carries blockers only.
- **`open-pr` no longer stages `SESSION/evidence.json` unconditionally.** The `evidence` node withholds that file on every red verdict, and `git add` on a path that does not exist exits 128 and takes the whole staging step with it — on exactly the path the gate exists to make safe. The stage list now qualifies the entry, and says that the "list it anyway rather than guessing" rule covers committed and unchanged paths, not absent ones.
- **The four Box command docs under `.archon/commands/` said `Archon ≥ 0.5.0`.** They ship into a Consumer project as the operator-facing description of each Box, so a Consumer on 0.6.x read a prerequisite they met and was still refused at the `/setup` preflight. ADR-0033's enumeration of the surfaces that restate the floor now names them.
- **ADR-0034 said the workflow "terminates" on a withheld verdict.** It does not: `report`, `open-pr` and `build-pr-gate` all still fire, and only the run's terminal `completed` status is refused. The ADR now records that, the deliberate exit-0 reason behind it, and the cost it carries. Two `unic-dlc-build.yaml` prompt steps and ADR-0034's Consequences also said `evidence_policy` reads the `passed` boolean; the engine gates on file presence only, and the `evidence` node is what reads the boolean.
- **`.archon/commands/unic-dlc-build.md` documented a REFACTOR phase and a seven-step pipeline.** 0.15.0 removed the REFACTOR phase — refactoring reaches the code through `/pr-review`'s Standards axis — and this release adds the `evidence` node between `goals-check` and `report`. Both are now described, so the doc and `README.md`'s pipeline table agree again.
- **`README.md`'s Session-artifacts tree omitted `evidence.json`.** The mirror exists so a reviewer can find the certification after `/cleanup` prunes the worktree, and the only document enumerating a Session directory did not list it.
- **`/setup`'s git-remote check no longer collapses every failure into "no remote configured."** A missing `git` binary or a non-repository checkout now gets its own message instead of the generic no-remote refusal and its (inapplicable) remediation.
- **The preflight failure message names `evidence_policy` and `always_run`**, matching the rationale already given in the comment above `MIN_ARCHON_VERSION`.
- **Root `CONTEXT-MAP.md`'s Archon version floor**, stale since before this release, now reads `≥ 0.7.0` and links [ADR-0033](docs/adr/0033-archon-070-schema-target.md) instead of restating a bare number.
- A comment in `unic-dlc-build.yaml`'s `evidence` node miscounted its own quoted substitutions ("two" where there are three).

## [0.15.1] — 2026-08-05

### Breaking
- (none)

### Added
- **`project.repo_ref`, an optional repository override — absent by default.** Every Box now derives its target repository from the worktree's `origin` remote, so no existing config needs changing. Set `project.repo_ref` only for a checkout where `origin` is not the repository to act on; that is also the one case a Box **cancels** rather than guess, via a new `guard-ambiguous-repo` node that fires when the checkout names more than one repository and no override is set ([ADR-0011](docs/adr/0011-archon-schema-target.md): an expected precondition failure cancels, it does not fail). A checkout with a single `origin` never reaches that guard.
- **`test/box-staging-and-repo-pinning.test.mjs` — the barrier that keeps both fixes.** It greps the four Box YAMLs, both interactive command docs and the four Archon command docs for host CLI tokens (`gh`, `az`, `--repo`, `--repository`, `--organization`, `--hostname`) and provider names, and fails naming every hit by `file:line`. It also self-tests its own patterns, so a mistyped regex cannot silently fail open, and asserts the positive rules: named-path staging, the deny list, the derived repository, and the repository invariant per PR-touching node.

### Fixed
- **No Box stages blindly any more.** `/explore`'s `preserve-spike` ran `git add -A` and `/build`'s `open-pr` said "stage everything changed by the build". A Box runs in an isolated worktree with fresh context, so "everything changed" swept in whatever else was on disk. Every committing node now stages a named list — one `git add <path>` per path — then confirms with `git status --porcelain` and unstages anything else. `/build`'s `open-pr` list is explicit: source, tests, `PRD.md`, `issues.json`, `report.md`, `build-state.json`, and each drafted `docs/adr/NNNN-*.md`. The deny list (`pr-body.md`, `*.tmp.md`, `*.scratch.md`, and anything under `$ARTIFACTS_DIR`, Archon's per-run directory outside the repo tree) is stated **inline in each node**, because an Archon node imports nothing from the Plugin ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5) and doctrine in `AGENTS.md` is invisible at run time.
- **`build-state.json` is committed once, at `open-pr`.** The red/green loop rewrites it on every one of up to 60 iterations and now never stages it. That single commit is the durable proof of [ADR-0012](docs/adr/0012-fresh-context-red-green-separation.md)'s anti-cheat record (`red_exit`, `red_unexpected_pass`, the per-slice phase order), which previously died whenever `/cleanup` pruned the worktree.
- **Every PR and tracker call names the repository it acts on.** No call passed one, so a host tool inferred it from the checkout — in a fork clone that is the parent, and the PR opened on someone else's project. Each PR-touching prompt now states the invariant "act on THIS repository, never the one a tool infers from the checkout", names the derived repository, and **cancels** if the registered system-skill cannot target a repository explicitly.
- **No prompt or command doc carries a host CLI token, subcommand, flag, or provider name.** Ten shipped files lose their per-provider branches; they name the config **keys** (`tracker.type`, `tracker.access`) and compose the system-skill the team registered, reading that skill's own current interface ([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) — the DLC owns the _what_ and none of the _how_). A flag table frozen in a YAML file is stale the moment the tool changes and cannot be verified without a live tenant: a closed earlier attempt shipped a subcommand that does not exist. Behaviour a prompt used to hardcode per host — is there a queryable PR, can it comment on a file and line, can it merge — is now a capability the composed skill is asked about, degrading to summary-only or manual steps when the answer is no.

## [0.15.0] — 2026-08-04

### Breaking
- **`/build` no longer has a REFACTOR phase, and `build-state.json`'s phase set loses `refactor-done`.** The `tdd` Method is explicit that "refactoring is not part of the loop — it belongs to the review stage", so the loop runs `pending → red-done → green-done` and `COMPLETE` fires when every slice is `green-done`. There is no `refactor(<SLUG>): tidy …` commit any more. Refactoring did not disappear: it reaches the code through `/pr-review`'s Standards axis and its twelve-item Fowler smell baseline. A `build-state.json` left mid-run by 0.14.0 with `refactor-done` slices still reads as complete; one with a `green-done` slice will simply be picked up as done rather than refactored. Amends [ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md), **including its title**.
- **`/pr-review`'s seven aspect nodes are replaced by one `review` node.** `code-quality`, `tests`, `silent-failure`, `type-design`, `comment-rot`, `simplifier` and `intent-check` are deleted, along with the `has_*` spawn gates that conditionally ran them and `synthesize`'s `trigger_rule: all_done`. A run's findings now live in one `SESSION/findings/review.json` instead of seven per-aspect files, and finding `aspect` values are `standards` / `spec`. `reconcile` matches a pre-0.15.0 iteration's findings on file + semantic title alone, ignoring the retired aspect names, so the first re-review after upgrading does not report every open finding as new. Amends [ADR-0026](docs/adr/0026-pr-review-generic-archon-harvest.md) (§8).

### Added
- **The four Archon Boxes read their Methods instead of restating them (#281).** Tranche 3 of the Matt v1.1.0 migration applies [ADR-0030](docs/adr/0030-harness-hosts-methods.md)'s structural bar to `/build`, `/pr-review`, `/qa` and `/explore`: `run-build` reads `tdd` (with `tests.md` and `mocking.md`) and `implement`; `/pr-review`'s `review` node reads `code-review` and runs **its own** two-axis Standards · Spec sub-agent fan-out rather than the Harness re-implementing the Method's step 4; `/explore`'s four research nodes read `research` for its primary-source citation discipline. Each reads `.archon/methods/<name>/SKILL.md` by literal repo-relative path — **not** `resolveMethod`, which lives in plugin `lib/` an Archon node cannot import ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5). The consequence is worth knowing: the config and `.local` override tiers **do not apply inside an Archon Box**, and there is no resolved-tier line there. A missing Method file is fatal for the node; the fix is `/unic-archon-dlc:setup`.
- **`/build` runs `implement`'s own review step as a local pre-check that posts nothing.** `implement` ends with "once done, use /code-review to review the work". A new `implement-review-precheck` node (between `run-build` and `verification`) runs `code-review` once over the whole build and folds its `## Standards` / `## Spec` output into `report.md`'s "Decisions Made". It performs **no** tracker or PR mutation, so `/pr-review` keeps the only review-posting authority in the lifecycle and a build cannot double-comment the PR it just opened.
- **The three questions the Methods would ask a human are injected, never gated.** Each Method was written for a live session. `tdd`'s "confirm the seams with the user" is answered by pointing the node at where that approval is already on record — `PRD.md` § Testing Decisions from `/specs` Step 5, and each slice's `test_command` from `/tickets`' Nyquist-map gate. `code-review`'s fixed point and spec source are answered by what `bootstrap`/`prep` already computed. An `approval:` node would have been worse than injection, not merely redundant: every gate is written `when gate == 'hitl'`, so a seam gate would fire only when a human is present and be **silently skipped in AFK** — the outcome the rule exists to prevent. The Methods' `/setup-matt-pocock-skills` fallback never applies ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md)).
- **A slice with `test_command_planned` gets an agent-chosen seam, recorded for audit.** Those slices have no pre-agreed seam to inject and `tdd` forbids testing at an unconfirmed one, so RED chooses the seam and appends `seam chosen: <issue-id> — <seam>` to that slice's `notes` in `build-state.json`, which `report.md` surfaces. Halting instead would have shrunk AFK coverage, which this tranche exists to grow; an unrecorded choice is the defect, not the choice.
- **`test/archon-box-methods.test.mjs` holds all four Archon workflows to the manifest**, in both directions, and forbids a `resolveMethod(` call, a plugin-`lib/` import, a `$CLAUDE_PLUGIN_ROOT/` path, and a citation into `.agents/skills/` or the Bundle. It also pins the AC-9 surfaces a deletion slice can quietly take with it — each Box's `approval:` gate and its HITL `when` clause, `context: fresh`, the loop's `fresh_context: true`, and the `slopcheck` node. This closes the half of the gap `AGENTS.md` previously admitted out loud: until now a stale Method name in a node prompt was caught only by reading.
- `lib/methods-manifest.mjs`: `implement` and `tdd` gain `providedTo: ['build']`, `research` gains `['explore']`, and `code-review` gains `'build'` alongside `'pr-review'`. The README Method table follows, and `boxNotShippedYet` in `test/methods-manifest.test.mjs` is now empty — kept with its comment, since `wayfinder` (#282) refills it.

### Fixed
- **`Task` in `allowed_tools` would have silently disabled both sub-agent nodes.** `archon validate` (v0.7.0) reports that the tool was renamed to `Agent` in the Claude SDK and **the old name is silently ignored at runtime** — `/pr-review`'s `review` and `/build`'s `implement-review-precheck` would each have been unable to spawn the two axes, with no error raised anywhere. Both nodes declare `Agent`, which is also what the `code-review` Method's own step 4 says.
- `/qa` no longer attributes its finding-capture brief to Matt's `qa` Method. Upstream v1.1.0 moved `qa` to `skills/deprecated/` with no replacement, so the name resolved to nothing and never had: the brief shape (what happened / what I expected / steps to reproduce / blocked by / additional context) was always inlined and this Harness now owns it, recorded in a comment above `uat-gate`. `qa` is deliberately **not** added to the manifest — an entry would point at a dead upstream branch. The same stale attribution is corrected in the `/qa` command stub and [ADR-0025](docs/adr/0025-qa-pipeline-onramp.md).
- `AGENTS.md`'s claim that "the Archon-hosted Boxes are still unwired until #281" and `CONTEXT.md`'s **REFACTOR phase** and seven-name **Review aspect** glossary entries described a shape that no longer exists. The README's node-pipeline table and `/build` role row are corrected too.

## [0.14.0] — 2026-08-04

### Breaking
- (none)

### Added
- **`/specs`, `/tickets`, `/triage` and `/improve-architecture` resolve their Methods through `resolveMethod`.** Each Box's Step 1 now returns `methods: [{name, path, tier}]` alongside its config and prints a `methods: to-spec(bundle) · grilling(bundle) · …` line, so a Method answering from an unexpected tier — a forgotten `.archon/methods.local/` override, a `methods.<name>.source` someone declared months ago — is visible instead of silent. An unresolved Method stops the Box: it cannot run a procedure it cannot read. Boxes then read the returned path; a Method's sub-files sit beside its `SKILL.md` at every tier.
- **A confirmation halt at the end of `/specs` Step 4.** v1.1.0 added "do not enact the plan until I confirm we have reached a shared understanding" to `grilling`, because grilling sessions were running straight into implementation on some models. `/specs` now carries that as an explicit halt on **every** Step 4 branch — the interview's own confirmation in `discuss` mode, agreement on the assumptions in `assumptions` mode, the synthesis review in `ingest`/`hybrid` — so the command has one shape whatever the input. It fires when the interview *reaches* shared understanding, not at a fixed question count; on "no" it returns into the interview.
- **`test/command-methods.test.mjs` — the Boxes are held to the manifest.** Five checks per Box, plus one that asserts each `const wanted = [...]` matches `providedTo` in both directions. It fails on a pre-v1.1.0 alias in the prose (`to-prd`, `to-issues`, `grill-with-docs`), a sub-file upstream deleted, a hardcoded path into a Method's directory, a missing tier line, and any surviving `matt_suite` reference. Verified by mutation: each of those four defects, injected into `commands/specs.md`, fails the suite. This closes the gap `AGENTS.md` admitted out loud — a stale Method name in command prose was caught only by reading, which is how the v1.1.0 rename wave shipped green.

### Changed
- **`specs.gate` is stated to be the single approval gate.** `/specs` has three halts — the new design confirmation, the seam check, and the PRD gate — but only `specs.gate` produces a durable artefact and puts it in front of a human, and it is where `grilling`'s "do not enact" lands: inside `/specs`, enacting the plan means writing and PR-ing the PRD. The other two settle the design; they approve nothing. `commands/specs.md` says so, and so does a dated amendment on [ADR-0020](docs/adr/0020-specs-branch-on-input.md).
- **A prefactor stays an ordinary slice; `issues.json` gains no field.** Upstream `to-tickets` added prefactoring guidance ("make the change easy, then make the easy change"). Expressing it needs no schema change: `type: tech-debt` with `blocked_by: []`, named in the `blocked_by` of every slice it unblocks, already ships first by dependency order and needs no new rule in `/build`. A `prefactor: true` flag would have been decoration until something read it, and a `prefactor` type value would have cost a new tracker label in every Consumer. `commands/tickets.md` records the shape; #280 records the reasoning. The HITL/AFK slice typing upstream dropped needed no removal — `lib/issues-schema.mjs` never carried it.
- **Every stale Method name and moved path corrected.** `to-prd` → `to-spec` and `to-issues` → `to-tickets` throughout. `/specs` reads the interview discipline from `grilling` and the ADR/CONTEXT formats from `domain-modeling`'s `ADR-FORMAT.md` / `CONTEXT-FORMAT.md`, because `grill-with-docs` is now a six-line pointer that carries neither. `/improve-architecture` points at `HTML-REPORT.md` (new at v1.1.0) and at `codebase-design` for `DEEPENING.md` and `DESIGN-IT-TWICE.md`; the dead paths to `DEEPENING.md`, `INTERFACE-DESIGN.md` and `LANGUAGE.md` under `improve-codebase-architecture` are gone. `/triage` no longer hardcodes `.agents/skills/triage/SKILL.md`. [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) and [ADR-0022](docs/adr/0022-tickets-slice-to-build.md) named the old Methods in the present tense and gain dated amendments; ADRs 0007, 0008 and the `docs/redesign/` notes keep their original wording, because there they describe what was decided at the time rather than what the Boxes read now.
- **`/triage`'s label injection re-verified against the rewritten upstream.** v1.1.0 rewrote both `SKILL.md` and `AGENT-BRIEF.md`, and the binding still holds: two category roles, five state roles, `wontfix` still splitting into already-implemented versus rejected-enhancement, `.out-of-scope/` still the knowledge base. `classification.labels` remains the single source of truth and Matt's own label docs remain unread ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md)). Three bindings the rewrite made explicit are now written down: `AGENT-BRIEF.md` names `ready-for-agent` and `wontfix` as GitHub literals and must be read as canonical roles resolved through `LABELS`; the Method hardcodes `.out-of-scope/` in its `SKILL.md` as well as in `OUT-OF-SCOPE.md` — including in the prior-rejection check that runs while gathering context, before any outcome is chosen — where the DLC uses `TRIAGE.out_of_scope_dir`; and the "run `/setup-matt-pocock-skills` if the vocabulary is missing" fallback carried by `SKILL.md`, `to-spec` and `to-tickets` never applies, because Step 1 provided it.
- **`/improve-architecture` stops on a plugin-load error instead of claiming it can continue.** Its catch block previously returned `ok: true, degraded: true` with `methods: []`, while the same step's prose said an empty `METHODS` must stop the Box — a contradiction, and one that left the operator with no message to print. A plugin-load failure is not the degradable case: leniency covers a missing or unreadable *config*, but if this Plugin's own `lib/` cannot be imported there is no resolver, no Method resolves, and Step 3 has no procedure to follow. The catch now returns `ok: false` with the cause.
- **Method paraphrases removed from `commands/triage.md` and `commands/improve-architecture.md`.** Each carried a paragraph restating what the Method does — the defect [ADR-0030](docs/adr/0030-harness-hosts-methods.md) names, and one that had already come true: both summaries described the pre-v1.1.0 text. The Box now points at the resolved path and keeps only what the Harness owns (the config binding, the ADR deferral to Step 6, the durable artefact paths). `/tickets` likewise drops the restated slice rules, keeping the DLC's own granularity litmus and noting that it does not apply to the Method's new wide-refactor expand–contract sequence.

### Fixed
- **`CLAUDE_PLUGIN_ROOT` is named when it is missing.** Every Step 1 snippet builds its import paths with `join(pluginRoot, …)` — cross-platform, but `join(undefined, …)` throws "The \"path\" argument must be of type string", which names neither the variable nor the fix. Each snippet now checks the variable first and throws a sentence instead. Applied to all five commands that use the idiom, including `commands/setup.md`, which carried the same latent case before this release.


## [0.13.1] — 2026-08-03

### Breaking
- (none)

### Added
- **ADR-0030 — the Plugin is a Harness that hosts Methods.** Records the framing that ends the drift tranche 1 fixed mechanically: the Harness owns isolation, gates, config, red/green integrity, system-skill composition, artefact durability and posting, and a **Method** owns procedure. [ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md)'s "adds Unic value" test becomes structural — **a Box survives only for what no Method can supply** — which is why `handoff` and `prototype` are referenced rather than bundled, and why #281 is mostly deletion. Amends [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) and ADR-0021; both carry a status line pointing here.
- **ADR-0031 — Methods are bundled, the plugin version is the pin, resolution is three-tier.** Why the Methods must be committed files in the Consumer repo ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5: an Archon node runs in a separate worktree and cannot rely on `$CLAUDE_PLUGIN_ROOT`), why there is no `skills.pin` key, why paths must be repo-relative, and why Methods are read by path and never registered as skills. Records **per-box mapping as a rejected alternative** with its reason — it is the pre-#279 status quo that let the v1.1.0 rename wave break `/specs` and `/tickets` with CI green — plus two more rejections (run-time fetching, a separate pin key), so none of the three is re-derived.
- **ADR-0032 — the vocabulary.** **Box**, **Method**, **Local Method**, **Bundle**, and **Harness**, with the division that makes them decidable: configuration carries _parameters_ (which, where, whether) and a Method carries _procedure_ (how). A team wanting different method text forks the Method instead of gaining a config key, which is what stops the config schema absorbing method text one key at a time.
- **A drift test for the dependency list.** `test/methods-manifest.test.mjs` parses the Method table in `README.md` and asserts it matches the manifest's `providedTo` row for row, in manifest order, and that a Method with no Box says so rather than naming one. A stale row now fails CI.

### Changed
- **One dependency list, generated from the manifest.** `README.md` listed 6 Methods under three pre-v1.1.0 names (`grill-with-docs`, which is no longer a method at all, plus `to-prd` and `to-issues`), `commands/setup.md` listed none after tranche 1b, and the boxes read 11. All three surfaces now point at one table generated from `providedTo`, delimited by `methods-table` markers and guarded by the test above. `AGENTS.md` gains two doctrines — the Harness/Method division and "do not restate the list" — and `commands/setup.md` names the manifest instead of repeating it.
- **`Harness` replaces `thin process layer` as the canonical term.** `CONTEXT.md` defines Harness and lists the old phrase under `_Avoid_`; the opening sentences of `README.md`, `AGENTS.md` and `CONTEXT.md` are rewritten. ADR-0016 keeps its original wording as the historical record. `CONTEXT.md` also gains **Box**, **Method**, **Local Method** and **Bundle** — the last was load-bearing in code from tranche 1b (`METHODS_BUNDLE`, `verifyBundle`) while appearing in no glossary.
- **`README.md` states the never-registered-as-skills rule and its reason** — a Consumer running Matt Pocock's own Claude Code plugin would otherwise get every skill twice, with no way to tell which copy answered.

### Fixed
- (none)

## [0.13.0] — 2026-08-03

### Breaking
- (none)

### Added
- **`lib/methods-manifest.mjs` — the Method manifest.** One entry per Matt Pocock skill the Boxes compose (`name`, `upstreamPath` pinned to upstream tag `v1.1.0`, `subFiles`, legacy `aliases`, `providedTo`, `knownExternalRefs`), plus `resolveAlias` and `findMethod`. Until now a Method name was a hardcoded string in `commands/setup.md`, `commands/specs.md` and `commands/tickets.md` at once, with nothing tying the three together — which is why the upstream v1.1.0 rename wave (8 skills renamed; `to-prd` → `to-spec`, `to-issues` → `to-tickets`, `review` → `code-review`) broke those commands without a single failing test. A closure test walks the real v1.1.0 `SKILL.md` content for all 11 Methods and asserts every `` `/cross-reference` `` resolves to a manifest name, a manifest alias, or an audited external exception, so the next rename or content relocation fails the suite instead of shipping silently.
- **`lib/methods-resolver.mjs` — three-tier Method resolution.** `resolveMethod(name, { repoRoot, config, box, existsFn })` returns `{ name, path, tier }` for the first tier that answers — `config` (`methods.<name>.source`) → `local` (`.archon/methods.local/<name>/SKILL.md`) → `bundle` (`.archon/methods/<name>/SKILL.md`) — and an error value, never a throw, otherwise. Resolved paths must stay inside `repoRoot`: absolute paths, Windows drive letters, `~` prefixes, and `../` or `..\` escapes are all rejected, the last two normalised so a Windows-style escape is caught on POSIX too. The unresolved-Method error names both the Method and the requesting Box, so an operator reading a log knows which command to fix.
- **`vendor/mattpocock-skills/` — the Methods, bundled.** The 11 Methods the Boxes compose, copied verbatim from `mattpocock/skills` at tag `v1.1.0` (commit `d574778f`), mirroring the upstream `skills/<category>/<name>/` layout so each manifest entry's `upstreamPath` is load-bearing: an upstream relocation now fails the closure test instead of silently resolving nothing. Only the manifest's transitive closure is vendored — `handoff` and `prototype` are named in prose for a human to run and are deliberately absent. Provenance is a frozen `METHODS_BUNDLE` constant in `lib/methods-manifest.mjs` (repo, tag, commit, licence, licence sha256), with `vendor/mattpocock-skills/README.md` as its human mirror; a test asserts the two quote the same tag and commit.
- **`lib/methods-bundle.mjs` — verify, install, and inspect the bundle.** `verifyLicence` hashes the vendored `LICENSE` against the pinned tag's; `verifyBundle` checks every file each manifest entry declares — its `SKILL.md` **and** its `subFiles` — against the files on disk, because several Methods read their own companion files (`tdd` reads `tests.md`, `triage` reads `AGENT-BRIEF.md`) and a bundle holding only the `SKILL.md` files would pass every closure test while shipping Methods that point at nothing; a companion test asserts each entry's `subFiles` matches the vendored directory exactly, so an added upstream file cannot go unrecorded either; `installMethods` clean-replaces `.archon/methods/` so a Method dropped from a later manifest cannot linger; `inspectLocalOverrides` reports each `.archon/methods.local/<name>/` override's `forked_from` frontmatter. Error-as-value throughout, `node:fs`/`node:path`/`node:crypto` only — no shell, so it works on macOS, Windows and Linux. `installMethods` never reads or writes the Local-override tier.
- **`/setup` Step 6 — installs the Methods.** `verifyLicence` → `verifyBundle` → `installMethods` → `inspectLocalOverrides`, then the summary lists every Method with the tier it resolved from and flags any Local override whose `forked_from` differs from the bundled tag (a missing value is flagged too — an unversioned override is the case the check exists for). Either integrity failure stops the run: both mean the shipped Plugin is incomplete or altered, which no Consumer action fixes. A missing `LICENSE` asks the maintainer to restore it and is never auto-created.

This release completes tranche 1 of the upstream v1.1.0 migration: the manifest and resolver (slice 1a) plus the Bundle and the install path (slice 1b). Rewiring each Box onto `resolveMethod` is a separate slice, so no `commands/` box behaviour changes beyond `/setup`.

### Changed
- **Retired the `skills.matt_suite` config key.** It recorded a verify-only probe of whether the Consumer had separately installed Matt's skill suite — a question the Bundle now answers by construction. `defaultConfig()` drops it and gains `methods: {}` (the config tier `resolveMethod` reads); `mergeConfig` strips it from an existing on-disk config, so a re-run of `/setup` cleans it up with no manual migration. `/setup` Step 3 no longer probes for the suite, and `/specs`, `/tickets`, `/triage` and `/improve-architecture` drop the passthrough and the degrade warning. Per-Box `resolveMethod` wiring is a later slice, so no Box behaviour changes here.
- **Repointed the manifest closure test at the real bundle** and extended it from `SKILL.md` to every Markdown file a Method ships, which brings `improve-codebase-architecture/HTML-REPORT.md` and `triage/AGENT-BRIEF.md` into the scan. The 11 pinned `test/fixtures/methods/` copies are deleted: two pinned copies of the same upstream text is a drift trap — bump the bundle and the fixtures keep asserting the old tag, so the test passes while the bundle diverges. `.prettierignore` swaps the fixtures entry for `**/vendor/mattpocock-skills/skills/**`, scoped to the subtree so the vendor `README.md` stays Prettier-checked.

### Fixed
- (none)

## [0.12.0] — 2026-07-03

### Added
- **Regenerated the vision diagram** to the two-axis target architecture (redesign step 13, final). The new canonical pair is `docs/20260703-Unic-dlc.{mmd,excalidraw}`, hand-authored to show the main line (`/specs → /tickets → /build → /pr-review → /qa`), `/triage` + `/qa` findings + humans as on-ramps into `/tickets`, and the off-line boxes (`/setup`, `/explore`, `/improve-architecture`, `/cleanup`; `/handoff` + `/prototype` referenced), with the container (Archon vs command/skill) and HITL/AFK gate axes encoded. The superseded draft is archived as `docs/20260703-Unic-dlc-draft.{mmd,excalidraw}`; a dated `yyyymmdd-` snapshot scheme replaces the single canonical filename (newest date wins).
- **Documented the "deterministic output" property** in `CONTEXT.md` as an _emergent_ consequence of the fresh-slice-reads-committed-repo discipline ([ADR-0012](docs/adr/0012-fresh-context-red-green-separation.md) / [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md) / [ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)) — it needs no workflow.

### Changed
- **Swept the plugin docs to the shipped model** (redesign step 13). Rewrote the stale `README.md` — the old six-workflow diagram + node table, the `ROADMAP.md`/`HANDOFF.md` `docs/workflow/` layout, `yaml-gen`/`build-<slug>.yaml`, and the `Archon ≥ 0.10` requirement were all pre-redesign — into the two-axis box set, the four actual Archon workflow pipelines, a `<artifacts_dir>/<slug>/` session-artifact layout (no `ROADMAP.md`/`HANDOFF.md`), and `Archon ≥ 0.5.0`. Fixed `CONTEXT.md` (stale `unic-dlc-plan.md` example → `unic-dlc-build.md`; dropped the dissolved `yaml-gen`/`build-<slug>.yaml` relationships per [ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md)). Tidied the `plugin.json` / `marketplace.json` descriptions so only `build`/`qa`/`pr-review`/`explore` are called Archon workflows and `improve-architecture` is listed.
- **Marked the redesign complete** in `docs/redesign/README.md` (step 13 → done); the directory is kept as the historical record.

## [0.11.0] — 2026-07-03

### Breaking
- **Dissolved `lib/findings-writer.mjs` and `lib/spike-verdicts.mjs`** (and their tests) — completing [ADR-0018](docs/adr/0018-generic-core-config-compose.md) #3 for the explore-only libs. The `/explore` nodes now write `findings.md` and the spike verdicts with their own tools ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5), so these modules have no remaining consumer. `labels-config.mjs` is untouched (`config-schema.mjs` still imports `getDefaultLabels`).

### Added
- **Ported the `unic-dlc-explore` Archon workflow to the key-discriminated node schema** ([ADR-0011](docs/adr/0011-archon-schema-target.md); [ADR-0029](docs/adr/0029-explore-research-spike-onramp.md)). The shipped workflow was **doubly dead** — a `type:`-style spike gate that never paused, and an import of the already-deleted `lib/config-loader.mjs`. The off-line, optional research + AFK-spike pipeline (`bootstrap → guard → four parallel research nodes → synthesize → spike → spike-ticket → spike-branch-gate → preserve-spike`) now: writes `findings.md` to `<artifacts_dir>/<slug>/` ([ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)) instead of `docs/workflow/<slug>/`; frames the **Integrated Brief** as three explicitly-named lenses — **Domain Model / Established Decisions / Prior Research** — that `/specs`' load-context reads verbatim (the tightened `/explore → /specs` contract); runs the `spike` node **AFK** (build/measure where feasible, else reason → VALIDATED/INVALIDATED/PARTIAL) and **references** Matt's `/prototype` skill for the interactive case (never invokes it — nodes have no live conversation); files the spike ticket **before** a config-gated `approval:` spike-branch gate (`gates.explore`, HITL default) so the durable output survives a "discard", composing the tracker + `classification.labels` ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md)); and preserves the spike on `spike/<slug>` only on approve (AFK skips → worktree left for `/cleanup`). Nodes are self-contained prompt nodes with no plugin-`lib/` import. No new config key (`gates.explore` + `artifacts_dir` already exist) → no `/setup` change.

### Fixed
- (none)

## [0.10.0] — 2026-07-03

### Breaking
- (none)

### Added
- **`/cleanup` repo-global operational janitor command** (ADR-0028) — reports (and, on explicit opt-in, prunes) the debris an Archon-driven lifecycle accumulates: **merged/stale worktrees**, **stale branches/PRs**, and **stale `<artifacts_dir>/<slug>/` dirs**. It is a **Claude Code command, not an Archon workflow** (it mutates sibling worktrees/branches/PRs, so it cannot run inside an isolated worktree — ADR-0017), **composing** Archon's own `archon isolation list` / `archon isolation cleanup [days] [--merged] [--include-closed]` / `archon complete <branch>` for worktree/branch lifecycle and the configured tracker (`tracker.access`, MCP-first/CLI-fallback) for PR/branch state — no `tracker-adapter` lib. **Report-first and never auto-deletes:** pruning requires `--apply` **plus** an explicit **per-category** confirmation, and `cleanup.dry_run: true` (the shipped default) keeps even `--apply` in report mode until overridden. A slug dir is prunable **only if** its PR/branch is merged or closed (`cleanup.prune_slug_dirs` defaults `false`); slug-dir pruning skips any dir containing a `LICENSE` (repo policy). Config load is lenient (off-line); degrades to defaults when config or the tracker is absent.
- **`cleanup` config block** in `.archon/unic-dlc.config.yaml` — `stale_days` (default 7), `dry_run` (default true), `prune_slug_dirs` (default false). Added to `defaultConfig()` with merge/validate test coverage; **not** a mandatory path, so existing configs stay valid and auto-fill the block on next merge.

### Removed
- **Retired the legacy `unic-dlc-cleanup` Archon workflow + command stub** (`.archon/workflows/unic-dlc-cleanup.yaml`, `.archon/commands/unic-dlc-cleanup.md`). Its arch-review + ADR-consolidation content was harvested into `/improve-architecture` in v0.9.0 (ADR-0027); the `cleanup` name now belongs to the operational janitor (ADR-0028).

### Fixed
- (none)

## [0.9.0] — 2026-07-03

### Breaking
- (none)

### Added
- **`/improve-architecture` off-line arch-health command/skill** (ADR-0027) — surfaces technical + intent drift and deepening opportunities, writes a durable `arch-review.md`, and consolidates ADRs **including superseding**. It **composes Matt Pocock's `improve-codebase-architecture` verbatim** (technical drift + deepening HTML report + `/grilling` loop, with `/codebase-design` vocabulary + `/domain-modeling`) and **earns its place** (ADR-0021) by adding three DLC layers the raw skill lacks: an **intent-drift** pass (PRD stories/ACs vs shipped), a **durable artifact** under `<artifacts_dir>/` (ADR-0015), and an **ADR-consolidation gate with superseding**. Two modes: `/improve-architecture <slug>` → intent-grounded against that build session; `/improve-architecture` (no arg) → repo-wide sweep (dated artifact, intent-drift skipped). Superseding spans **both ADR homes** (plugin-local + repo-root), never deletes an ADR (old status → `Superseded by ADR-NNNN`, matching `README.md` index updated). Config load is **lenient** (off-line, touches no tracker); no new config key, no `lib/` change, no auto-hook. Harvests the legacy `unic-dlc-cleanup` `arch-review` + `adr-consolidation` content; does **not** touch that workflow (step 11's scope).

### Fixed
- (none)

## [0.8.0] — 2026-07-03

### Breaking
- (none)

### Added
- **`/pr-review` generic fan-out Archon workflow** (ADR-0026) — reviews the open PR by composing **one Intent Brief** (linked work items + Confluence/MD docs + PR description + `PRD.md`) in `prep` and **injecting it into every aspect**, then fanning out **seven parallel fresh aspect nodes** (code-quality, test-coverage, silent-failure, type-design, comment-rot, code-simplification, intent/AC-coverage) — conditionally spawned by the changed-file categories and scored on a confidence→severity rubric. Findings are synthesised, **reconciled against the prior iteration** (new / still-present / fixed / regressed) in a dedicated `reconcile` node keyed on a hidden `<!-- unic-dlc-pr-review:iteration=N -->` marker (never author identity), then — after a `gates.pr-review` confirm (AFK posts directly) — posted as a **summary comment + inline comments** via the configured tracker (MCP-first, CLI-fallback). It **harvests `unic-pr-review`'s review learnings with no ADO code and no runtime dependency** on that plugin; posting is advisory (the real merge gate is `/qa`). **Not** via `lib/tracker-adapter.mjs` (dissolved).
- **`pr-review` config block** in `defaultConfig()` — `{ confidence_threshold: 60, inline_comments: true }`. `mergeConfig` auto-fills it for existing configs (no `/setup` change). The `gates.pr-review` key already existed.
- **New ADR-0026** recording the self-contained harvest-not-depend decision, the fan-out schema, intent-composed-once-injected-everywhere, the confidence rubric + spawn gates, first-class re-review, and the confirm-before-post gate.

### Fixed
- (none)

### Changed
- **Renamed + ported the `unic-dlc-review` workflow to `unic-dlc-pr-review`** on the key-discriminated node schema (ADR-0011) — the shipped single monolithic `type: prompt` node ran inert. `git mv`'d the workflow YAML + command stub, moved config reads to `.archon/unic-dlc.config.yaml`, artefact paths to `<artifacts_dir>/<slug>/pr-review/` (ADR-0015), replaced the four-aspect single-comment node with the seven-aspect fan-out DAG, and dropped the stale `lib/tracker-adapter.mjs` + `apps/claude-code/pr-review/` references. Updated the plugin/marketplace descriptions to enumerate the current boxes (added `pr-review`, dropped the retired `plan`).

## [0.7.0] — 2026-07-02

### Breaking
- (none)

### Added
- **`/qa` issue-producing on-ramp** (ADR-0025) — a UAT rejection now files each defect **directly** as a `ready-for-agent` tracker issue (composing the configured tracker + `classification.labels` as the single source of truth, Matt's `qa` brief shape with blocked-by honesty and no file paths, and the `> *This was generated by AI during QA.*` disclaimer), feeding `/tickets`. Previously QA could only halt. Findings are filed `ready-for-agent` (not `needs-triage`) because the human at the UAT gate already vetted them. **Not** via `lib/tracker-adapter.mjs` (dissolved) — QA composes the tracker (MCP-first, CLI-fallback).
- **`qa` config block** in `defaultConfig()` — `{ e2e_command: null, coverage_threshold: null }`, resolved as `qa.e2e_command ?? build.e2e_command` (and likewise coverage) so a team can run a heavier QA suite than `/build`. `mergeConfig` auto-fills it for existing configs (no `/setup` change).
- **New ADR-0025** recording the port, the two-gate model, the AFK-safe `trigger_rule: all_done` + fail-closed merge `when`, the finding-capture on-ramp, and the `/tickets` routing (reconciling the step doc's "feed `/build`" with PLAN #8).

### Fixed
- (none)

### Changed
- **Ported the `unic-dlc-qa` Archon workflow to the key-discriminated node schema** (ADR-0011) — the shipped `type: interactive` UAT gate never paused. The pipeline (`e2e → coverage-gate → uat-prep → uat-gate → verify-pr-base → merge-gate → merge`) now has **two real `approval:` gates** (UAT + merge), both governed by `gates.qa` (HITL default, AFK opt-in). Downstream nodes use `trigger_rule: all_done` so AFK skips the gates and **auto-merges a clean build**; the merge node **fail-closes** (`when` on e2e/coverage results + verified PR base) so a red build or wrong base never auto-merges. Config reads move to `.archon/unic-dlc.config.yaml`; artefact paths move to `<artifacts_dir>/<slug>/` (ADR-0015). Nodes are self-contained prompt nodes — no plugin-`lib/` import (ADR-0023 §5). A missing `e2e_command`/`coverage_threshold` now **skips with a warning** instead of hard-failing.

## [0.6.0] — 2026-07-02

### Breaking
- **Retired the old `unic-dlc-triage` Archon workflow + command stub** (`.archon/workflows/unic-dlc-triage.yaml`, `.archon/commands/unic-dlc-triage.md`). Its state-snapshot role (writing `HANDOFF.md` / `ROADMAP.md`) was already retired by ADR-0013, and it used the inert `type:`-style schema (ADR-0011). `/triage` now means the intake on-ramp (ADR-0024).

### Added
- **`/triage` intake on-ramp command** (`commands/triage.md`, ADR-0024) — a thin wrapper that turns raw work (bugs, requests, QA findings, external PRs) into agent-ready tracker issues feeding `/tickets`. It **composes Matt Pocock's `triage` method but injects `classification.labels` from `.archon/unic-dlc.config.yaml` as the single source of truth** for labels (forbidding Matt's `docs/agents/triage-labels.md` / `issue-tracker.md`), so labels can't drift from what `/tickets` + `/build` read. Consequently `setup-matt-pocock-skills` is not a plugin dependency — only Matt's skill _methods_ are. Best-effort verification, no config knob; inherently HITL (writes directly, no PR gate); produces no `issues.json`/PRD.
- **`triage` config block** in `defaultConfig()` — `{ out_of_scope_dir: '.out-of-scope', external_prs: 'auto' }`, the DLC-config home for the two knobs Matt's setup would otherwise write to `docs/agents/*`. `mergeConfig` auto-fills them for existing configs (no `/setup` change).
- **New ADR-0024** recording the intake-on-ramp meaning, the thin-wrapper delegation, the single-source compose rule, the 8-state↔Matt-5-role mapping (`needs-specs`→`/specs`), and the retirement.
- **README `## Dependencies` section** documenting how to install Matt's skill-method suite and why `setup-matt-pocock-skills` must not be run.

### Fixed
- **De-referenced the retired triage workflow from `unic-dlc-cleanup`** — removed cleanup's dangling terminal `run-triage` node (which invoked `archon workflow run unic-dlc-triage`) and its `HANDOFF.md` / `ROADMAP.md` output rows. Surgical reference cleanup only; the full `/cleanup` redesign is step 11.
- **Added the missing ADR-0023 + ADR-0024 rows** to `docs/adr/README.md` index.

## [0.5.0] — 2026-07-02

### Breaking
- **Dissolved `lib/dag-builder.mjs`** (+ `test/dag-builder.test.mjs`, and its entry in the `test` script) per ADR-0023. `/build` no longer executes a generated per-slug `.archon/workflows/build-<slug>.yaml`; it consumes the dependency-ordered `issues.json` from `/tickets` directly via one generic loop. Codegen was the least-generic artefact in a generic-core plugin (ADR-0018).

### Added
- **`/build` ported to the key-discriminated Archon schema (ADR-0011) as one generic red/green/refactor loop** (ADR-0023). A single `loop:` node (`fresh_context: true`) advances every slice through three SEPARATE fresh-context phases — RED (write a provably-failing test, committed only when `test_command` exits non-zero), GREEN (minimum impl reading only the committed test, never RED's session), REFACTOR (clean up under a green suite) — serially in dependency order, with on-disk `build-state.json` as the baton. Preserves the anti-cheat contract (ADR-0012); retires the nested-`archon workflow run` risk (the loop runs inline).
- **New ADR-0023** recording the loop shape, the RED exit-code proof, refactor-as-third-fresh-phase, the dag-builder dissolution, gate honoring, and the self-contained-script convention for shipped Archon workflow nodes (no plugin-`lib/` import, since `/setup` installs only YAMLs + command stubs).

### Fixed
- (none)

## [0.4.0] — 2026-07-02

### Breaking
- **Deleted the legacy `.archon/workflows/unic-dlc-plan.yaml` + `.archon/commands/unic-dlc-plan.md`** (ADR-0022). The monolithic plan workflow is fully superseded by `/specs` (PRD) + `/tickets` (issues); it also used the inert `type:`-style schema (ADR-0011).
- **Dissolved `lib/tracker-adapter.mjs`** (+ `test/tracker-adapter.test.mjs`, and its entry in the `test` script) per ADR-0018. Tracker CLI-string generation is no longer a lib: `/tickets` (and other boxes) compose the configured tracker system-skill (MCP-first) or `gh`/`az`/`jira` CLI from config in prose (ADR-0016).

### Added
- **`commands/tickets.md`** — the `/tickets` box (ADR-0022, ADR-0017): an in-session command that decomposes an approved PRD into independently-grabbable **vertical tracer-bullet slices**, attaches a test seam per slice (nyquist-map), validates the set in a single conversational pass (dependency integrity, PRD-criteria coverage, mandatory fields via `issues-schema`, test-seam presence), writes a dependency-ordered `<artifacts_dir>/<slug>/issues.json`, publishes the issues to the configured tracker (intent on the issue — contract C), and opens a HITL tickets gate. Composes Matt Pocock's `/to-issues`. Runs the definitive estimation wave when `estimations` is `definitive | both`.
- **`tickets` config block** — `tickets.gate` (`open-pr` | `stage-only`, default `open-pr`), mirroring `specs.gate`. See ADR-0022.

### Changed
- **`/tickets` stops at a build-ready `issues.json`; it does NOT generate a build DAG** (ADR-0022). `/build` (step 06) will consume `issues.json` via a generic loop rather than a per-slug generated workflow — so `lib/dag-builder.mjs` is off the main path and left untouched pending the `/build` step. Contract B (fresh-context red/green, ADR-0012) is preserved; its delivery mechanism moves from codegen to a runtime loop. The step-06 redesign handoff doc is updated accordingly.

### Fixed
- (none)

## [0.3.0] — 2026-07-02

### Breaking
- **`lib/prd-writer.mjs` reshaped (ADR-0018).** The hardcoded 7-section template is gone: `writePrd(projectDir, slug, content, artifactsDir = 'workflows')` now persists an already-rendered PRD string (was `writePrd(projectDir, slug, sections)`), and `readPrd` takes the same `artifactsDir`. The PRD now lands at **`<artifacts_dir>/<slug>/PRD.md`** (default `workflows/<slug>/`), not `docs/workflow/<slug>/`. `validatePrdSections(content, requiredHeadings = DEFAULT_PRD_HEADINGS)` is now generic (headings passed in). The legacy `.archon/workflows/unic-dlc-plan.yaml` is superseded by `/specs` + `/tickets` and left untouched until step 05.

### Added
- **`commands/specs.md`** — the `/specs` box (ADR-0020, ADR-0017): an in-session command that turns an idea (or an existing spec / Figma / UX / issue) into one human-approved PRD by **branch-on-input** (converse / ingest / hybrid), composing Matt Pocock's `/grill-with-docs` + `/to-prd` and the configured docs/design/tracker system-skill (MCP-first, CLI-fallback). Adds a seam-design approval step, config-gated provisional estimation, opt-in docs publishing, and a HITL PRD gate.
- **`templates.prd` default** — the 7-section PRD scaffold now ships in config (`DEFAULT_PRD_TEMPLATE` in `config-schema.mjs`, ADR-0018); teams override it to change the PRD shape.
- **`specs` config block** — `specs.discuss_mode` (`discuss` | `assumptions`, default `discuss`) and `specs.gate` (`open-pr` | `stage-only`, default `open-pr`). See the amended ADR-0020.

### Changed
- **`README.md`** configuration reference: `templates.prd` now defaults to the scaffold; added `specs.discuss_mode` and `specs.gate` rows.

### Fixed
- (none)

## [0.2.0] — 2026-07-02

### Breaking
- **`/setup` is now conversational and writes the rich `.archon/unic-dlc.config.yaml`** (ADR-0019, supersedes ADR-0001), replacing the flat `.archon/unic-dlc.config.json`. The command detects the stack, runs verify-only skill discovery (introspect MCP/skills + CLI probes; never installs) to register a capability→tool map, verifies Matt Pocock's declared skill suite (warn + degrade, non-blocking on a missing required capability), and composes the team's system-skills for the _how_. An existing legacy `.json` is read and migrated but **left in place** (other tools may read it) — no backup file, no delete.
- **Dissolved the heavy setup libs** `lib/install-runner.mjs`, `lib/setup-explorer.mjs`, `lib/config-loader.mjs`, and `lib/agent-docs-writer.mjs` (and their tests). Their `docs/agents/` + `CLAUDE.md` marker-block behaviour is re-homed to idempotent prose steps in `commands/setup.md`. See ADR-0018.

### Added
- **`lib/config-schema.mjs`** — the one surviving tested lib (imports `yaml`): `loadConfig` (parses `.yaml`/`.json`), `validateConfig` (mandatory-path invariant), `mergeConfig` (deep, idempotent, `defaults < existing < answers`), `migrateLegacy` (flat ADR-0001 JSON → rich nested shape, preserving hand-added labels such as `release`), `toYaml`, and `detectRepoLayout`. Covered by `test/config-schema.test.mjs`.
- **`yaml`** runtime dependency (pinned via the pnpm catalog).

### Changed
- **`lib/archon-check.mjs`** now enforces a behavioural min-floor (`checkArchon` rejects Archon `< 0.5.0` via `MIN_ARCHON_VERSION`) instead of an exact-version match — the key-discriminated schema (gates/loops/fresh-context) requires `≥ 0.5.0` (ADR-0011/0019). Unparseable versions are non-blocking. The `incompatibleVersions` override is preserved (bare-array and options-object forms both accepted).
- **`README.md`** configuration reference rewritten to the rich YAML schema.

### Fixed
- (none)

## [0.1.2] — 2026-05-23

### Breaking
- (none)

### Added
- Updated `buildDomainDoc` multi-context branch in `lib/agent-docs-writer.mjs` so the generated `docs/agents/domain.md` notes that each context may keep its own `docs/adr/` for context-scoped decisions, and branches the trailing "How agents use this" paragraph by `isMulti` so the multi-context form points readers via `CONTEXT-MAP.md` and acknowledges both root and context-scoped `docs/adr/`. The wording is portable — no hardcoded path leaks into Consumer output. A node:test assertion in `test/install-agent-docs.test.mjs` guards the phrases in multi-context mode and confirms they are absent in single-context mode.

### Fixed
- (none)

## [0.1.1] — 2026-05-23

### Added
- Added `/unic-archon-dlc:setup` slash command for conversational plugin configuration
- New `lib/dogfood-banner.mjs` module: exports `AGENT_DOC_BANNER`, `SKILLS_BLOCK_BANNER`, and `prependBanner()` — all banner strings in one place.
- Every `docs/agents/*.md` file generated by `agent-docs-writer.mjs` now begins with `AGENT_DOC_BANNER`, signalling it is auto-generated and explaining how to regenerate it.
- The `<!-- unic-archon-dlc:begin/end -->` block in `CLAUDE.md` now includes `SKILLS_BLOCK_BANNER` as its first line, making the auto-managed region visible in plain text (not only via HTML-comment markers).
- Dogfood state in this repo updated: `docs/agents/*.md` and the `AGENTS.md` block now carry the banner.

### Removed
- Removed `hooks/install.mjs` and `hooks` field from `plugin.json`

### Fixed
- Build `run-build` node prompt now invokes the generated per-slug workflow by name (`archon workflow run unic-dlc-build-<slug>`) instead of the no-longer-supported `archon run <path>`
- Cleanup workflow `run-triage` error message now says `archon workflow run failed` (matches the actual command); cleanup command doc references the by-name invocation instead of `archon run`
- `docs/agents/workflow.md` (and the `agent-docs-writer.mjs` generator) now list all seven workflow DAGs — the missing `review` phase has been added alongside the six lifecycle phases. The `review` row's artifact column now covers both PR-comment trackers (github/ado/jira) and the `local-markdown` tracker (which writes `docs/workflow/<slug>/review-comment.md`); the install-agent-docs test anchors on the unique `/unic-dlc-review` command string so the row can't silently regress
- Fixed stale reference in `CONTEXT.md`: Relationships section now credits the **Setup** slash command (not the deleted install hook) for writing config/docs into the target project
- Fixed `repo_layout` default and valid-values columns in `README.md` configuration reference table to use `single-context` (as produced by `detectRepoLayout()`) instead of `single`
- Fixed shell injection in `setup` command Step 5: `{ANSWERS_JSON}` is now substituted directly inside the `<<'EOJS'` heredoc instead of being assigned to a shell variable, so single quotes in e2e commands (e.g. `pnpm test --grep 'smoke'`) no longer break the assignment
- Fixed unreachable `STATE = 'partial'` branch in `setup` command Step 2: config discovery now uses a raw `JSON.parse` instead of the strict `loadConfig`/`isConfigError` path, so partial configs (files missing one or more mandatory fields) are properly detected and users are prompted only for the missing fields
- `runInstall`: optional fields (`e2e_command`, `model_profile`, etc.) from a partial config file (one missing mandatory fields) are no longer silently dropped during merge
- `runInstall`: partial-write error messages now clarify which earlier stages succeeded ("Config written to …" for docs-stage failures; "Config and docs written." for CLAUDE.md-stage failures)
- Wrapped all three `node --input-type=module` heredocs in `setup` command (Steps 1, 2, 5) in try/catch so that import failures (e.g. `ERR_INVALID_URL`, `ERR_MODULE_NOT_FOUND` when `CLAUDE_PLUGIN_ROOT` is unset or wrong) always produce JSON output instead of crashing with no output
- Fixed silent discard of corrupt config in Step 2: an invalid-JSON config file now surfaces an `error` field in the output and stops setup with an actionable message, instead of silently mapping the `SyntaxError` to `STATE = 'fresh'` and overwriting the user's config
- `runInstall`: corrupt config files (invalid JSON) now return a `stage: 'config'` error with an actionable message instead of silently discarding the existing config and overwriting it; file read errors (e.g. `EACCES`) are also surfaced as early returns
- Added missing test for `stage: 'claude-md'` failure branch, test for corrupt-config parse error; removed always-passing placeholder test
- Corrected dogfood banner regenerate hint from `/unic-archon-dlc-setup` to `/unic-archon-dlc:setup` (the actual slash-command name uses a colon, not a dash). Tightened `dogfood-banner.test.mjs` to assert the exact command string. Regenerated `docs/agents/*.md` carry the corrected banner.
- `AGENT_DOC_BANNER` no longer references a non-existent "setup-runner"; it now points to the real entry point `runInstall()` in `lib/install-runner.mjs`. `SKILLS_BLOCK_BANNER` now names the slash command (`/unic-archon-dlc:setup`) explicitly so readers who land inside the marker block via search have unambiguous regenerate instructions. Regenerated `docs/agents/*.md` and the `AGENTS.md` block carry the updated wording; PRD canonical wording updated to match.

## [0.1.0] — 2026-05-15

Initial release of the unic-archon-dlc plugin. Ships the complete AI development lifecycle
as six Archon workflow DAGs with human approval gates at every decision boundary.

### Added

- **Install hook** (`/unic-dlc-install`): auto-detects tracker from git remote, deduces PR
  strategy and branching model, writes `.archon/unic-dlc.config.json`, agent skill docs under
  `docs/agents/`, and idempotent `## Agent skills` block in `CLAUDE.md`.
- **`triage` workflow** (`/unic-dlc-triage`): headless/on-demand; reads current issue states,
  reconciles `docs/workflow/ROADMAP.md`, and produces `HANDOFF.md` with phase, open issues,
  blockers, and recent decisions.
- **`explore` workflow** (`/unic-dlc-explore <slug>`): four parallel research nodes
  (stack/features/architecture/pitfalls) → synthesize → prototype + spike verdicts →
  interactive code-preserve gate → spike ticket creation.
- **`plan` workflow** (`/unic-dlc-plan <slug>`): adversarial spec interview (loop) → PRD
  synthesis → human PRD gate → issue decomposition → Nyquist test-command mapping →
  plan-checker validation loop (max 3 iterations, stall detection) → YAML generator →
  human plan gate.
- **`build` workflow** (`/unic-dlc-build <slug>`): slopcheck package gate → generated
  `build-<slug>.yaml` (red→green TDD per issue, parallel across independent issues) →
  verification (stub detector, coverage) → goals-check coverage matrix → consolidation
  report → human build PR gate.
- **`review` command** (`/unic-dlc-review`): self-contained four-aspect code review (code
  quality, test adequacy, silent failures, type design); posts structured comment via tracker
  adapter; updates prior comment on re-run. No dependency on `pr-review-toolkit`.
- **`qa` workflow** (`/unic-dlc-qa <slug>`): e2e suite → coverage gate → interactive UAT
  gate (acceptance criteria checklist) → PR base verification → merge via tracker CLI with
  branching-strategy-aware branch deletion.
- **`cleanup` workflow** (`/unic-dlc-cleanup <slug>`): architecture review (technical drift,
  intent drift, deepening opportunities) → per-ADR interactive consolidation gate → reuse of
  shared triage workflow.
- **lib modules**: `config-loader`, `setup-explorer`, `labels-config`, `agent-docs-writer`,
  `tracker-adapter`, `handoff-generator`, `findings-writer`, `prd-writer`, `spike-verdicts`,
  `issues-schema` (topological sort), `dag-builder` (YAML generator), `slopcheck`,
  `stub-detector`.
- **86 `node:test` tests** covering all lib modules.
