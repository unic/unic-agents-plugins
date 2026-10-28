---
allowed-tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']
argument-hint: '[reconfigure | <free-form intent>]'
description: 'Install unic-archon-dlc into this project: copy the Boxes and the Methods, write the config and the tracker contract, and patch the managed blocks'
---

# unic-archon-dlc:setup

**Arguments:** "$ARGUMENTS"

`/setup` is this Plugin's installer and its sole configuration entry point. It is prose: do every action
below with your own tools — Read, Write, Edit, Glob, Grep and Bash. Import nothing, shell out to no Node
script, and do not read `$CLAUDE_PLUGIN_ROOT`: an installed Plugin ships no `node_modules`, and that
variable is not set inside the Bash tool.

## What `/setup` owns, and what it only visits

Six actions land four kinds of artefact, and **ownership decides the treatment**. Three treatments, and
every action below names which one it takes:

| Treatment   | Applies to                                   | Behaviour on a re-run                                                                |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| **replace** | a whole tree the Plugin owns                 | overwritten silently, every run                                                      |
| **report**  | a file the tenant owns                       | written when absent; when present, read it and report what differs, changing nothing |
| **patch**   | a marked block inside a file the tenant owns | the block is rewritten between its markers; everything outside them stays verbatim   |

**report** has one override: the `reconfigure` argument (Step 3). Outside a marked block, nothing else
rewrites a tenant file.

**This Plugin's prefix is `unic-dlc`, and `/setup` touches no name that carries another prefix.** A
Consumer may hold Practice Packs beside this Plugin, each with its own prefix and its own installer. In `.claude/skills/`, in `.archon/packs/`,
in `CLAUDE.md` and in every formatter ignore file, `/setup` writes, overwrites or removes only these names:

- a `.claude/skills/unic-dlc-*/` directory. Today `/setup` writes, overwrites or removes nothing in
  `.claude/skills/`.
- `.archon/packs/unic-dlc.config.yaml`. `/setup` writes nothing in `.archon/packs/` until a
  later Plugin version adds the layered Practice Pack config. The
  Consumer's config stays at `.archon/unic-dlc.config.yaml`, as Step 6 says.
- the block between the `unic-dlc:begin` and `unic-dlc:end` markers in `CLAUDE.md` and in each ignore
  file.

Leave every other skill directory, config file and marked block as you found it, whatever it contains. The
one exception is the legacy `unic-archon-dlc:begin` and `unic-archon-dlc:end` markers. They are reserved to
this Plugin, and Step 7 migrates a block under them.

Whether one prefix may begin another is still open, and this rule does not settle it. A pack prefixed
`unic-dlc-e2e` would own `unic-dlc-e2e-*` skill directories, which also match `unic-dlc-*`. That overlap is
an open risk until a later Plugin version decides the boundary.

## Step 1 — Preflight

Two checks, in this order. Each one stops the run when it fails, before any question is asked and before
anything is written.

**Archon.** Run `archon --version`. This Plugin's floor is **`0.7.0`** — the version whose schema carries
gates, loops, `context: fresh`, `evidence_policy` and `always_run`. Compare the three numbers, never the raw strings:
the output may carry a program name or a `v` prefix. Three ways this stops: the command is not found; the
version parses and sits below the floor, so print both versions; or the output yields no three numbers at
all, so print it raw and say the floor could not be checked against it.

**This Plugin's own installed directory.** The install step copies both trees out of it, so find it now.
Claude Code keeps a registry at `~/.claude/plugins/installed_plugins.json`; read it and take the entry keyed
`unic-archon-dlc@<marketplace>`. Each entry carries `scope`, `installPath`, `version` and — for a
project-scope install — the `projectPath` it belongs to. Select in this order, and take the first that
resolves:

1. exactly one entry → that one, whatever its scope.
2. the entry whose `projectPath` is this repository's root. In a `git worktree` that is the main checkout's
   root, not the worktree's, so resolve it before comparing.
3. the sole `user`-scope entry.

`installPath` is the directory. **Entries that exist and select none is its own stop**: print every entry
with its scope and path, say which rule failed, and stop. Guessing between two projects' installs is the
error this lookup replaced.

Then verify it before trusting it, and keep `PLUGIN_VERSION` from the manifest you read:

1. `.claude-plugin/plugin.json` there names `unic-archon-dlc`, at the same version as the registry entry.
2. `vendor/mattpocock-skills/` is present.
3. `.archon/workflows/` holds at least one `unic-dlc-*.yaml`.
4. `README.md` is present and holds all three sections later steps read from `<installPath>/README.md`:
   § Dependencies, § Configuration reference and § The tracker contract. A missing section fails the
   check. Name it in the stop.

Print what you found and stop on any of: no entry for this Plugin, a registry whose top-level `version` is
not `2`, or a failed check above. The registry entry and the manifest agreeing is the whole of the version
test — this file carries no version of its own, so there is nothing else to compare it against.
**Take the path from the registry alone.** The version cache holds one directory per version ever
installed — nine of them on the machine this was written on — so a search of that cache is a guess among
candidates, and an install that copies from the wrong version is worse than no install.

## Step 2 — Read the project

Four reads, all verify-only. Nothing here writes.

**The config.** Read `.archon/unic-dlc.config.yaml`, keep the parsed object as `CURRENT` and the path as
`CONFIG_PATH`. Present but unreadable → print the parse error and stop, rather than overwrite the only copy.
Absent → `CURRENT` is null, and Step 6 sets `CONFIG_PATH` when it writes.

A `.archon/unic-dlc.config.json` also stops the run: report the path, say that it is the flat shape an
earlier version of this Plugin wrote and that no migration ships any more, and change nothing. That
migration had never been walked by a real project when it was removed, and reading such a file as "no
config" would write a second config beside it.

**The git remotes.** Run `git remote`. Three refusals, in this order:

- `git` is not on `PATH` → print `git binary not found on PATH. Install git before running /setup.` and stop.
- the command failed otherwise → print the error, ask the operator to confirm this directory is a git
  repository, and stop.
- the list is empty → print `This project has no git remote configured. Archon derives the workspace path for an isolated run from a remote, so a Box cannot be dispatched without one. Add one — e.g. git remote add origin <url> — and re-run /setup.` and stop.

A Box takes the repository it works on from the tracker contract, never from a remote: one remote has
several spellings and a fork clone names two repositories. The remote is Archon's own need, not the Boxes'.

Then run `git remote get-url origin` and keep it as `GIT_REMOTE`. An absent `origin` is an empty value
here, not a refusal.

**Archon's own config, verify-only.** Read `.archon/config.yaml` — **Archon's** file, which this Plugin
never writes. Resolve the remote the way Archon does and keep it as `ARCHON_REMOTE_RESOLVED`: its
`worktree.remote` key when set, else `origin` when a remote of that name exists, else the sole remote when
there is exactly one, else nothing. On Archon `0.7.0` that key governs base-branch resolution only — the
workspace path still derives from `origin` — so report it in Step 8 and write it nowhere. Present but
unreadable → say so, keep `ARCHON_REMOTE_RESOLVED` empty and carry on. One summary line depends on this
file, so it never stops the run; the rule two reads above stops the run because overwriting the config would
destroy it.

**The base branch Archon will use, verify-only.** Every Box reads a run's base branch from Archon's
`$BASE_BRANCH` and from nothing else. Archon resolves it from `archon workflow run --base
<branch>`, then `worktree.baseBranch` in `.archon/config.yaml`, then the codebase's stored default branch.
Each dispatch passes its own `--base`, so this command cannot see it. From the same file, keep
`worktree.baseBranch` as `ARCHON_BASE_CONFIGURED`. It is empty when the key is unset or the file is
unreadable. This command cannot read the codebase default itself, and what Archon stores depends on its
version. Archon 0.7 to 0.11 store the branch that was checked out when the repository was first
registered. From 0.12.0, new projects follow the remote's default branch unless a base is chosen
([v0.12.0 release notes](https://github.com/coleam00/Archon/releases/tag/v0.12.0)). So the remote's default is an approximate stand-in, and `worktree.baseBranch` is the value to rely on. Run
`git symbolic-ref --short refs/remotes/<ARCHON_REMOTE_RESOLVED>/HEAD`, strip the remote prefix, and keep
the result as `REMOTE_DEFAULT_BRANCH`. It is empty when the ref does not resolve. Set `ARCHON_BASE_RESOLVED`
to `ARCHON_BASE_CONFIGURED` when it is set, else to `REMOTE_DEFAULT_BRANCH`. Write nothing to the file.

**The repo layout.** Keep `REPO_LAYOUT`: `multi-context` when this repository holds more than one
independently-releasable project (a `packages/` or `apps/` tree with its own manifests), otherwise
`single-context`. Never ask for it.

Then set `STATE`: `fresh` when `CURRENT` is null, `partial` when `CURRENT` exists with `project.branching`
unset, `full` otherwise. `project.branching` is the one key a config needs before the Boxes can read it;
every other key has a default, named in § Configuration reference in `<installPath>/README.md`.

## Step 3 — Read the arguments

- empty or whitespace → `MODE = 'default'`
- trimmed lowercase `reconfigure` → `MODE = 'reconfigure'`
- anything else → `MODE = 'intent'`, `INTENT = $ARGUMENTS`

`reconfigure` is the **report** override, and the only one. Under it, a tenant-owned file this run would
write differently is offered to the operator: show what would change, ask about that file, and write only
what they confirm. It is how a wrong first answer gets corrected — without it the only remedy is deleting
a file.

**Step 5 runs under every mode**, including `full` + `default`. It is how a Plugin upgrade lands, and it
needs no answers: that is why it comes before the conversation, and why a re-run needs no argument to
refresh what this Plugin owns. Steps 6 and 7 run under every mode too, each bounded by the treatment its
artefact takes — so a re-run there reports rather than rewrites.

## Step 4 — Discover what this project has

Three sweeps. All verify-only — introspect, install nothing.

**Capabilities.** Build a capability → tool registry the Boxes read (`mcp | cli | skill`, MCP-first). Note
which relevant MCP servers this session has for the tracker, the docs system and the design system. Probe
CLIs portably, without `jq`, `awk` or `sort`, and record which succeed. A missing capability **warns and
degrades**: finish the run, record it unavailable, and list the Boxes it blocks — they re-probe at runtime
and fail with their own message. Never abort the run for a missing capability.

Do not probe for the Methods here. They ship inside this Plugin and Step 5 installs them; their presence
is bundle integrity, not discovery. Which Method each Box reads is recorded once, in
§ Dependencies in `<installPath>/README.md`.

**What this project runs.** One read, two harvests — read the manifests, task files and scripts this
project actually runs, whatever the language, and keep both of these from that one read:

- `FORMATTERS`, for Step 7, which excludes this Plugin's own artefacts from them: every tool that formats
  or lints, together with the paths each one reaches. For each tool, find how it excludes a path, from that
  tool's own current documentation. Where the mechanism is unclear, ask the operator which file to patch
  rather than write to a guess. Record per tool the exclusion mechanism, and whether that mechanism is a
  **line-based ignore file** or a structured config value.
- `SDLC_NEEDS`, for Step 6: the command this project already runs for each of the nine needs the config
  declares — `install`, `build`, `test`, `e2e`, `lint`, `format`, `typecheck`, `dev`, `coverage`. Keep what
  you found, and nothing at all for what you did not; Step 6 offers each one as a proposal the operator
  confirms or corrects. A key names a **need** and never a tool, so you are looking for the command this
  project runs for that job — not for a tool you expect a project of this kind to have.

Read what the project runs, never a list held here: this Plugin knows that an installed file must not be
reformatted, and that a development process has these needs. It knows nothing about which tool serves
either, and a project that serves a need some other way is the normal case, not an error.

**The tracker's own vocabulary.** Step 6 writes the tracker contract, and its values have to be names the
board already carries. Through whichever tracker surface Step 4 found, read what this tracker actually uses
— its states, its tags or labels, its work-item types, and how often each appears. Keep it as
`TRACKER_VOCABULARY`. No access yet → keep it empty; Step 6 handles that case.

## Step 5 — Install the Boxes and the Methods (**replace**)

Both trees come out of the directory Step 1 verified. This is the **replace** treatment: overwrite
silently, every run. Every installed **Box** carries a header naming this Plugin and its version and saying
that `/setup` replaces it, which is what makes an overwrite legible — an operator's edit shows up as a
tracked `git diff` after a run, not as a warning dialog. **No Method file carries one**, and the
Methods bullet below says why.

**The Methods.** Verify the bundle at `vendor/mattpocock-skills/`, then copy it into `.archon/methods/` —
the one path every Box and command reads a Method from.

This Plugin alone owns `.archon/methods/`. A Practice Pack never ships a Method, and a skill a pack installs
under `.claude/skills/` is not a Method. So the wholesale replace below removes nothing another installer wrote.

**The copy flattens.** The bundle groups Methods by category, so a Method sits at
`vendor/mattpocock-skills/skills/<category>/<name>/`; a Box reads `.archon/methods/<name>/SKILL.md`, one
level deep. Copy each Method directory to `.archon/methods/<name>/`, dropping the category, and copy the
directory whole so every companion file travels with its `SKILL.md`. Copy with your own file tools, walking
the tree and writing each file: a recursive shell copy is written differently on each host, and this command
runs on all of them. Two Methods sharing a `<name>` across
categories collide at the destination: report both source paths and stop. Copy nothing else out of the
bundle — the bundle's own `README.md` and its `LICENSE` are this Plugin's records, verified below and never
installed.

- Every Method directory carries a `SKILL.md`. Verify companions **by reading**: open each `SKILL.md` and
  confirm every companion file it points at sits beside it. A Method referencing none needs none — several
  correctly ship one file, so a file count is not the test. A companion the text points at and the
  directory lacks is a Method pointing at nothing: report it and stop.
- `vendor/mattpocock-skills/LICENSE` must be present. Absent → ask the maintainer to restore it and stop.
  **Never create a `LICENSE` file.**
- `vendor/mattpocock-skills/README.md` records the upstream repository, tag and commit this bundle was
  copied from. Read it and keep the tag as `BUNDLE_TAG`.
- Check what the bundle **lacks**, not only what it holds: compare the Method names in it against the table
  under § Dependencies in `<installPath>/README.md`. A Method that table names and the bundle does
  not hold is a fault — report it by name and stop here, before anything is written. Keep the names you do
  install as `METHODS_INSTALLED` for the summary.
- Copy clean: replace `.archon/methods/` wholesale, so a Method dropped from a later Plugin version cannot
  linger. One exception, and it is absolute, so perform it in this order: **before you remove anything**,
  list every `LICENSE` under that tree and read each one; remove and copy; then restore each `LICENSE` to
  the path you found it at, and name each one in the summary. An exception written as an outcome is one a
  wholesale delete reaches first. **Never delete a `LICENSE` file.**
- Stamp no header on a Method file. The bundle is upstream text pinned to one tag, and a line added at the
  top forks it from that tag — which is the fork Step 7 exists to prevent. `BUNDLE_TAG` in Step 8 and the
  version on the Boxes carry the provenance for this tree.
- Two override paths an earlier version offered now resolve nothing, because `.archon/methods/` is the only
  path anything reads. Report each one you find, once, as retired, and change neither — both are the team's
  own work: a `.archon/methods.local/` directory, and any `methods.<name>.source` key in the config. When
  you report one, say that the route to replace a Box step is now an `include:` slot, decided and not yet
  built.

**The Boxes.** Install every `unic-dlc-*.yaml` this Plugin ships into `.archon/workflows/`, discovered by
reading the Plugin's own `.archon/workflows/`. The install takes no Box name from this file. Only the
`CLAUDE.md` block below lists the Boxes by name.

Install is **name-scoped, never a whole-directory replace**: `.archon/workflows/` is shared with the
Consumer's own workflows, so only names matching `unic-dlc-*.yaml` are read, written, overwritten or swept.
A file named outside that pattern stays untouched whatever it contains — that is what makes the variant
escape hatch in `<installPath>/README.md` true. The sweep retires a `unic-dlc-*.yaml` this Plugin version
no longer ships, whether or not it carries the header: ownership is decided by name alone.

Before overwriting, read the first line of each `unic-dlc-*.yaml` already on disk and keep the version it
names as `PREVIOUS_VERSION`. Then write each Box with this line first, `PLUGIN_VERSION` filled in:

```yaml
# Generated by unic-archon-dlc <PLUGIN_VERSION> — /unic-archon-dlc:setup replaces this file on every run.
```

Match the **fixed part** of that line — everything up to the version — as a prefix of the first line, then
read the version that follows it. Matching the rendered line whole would only ever recognise a re-run at this
same version, which is the one case `PREVIOUS_VERSION` is not for. Never search the whole file: a Consumer
file that mentions the marker text further down is not a file this command wrote. `PREVIOUS_VERSION` is empty on
a fresh project and on a Box carrying no such line. Boxes naming **different** versions is a partial prior
install: report every version you found rather than picking one, because picking one claims an install state
that never existed.

`/setup` writes nothing into `.archon/commands/`.

Keep `WORKFLOWS_WRITTEN`, `WORKFLOWS_ADDED` and `WORKFLOWS_REMOVED` for Step 8.

**Any failure in this step stops the run.** A missing licence, an incomplete bundle, a copy that could not
be written, a stale Box that could not be removed — each means the shipped Plugin is incomplete or the disk
refused a write, and none is fixed by re-running an earlier step. Say how much landed, and that a bare
re-run of `/setup` self-heals because it replaces the affected tree. Report success only when no stale Box
is left on disk.

## Step 6 — Write the config and the tracker contract (**report**)

Three tenant-owned files. A write that fails here stops the run and names the file: unlike the install step,
nothing downstream self-heals a tenant-owned file, because the next run finds it present and reports on it.
Each one is written when it is absent. When it is present, read it, report what
differs from what this run would write, and change nothing — unless `MODE = 'reconfigure'`, which offers
the change per file (Step 3).

### The config

Collect only the gaps, conversationally, then write `.archon/unic-dlc.config.yaml`.

Which gaps: `STATE = 'fresh'` → every field; `STATE = 'partial'` → the missing ones;
`MODE = 'reconfigure'` → every field; `MODE = 'intent'` → the missing ones first, then read `INTENT` to
decide which already-set fields to revisit. Surface `GIT_REMOTE` as a hint while asking. Pass `REPO_LAYOUT`
through without asking.

The fields, mapped onto the schema paths in § Configuration reference in `<installPath>/README.md`,
which is the single source of truth for every default:

- **project** — `project.name`; `project.branching` (`gitflow | github-flow`, mandatory);
  `project.repo_layout` = `REPO_LAYOUT`.
- **docs** — `docs.type`: ask where the team's product specs live and write the answer through. It is a
  format or the name of a docs system, or `none`. `docs.publish` (default `false`, opt-in).
- **design** — `design.type`: ask which design system the team designs in and write the answer through, or
  `none`.
- **gates** — per Archon Box: `hitl` (default) or `afk`. Interactive commands are always HITL and are not
  listed.
- **sdlc_needs** — the nine nullable keys naming what this project's development process needs:
  `install`, `build`, `test`, `e2e`, `lint`, `format`, `typecheck`, `dev`, `coverage`. Walk them one need
  at a time. For each one, offer the value Step 4 harvested as a **proposal** the operator confirms or
  corrects; where Step 4 found nothing, ask, and take `null` for an answer. Never present a list of tools
  to choose from, and never write a value the operator did not confirm. Write the block under this
  comment, which is where the rule reaches the human who edits the file later:

  ```yaml
  # Each key names a NEED of this project's development process, never a tool. `test` names the need;
  # whichever runner this project uses is the tool that serves it. A null value means this project
  # declares no command for that need, and a node that wants it reports an unresolved check — never a
  # pass. `build`, `lint`, `format` and `dev` have no node reading them today; they are declared anyway,
  # because /setup writes this file once and thereafter only reports on it, so a key added later costs a
  # `reconfigure` in every project that already has one.
  ```

- **build** — `build.coverage_threshold`, optional. The number stays here; the command that produces a
  coverage figure is `sdlc_needs.coverage`.
- **estimations**, **model_profile** — defaults unless the operator asks.
- The Step-4 capability results under `docs.access` and `design.access`.

Two rules about what this conversation leaves alone:

- **Ask for no tool name as a closed choice.** `docs.type` and `design.type` take whatever the team says.
  No Box compares either value to a literal — each tests set-versus-`none`, and `design.access.mcp`
  resolves the actual tool — so a list of accepted names here would only be a list to fall behind.
- **The config holds no tracker fact.** The contract files below carry all of them — which surface serves
  this tracker, the coordinates a call needs, and which value each canonical role writes. So the config
  conversation asks for none of that, and a Box reads the branching model from the config and every tracker
  fact from those two files. Ask the operator for no key the § Configuration reference omits, either: that
  table is the closed set of questions, and a key absent from it is a key nothing reads. It bounds what this
  conversation **asks**, not what the run writes: `project.repo_layout` and the Step-4 capability results are
  written without being asked, and each has its row.

Merge in one order — defaults, then what is on disk, then this run's answers — key by key, deeply, so a
run with one changed answer preserves every other value, including keys this Plugin never asked about. Emit
YAML, creating `.archon/` when it does not exist, and keep comments and key order stable across runs: a
human reads this file. Keep the path as `CONFIG_PATH`.

### The tracker contract

Two files: `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`. Every Box reads a tracker
fact from these and from nothing else. § **The tracker contract** in `<installPath>/README.md` states what
each file carries, the `Axis`/`Holds` columns, the rule that a row with no axis writes nothing, and a table
shape that satisfies it. Read it and follow it: those columns and their rules are stated there, and this
step does not repeat them.

Write `issue-tracker.md` from what this project answers, in these sections, and hold to one bar: **a
section earns its place only if it states a fact about this tenant.**

- **Access** — which MCP server or skill serves this tracker, and where it is registered. Name no command
  line and no flag: a server describes its own current interface, and a flag frozen here is stale the day
  the tool changes.
- **Addressing** — the coordinates a call needs. Derive them from the operator's answers, never from the
  remote URL: one remote has several spellings, and a fork clone names two repositories.
- **Work-item scope** — the one filter every search applies, where this tracker has such a thing. Say what
  goes wrong without it: a search that does not filter matches a sibling project's items, and an
  idempotency check then finds a ticket that is not this project's.
- **Operations** — written only where the server cannot supply the how. Say so when the answer is none.

Write `triage-labels.md` from `TRACKER_VOCABULARY`: propose a value for each canonical role from what the
board already uses, show the operator how often each candidate appears, and write what they confirm. Three
rules hold whatever they answer:

- The role names in the left column are this Plugin's, and the team owns every other column.
- Create nothing on the tracker. A role the board has no name for is mapped onto a name it already carries,
  or left unmapped — never answered by adding a name to someone else's board.
- `TRACKER_VOCABULARY` empty, because no tracker surface was reachable → write the file with the roles and
  an empty value column, and say plainly in it that a Box refuses to write a role until a human fills the
  column.

## Step 7 — Patch the managed blocks (**patch**)

One block in the Consumer's `CLAUDE.md`, and one more in each line-based ignore file Step 4 found. Each is
delimited by markers written in that file's own comment syntax, `unic-dlc:begin` and `unic-dlc:end`.
Rewrite the whole block between the markers, markers included, and leave everything outside them verbatim.
A marker is a line whose whole comment text is `unic-dlc:begin` or `unic-dlc:end`. Never match it as part
of a longer word, because a marker that carries another prefix belongs to another installer.

**A block under the old markers is migrated in place.** Before version 0.30.0 this Plugin wrote its blocks
between `unic-archon-dlc:begin` and `unic-archon-dlc:end`. Before you write to a file, look in it for both
marker pairs, matched as whole comment lines in the same way.

Check the malformed cases first. In each of them, write nothing to that file and report it in Step 8 as
`ACTION REQUIRED`, because a rewrite could remove the Consumer's text or leave a stray marker:

- A begin marker with no end marker of the same name after it. A begin of one name followed by an end of
  the other name counts as this case.
- An end marker with no begin marker of the same name before it, under either name.
- Two blocks under the same marker name.
- More than one begin marker, or more than one end marker, under the same name.

Then, for a well-formed file:

- A block under the new markers only → rewrite it in place.
- A block under the old markers only → replace it, from the old begin line to the old end line, with the
  block under the new markers, at the same position in the file. Report the file as migrated in Step 8.
- Both → rewrite the new block in place and remove the old block, markers included.
  Report the file in Step 8 as `patched` and `old block removed`.

Then search the repository, skipping `.git/` and `node_modules/`, for any other file that holds
`unic-archon-dlc:begin` or `unic-archon-dlc:end` as a whole comment line. Write nothing to such a file.
Report each one in Step 8 as `ACTION REQUIRED`, as a file that holds an old marker outside the files this
step patches. The operator decides what to do with it.

Absent block in a file that exists → append it. Absent file → create it, but only where this step has a
block to put in it: a tool whose exclusions live in a structured config gets no file of its own invented for
it. A re-run replaces the block in place and leaves one block per file, never two, under the new markers.
The block carries no `AUTO-GENERATED — DO NOT EDIT` banner, and it does say plainly that the next run
rewrites it — two different things, and the second is what makes an overwrite legible. What it never claims
is to be maintained: nothing here detects a hand edit between the markers.

### `CLAUDE.md`

Write exactly this, markers included, as the whole block. Every line is static:

```markdown
<!-- unic-dlc:begin -->

## unic-archon-dlc

This project is configured for `unic-archon-dlc`. `/unic-archon-dlc:setup` writes this block —
anything between the markers is replaced on the next run.

- **Configuration** — `.archon/unic-dlc.config.yaml`.
- **Tracker contract** — `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` carry every
  fact about this tracker, including which value each canonical role writes. Edit them here; nothing
  regenerates them once they exist.
- **Interactive commands** — this plugin's slash commands. Claude Code lists them in the session.
- **Archon Boxes** — the `unic-dlc-*.yaml` files in `.archon/workflows/`. List what is installed with
  `archon workflow list`; run one with `archon workflow run <name> "<slug>"`. They are generated:
  `/unic-archon-dlc:setup` replaces them on every run.
- **Methods** — `.archon/methods/` is replaced wholesale on every `/unic-archon-dlc:setup` run. To change
  a Method, edit the file there and expect the next run to overwrite it.
- **What each box does**:
  - `unic-dlc-explore` researches a topic in parallel, writes `findings.md` for `/specs` and runs one
    spike. It is optional. It offers to keep the spike code on a branch only when `gates.explore` is
    `hitl`.
  - `unic-dlc-build` implements each slice in `issues.json` test-first, then verifies, pushes, and
    opens a PR when the verdict is `pass`. It pauses for a human to review that PR only when
    `gates.build` is `hitl`.
  - `unic-dlc-pr-review` reviews a PR against the repository's standards and the linked work items,
    and posts the findings. It asks a human to confirm first only when `gates.pr-review` is `hitl`.
  - `unic-dlc-qa` runs the tests, e2e and coverage checks, and merges the PR only when the tests pass,
    no other check fails, and the PR is open against the right base. It asks for UAT sign-off and a
    merge confirmation only when `gates.qa` is `hitl`. It files a UAT defect as an agent-ready
    tracker item.

<!-- unic-dlc:end -->
```

The block names one command, `/unic-archon-dlc:setup`, and one hand-kept line per Box. `/setup` rewrites
the block on every run, so a Box renamed or dropped in a Plugin release reaches this repository on its
next run. A Plugin change that adds, renames or drops a Box changes that list in the same pull request.
Everything it carries is a path the reader can open, a
command they can run, or a line that says what a Box does.

### The formatter exclusions

For every tool in `FORMATTERS`, exclude three things from it:

1. `.archon/methods/`
2. `.archon/workflows/`
3. any file whose name carries `.generated.`, written in that tool's own pattern syntax.

Write the exclusions as a marked block in the tool's **line-based ignore file**, creating that file when
the project has none. Where the exclusion mechanism is a **structured config value** instead — an array in
JSON or TOML, which cannot carry a comment marker — write nothing there: print the exact entry the operator
must add, and carry it into Step 8 as an open item. Editing a value this command cannot delimit would leave
a line the next run could not tell from a hand-written one.

Open the block by saying `/setup` rewrites it, exactly as the `CLAUDE.md` block does: an ignore file belongs
to the tenant, and a tenant who edits between the markers otherwise loses the edit on the next run with
nothing on either side to warn them. Then state the reason, because the failure it prevents is silent. A formatter that reflows an
installed file raises no error and no test failure — it makes the file stop matching the release it was
copied from, and the header line is then the only provenance left. Both trees needed this and the third
entry anticipates it: a Markdown glob rewrote thirteen Method files in one run on `DXP-DesignSystem`
(2026-08-18) before anything excluded that directory; the Boxes are `.yaml`, so the same glob missed them
by luck, and the exclusion is written for the glob that grows rather than the glob measured that day.

## Step 8 — Summary

```
unic-archon-dlc installed.
  {version line — one of the three forms below}
  config:   {CONFIG_PATH}
  contract: {issue-tracker.md and triage-labels.md — written, or reported unchanged}
  archon remote: {ARCHON_REMOTE_RESOLVED} (Archon's own worktree.remote — verified, never written here)
  archon base:   {ARCHON_BASE_RESOLVED} ({source}), the $BASE_BRANCH of a dispatch without --base. {verified}never written here
  docs:     {docs.type} (publish: {docs.publish})
  design:   {design.type}
  gates:    {box}={mode} …
  methods:  {name} · {name} · … (bundle {BUNDLE_TAG})
  workflows written: {path} · {path} · …
  workflows removed: {path} · … | none
  workflows added:   {path} · … | none
  formatters: {tool} → {ignore file patched} | {tool} → ACTION REQUIRED: {entry to add}
  blocks:   {file} → patched | migrated from unic-archon-dlc markers | old block removed | ACTION REQUIRED: {malformed markers, or an old marker outside the patched files}
```

Name **paths**, never a count alone: the point is a reviewable diff.

`ARCHON_REMOTE_RESOLVED` null → print `none resolved — Archon Boxes may need worktree.remote set manually`.

Print `{source}` as `worktree.baseBranch` when `ARCHON_BASE_CONFIGURED` is set, else as
`remote default; Archon's stored default may differ`. Print `{verified}` as `Verified, ` when the source is
`worktree.baseBranch`, and as nothing otherwise, because the remote default is only a stand-in. Wherever
this line or a warning below prints `{ARCHON_BASE_RESOLVED}`, print `none resolved` when it is empty.

This is the one place in the Plugin that maps a branching model to a run's base. `/cleanup` keeps its own
main-line hint. Set
`BRANCHING_BASE` to `develop` when `project.branching` is `gitflow`, else to `main`. Only the warnings
below read it. No Box reads it. Print each warning that applies, after the summary block. The first
warning is the main signal, because without the key the base depends on the Archon version.

- `ARCHON_BASE_CONFIGURED` is empty → print `WARNING: worktree.baseBranch is unset in .archon/config.yaml,
so every run without --base uses Archon's codebase default. The remote default is
{ARCHON_BASE_RESOLVED}, and Archon's stored default may differ. Pin the base that project.branching
implies in .archon/config.yaml.`
- `ARCHON_BASE_RESOLVED` is set and differs from `BRANCHING_BASE` → print `WARNING: Archon will use
{ARCHON_BASE_RESOLVED} as the base branch, but project.branching {branching} implies {BRANCHING_BASE}.
The Boxes follow Archon. If {BRANCHING_BASE} is the right base, set it in .archon/config.yaml.`

When at least one warning printed, print this block once after them, with the value of `BRANCHING_BASE`
in place of `<BRANCHING_BASE>`:

```text
worktree:
  baseBranch: <BRANCHING_BASE>
```

The key must sit under `worktree:`. A top-level `baseBranch:` has no reader in Archon. A run that must
target another branch for one dispatch passes `--base <branch>` and needs no change to this file.

Build the `methods:` line from `METHODS_INSTALLED`, the names Step 5 kept. Step 5 already stopped the run if
the bundle lacked a Method the dependency table names, so this line reports what landed and judges nothing.

`WORKFLOWS_ADDED` is a subset of `WORKFLOWS_WRITTEN`; a path in one and not the other was already installed
and got overwritten. `WORKFLOWS_REMOVED` holds every stale `unic-dlc-*.yaml` the sweep retired.

Build the version line in one of three forms, and compute it nowhere else:

- `PREVIOUS_VERSION` null **and** `WORKFLOWS_ADDED` as long as `WORKFLOWS_WRITTEN` — nothing was on disk to
  read a version from and every Box is new → `first install`.
- `PREVIOUS_VERSION` null and those counts differ — Boxes were installed but none names a version →
  `from: unknown`.
- `PREVIOUS_VERSION` holds more than one version — the Boxes on disk disagreed, so the prior install was
  partial → `from: a partial install of {v} and {v} → {PLUGIN_VERSION}`. Name the partial state in words: a
  bare list reads as a range and hides the one thing the operator needs to know.
- Otherwise `from: {PREVIOUS_VERSION} → {PLUGIN_VERSION}`, both printed even when equal: a re-run at the
  same version is a fact worth showing.

The line is informational and gates nothing. Step 5 runs unattended on the upgrade path, so it never
becomes a prompt.

Close with three things. Every `ACTION REQUIRED` entry, from the formatters or the blocks. These are the
open items that outlive a successful run. Then: **commit what this run wrote.** The installed trees are committed generated files — that is what gives a Plugin upgrade a
diff and a reviewer, and what makes an operator's edit to a Box legible as a `git diff` after the next run.
This command stages nothing itself. And: **re-run `/unic-archon-dlc:setup` after updating the plugin.** It
refreshes the Boxes and the Methods and leaves every tenant-owned file alone.
