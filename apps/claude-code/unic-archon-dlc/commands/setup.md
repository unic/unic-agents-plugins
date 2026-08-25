---
allowed-tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']
argument-hint: '[reconfigure | <free-form intent>]'
description: 'Install unic-archon-dlc into this project: copy the Boxes and the Methods, write the config and the tracker contract, and patch the managed blocks'
---

# unic-archon-dlc:setup

> Design rationale: [ADR-0019 — Conversational `/setup`](docs/adr/0019-conversational-setup.md);
> [ADR-0036 — `/setup` owns a named install set](docs/adr/0036-setup-owns-a-named-install-set.md) for what
> it owns and how it replaces it; [ADR-0016 — a thin process layer](docs/adr/0016-dlc-thin-process-layer.md)
> for why this command reads the project instead of holding a list of tools.

**Arguments:** "$ARGUMENTS"

`/setup` is this Plugin's installer and its sole configuration entry point. It is prose: do every action
below with your own tools — Read, Write, Edit, Glob, Grep and Bash. Import nothing, shell out to no Node
script, and do not read `$CLAUDE_PLUGIN_ROOT`: an installed Plugin ships no `node_modules`, and that
variable is not set inside the Bash tool ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5).

## What `/setup` owns, and what it only visits

Six actions land four kinds of artefact, and **ownership decides the treatment**. Three treatments, and
every action below names which one it takes:

| Treatment   | Applies to                                   | Behaviour on a re-run                                                              |
| ----------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| **replace** | a whole tree the Plugin owns                 | overwritten silently, every run                                                    |
| **refuse**  | a file the tenant owns                       | read it, report what differs from what this run would write, change nothing        |
| **patch**   | a marked block inside a file the tenant owns | the block is rewritten between its markers; everything outside them stays verbatim |

**refuse** has one override: the `reconfigure` argument (Step 3). Nothing else rewrites a tenant file.

## Step 1 — Preflight

Two checks, in this order. Each one stops the run when it fails, before any question is asked and before
anything is written.

**Archon.** Run `archon --version`. This Plugin's floor is **`0.7.0`** — the version whose schema carries
gates, loops, `context: fresh`, `evidence_policy` and `always_run`
([ADR-0033](docs/adr/0033-archon-070-schema-target.md)). Compare the three numbers, never the raw strings:
the output may carry a program name or a `v` prefix. Command not found, or a version below the floor →
print what you saw with both versions and stop.

**This Plugin's own installed directory.** Steps 5 and 6 copy files out of it, so find it now. Claude Code
keeps a registry at `~/.claude/plugins/installed_plugins.json`; read it and take the entry keyed
`unic-archon-dlc@<marketplace>`. Each entry carries `scope`, `installPath`, `version` and — for a
project-scope install — the `projectPath` it belongs to. Pick the entry whose `projectPath` is this
repository's root, else the `user`-scope entry. `installPath` is the directory.

Then verify it before trusting it, and keep `PLUGIN_VERSION` from the manifest you read:

1. `.claude-plugin/plugin.json` there names `unic-archon-dlc`, at the same version as the registry entry.
2. `vendor/mattpocock-skills/` is present.
3. `.archon/workflows/` holds at least one `unic-dlc-*.yaml`.

Print what you found and stop on any of: no entry for this Plugin, a registry whose top-level `version` is
not `2`, a failed check above, or a version that disagrees with the copy of this file you are running from.
**Take the path from the registry alone.** The version cache holds one directory per version ever
installed — nine of them on the machine this was written on — so a search of that cache is a guess among
candidates, and an install that copies from the wrong version is worse than no install.

## Step 2 — Read the project

Four reads, all verify-only. Nothing here writes.

**The config.** Read `.archon/unic-dlc.config.yaml` and keep the parsed object as `CURRENT`. Present but
unreadable → print the parse error and stop, rather than overwrite the only copy. Absent → `CURRENT` is
null.

A `.archon/unic-dlc.config.json` also stops the run: report the path, say that it is the flat shape an
earlier version of this Plugin wrote and that no migration ships any more, and change nothing. That
migration had never been walked by a real project when it was removed, and reading such a file as "no
config" would write a second config beside it.

**The git remotes.** Run `git remote`. Three refusals, in this order:

- `git` is not on `PATH` → print `git binary not found on PATH. Install git before running /setup.` and stop.
- the command failed otherwise → print the error, ask the operator to confirm this directory is a git
  repository, and stop.
- the list is empty → print `This project has no git remote configured. Every Archon Box derives its target repository from a remote and cannot run without one. Add one — e.g. git remote add origin <url> — and re-run /setup.` and stop.

Then run `git remote get-url origin` and keep it as `GIT_REMOTE`. An absent `origin` is an empty value
here, not a refusal.

**Archon's own config, verify-only.** Read `.archon/config.yaml` — **Archon's** file, which this Plugin
never writes. Resolve the remote the way Archon does and keep it as `ARCHON_REMOTE_RESOLVED`: its
`worktree.remote` key when set, else `origin` when a remote of that name exists, else the sole remote when
there is exactly one, else nothing. On Archon `0.7.0` that key governs base-branch resolution only — the
workspace path still derives from `origin` — so report it in Step 8 and write it nowhere.

**The repo layout.** Keep `REPO_LAYOUT`: `multi-context` when this repository holds more than one
independently-releasable project (a `packages/` or `apps/` tree with its own manifests), otherwise
`single-context`. Never ask for it.

Then set `STATE`: `fresh` when `CURRENT` is null, `partial` when `CURRENT` exists with `project.branching`
unset, `full` otherwise. `project.branching` is the one key a config needs before the Boxes can read it;
every other key has a default, named in the § Configuration reference in [README.md](../README.md).

## Step 3 — Read the arguments

- empty or whitespace → `MODE = 'default'`
- trimmed lowercase `reconfigure` → `MODE = 'reconfigure'`
- anything else → `MODE = 'intent'`, `INTENT = $ARGUMENTS`

`reconfigure` is the **refuse** override, and the only one. Under it, a tenant-owned file this run would
write differently is offered to the operator: show what would change, ask about that file, and write only
what they confirm. It is how a wrong first answer gets corrected — without it the only remedy is deleting
a file.

Steps 5 and 6 run under every mode, including `full` + `default`. They are how a Plugin upgrade lands, and
they need no answers: that is why they come before the conversation, and why a re-run needs no argument to
refresh what this Plugin owns.

## Step 4 — Discover what this project has

Three sweeps. All verify-only — introspect, install nothing.

**Capabilities.** Build a capability → tool registry the Boxes read (`mcp | cli | skill`, MCP-first). Note
which relevant MCP servers this session has for the tracker, the docs system and the design system. Probe
CLIs portably, without `jq`, `awk` or `sort`, and record which succeed. A missing capability **warns and
degrades**: finish the run, record it unavailable, and list the Boxes it blocks — they re-probe at runtime
and fail with their own message. Never abort the run for a missing capability.

Do not probe for the Methods here. They ship inside this Plugin and Step 5 installs them; their presence
is bundle integrity, not discovery. Which Method each Box reads is recorded once, in
[README.md § Dependencies](../README.md#dependencies).

**The toolchain that formats or lints.** Step 7 excludes this Plugin's own artefacts from it, so find it
now: read the manifests, task files and scripts this project actually runs — whatever the language — and
list every tool that formats or lints, together with the paths each one reaches. For each tool, find how it
excludes a path, from that tool's own current documentation. Where the mechanism is unclear, ask the
operator which file to patch rather than write to a guess. Keep the result as `FORMATTERS`: per tool, the
exclusion mechanism, and whether that mechanism is a **line-based ignore file** or a structured config
value.

Read what the project runs, never a list held here: this Plugin knows that an installed file must not be
reformatted, and nothing about which tool does the reformatting.

**The tracker's own vocabulary.** Step 6 writes the tracker contract, and its values have to be names the
board already carries. Through whichever tracker surface Step 4 found, read what this tracker actually uses
— its states, its tags or labels, its work-item types, and how often each appears. Keep it as
`TRACKER_VOCABULARY`. No access yet → keep it empty; Step 6 handles that case.

## Step 5 — Install the Boxes and the Methods (**replace**)

Both trees come out of the directory Step 1 verified. This is the **replace** treatment: overwrite
silently, every run. Every installed file's header names this Plugin and its version and says that
`/setup` rewrites it, which is what makes an overwrite legible — an operator's edit shows up as a tracked
`git diff` after a run, not as a warning dialog ([ADR-0036](docs/adr/0036-setup-owns-a-named-install-set.md) D3).

**The Methods.** Verify the bundle at `vendor/mattpocock-skills/`, then copy it into `.archon/methods/` —
the one path every Box and command reads a Method from.

- Every Method directory carries a `SKILL.md`. Verify companions **by reading**: open each `SKILL.md` and
  confirm every companion file it points at sits beside it. A Method referencing none needs none — several
  correctly ship one file, so a file count is not the test. A companion the text points at and the
  directory lacks is a Method pointing at nothing: report it and stop.
- `vendor/mattpocock-skills/LICENSE` must be present. Absent → ask the maintainer to restore it and stop.
  **Never create a `LICENSE` file.**
- `vendor/mattpocock-skills/README.md` records the upstream repository, tag and commit this bundle was
  copied from. Read it and keep the tag as `BUNDLE_TAG`.
- Copy clean: replace `.archon/methods/` wholesale, so a Method dropped from a later Plugin version cannot
  linger.
- Stamp no header on a Method file. The bundle is upstream text pinned to one tag, and a line added at the
  top forks it from that tag — which is the fork Step 7 exists to prevent. `BUNDLE_TAG` in Step 8 and the
  version on the Boxes carry the provenance for this tree.
- Two override paths an earlier version offered now resolve nothing, because `.archon/methods/` is the only
  path anything reads. Report each one you find, once, as retired, and change neither — both are the team's
  own work: a `.archon/methods.local/` directory, and any `methods.<name>.source` key in the config.

**The Boxes.** Install every `unic-dlc-*.yaml` this Plugin ships into `.archon/workflows/`, discovered by
reading the Plugin's own `.archon/workflows/` — no Box name is a literal in this file.

Install is **name-scoped, never a whole-directory replace**: `.archon/workflows/` is shared with the
Consumer's own workflows, so only names matching `unic-dlc-*.yaml` are read, written, overwritten or swept.
A file named outside that pattern stays untouched whatever it contains — that is what makes the variant
escape hatch in [README.md](../README.md) true. The sweep retires a `unic-dlc-*.yaml` this Plugin version
no longer ships, whether or not it carries the header: ownership is decided by name alone.

Before overwriting, read the first line of each `unic-dlc-*.yaml` already on disk and keep the version it
names as `PREVIOUS_VERSION`. Then write each Box with this line first, `PLUGIN_VERSION` filled in:

```yaml
# Generated by unic-archon-dlc <PLUGIN_VERSION> — /unic-archon-dlc:setup rewrites this file on every run.
```

Match that line as a **prefix of the first line**, never as a search over the whole file: a Consumer file
that mentions the marker text further down is not a file this command wrote. `PREVIOUS_VERSION` is empty on
a fresh project and on a Box carrying no such line.

`/setup` writes nothing into `.archon/commands/`. The Box command docs live at `docs/boxes/` in this
Plugin's own repository, as operator documentation.

Keep `WORKFLOWS_WRITTEN`, `WORKFLOWS_ADDED` and `WORKFLOWS_DELETED` for Step 8.

**Any failure in this step stops the run.** A missing licence, an incomplete bundle, a copy that could not
be written, a stale Box that could not be removed — each means the shipped Plugin is incomplete or the disk
refused a write, and none is fixed by re-running an earlier step. Say how much landed, and that a bare
re-run of `/setup` self-heals because it replaces the affected tree. Report success only when no stale Box
is left on disk.

## Step 6 — Write the config and the tracker contract (**refuse**)

Three tenant-owned files. Each one is written when it is absent. When it is present, read it, report what
differs from what this run would write, and change nothing — unless `MODE = 'reconfigure'`, which offers
the change per file (Step 3).

### The config

Collect only the gaps, conversationally, then write `.archon/unic-dlc.config.yaml`.

Which gaps: `STATE = 'fresh'` → every field; `STATE = 'partial'` → the missing ones;
`MODE = 'reconfigure'` → every field; `MODE = 'intent'` → the missing ones first, then read `INTENT` to
decide which already-set fields to revisit. Surface `GIT_REMOTE` as a hint while asking. Pass `REPO_LAYOUT`
through without asking.

The fields, mapped onto the schema paths in the § Configuration reference in [README.md](../README.md),
which is the single source of truth for every default:

- **project** — `project.name`; `project.branching` (`gitflow | github-flow`, mandatory);
  `project.repo_layout` = `REPO_LAYOUT`.
- **docs** — `docs.type`: ask where the team's product specs live and write the answer through. It is a
  format or the name of a docs system, or `none`. `docs.publish` (default `false`, opt-in).
- **design** — `design.type`: ask which design system the team designs in and write the answer through, or
  `none`.
- **gates** — per Archon Box: `hitl` (default) or `afk`. Interactive commands are always HITL and are not
  listed.
- **build** — `build.e2e_command`, `build.coverage_threshold`, both optional.
- **estimations**, **model_profile** — defaults unless the operator asks.
- The Step-4 capability results under `docs.access` and `design.access`.

Two rules about what this conversation leaves alone:

- **Ask for no tool name as a closed choice.** `docs.type` and `design.type` take whatever the team says.
  No Box compares either value to a literal — each tests set-versus-`none`, and `design.access.mcp`
  resolves the actual tool — so a list of accepted names here would only be a list to fall behind.
- **The config holds no tracker fact.** The contract files below carry all of them — which surface serves
  this tracker, the coordinates a call needs, and which value each canonical role writes. So the config
  conversation asks for none of that, and a Box reads the branching model from the config and every tracker
  fact from those two files. `project.repo_ref` is asked for only when the operator names it: every Box
  derives its target repository from the worktree's `origin`, and that key is the override for the one case
  derivation cannot settle — a fork checkout whose parent differs from `origin`.

Merge in one order — defaults, then what is on disk, then this run's answers — key by key, deeply, so a
run with one changed answer preserves every other value, including keys this Plugin never asked about. Emit
YAML, creating `.archon/` when it does not exist, and keep comments and key order stable across runs: a
human reads this file. Keep the path as `CONFIG_PATH`.

### The tracker contract

Two files: `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`. Every Box reads a tracker
fact from these and from nothing else. § **The tracker contract** in [README.md](../README.md) states what
each file carries, the `Axis`/`Holds` columns, the rule that a row with no axis writes nothing, and a table
shape that satisfies it. Read it and follow it; restate none of it here.

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

Two blocks in two tenant-owned files. Each is delimited by markers written in that file's own comment
syntax, `unic-archon-dlc:begin` and `unic-archon-dlc:end`. Rewrite the whole block between the markers,
markers included, and leave everything outside them verbatim. Absent file or absent block → create it. A
re-run replaces the block in place and never appends a second one. The block carries no
`AUTO-GENERATED` banner and presents itself as no managed document: nothing here detects a hand edit
between the markers.

### `CLAUDE.md`

Write exactly this, markers included, as the whole block. Every line is static:

```markdown
<!-- unic-archon-dlc:begin -->

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
- **What each box does** —
  <https://github.com/unic/unic-agents-plugins/blob/main/apps/claude-code/unic-archon-dlc/README.md>

<!-- unic-archon-dlc:end -->
```

The block names one command, `/unic-archon-dlc:setup`, and no pipeline stage: a Plugin release renames and
reorders both without touching this repository. Everything it carries is a path the reader can open, a
command they can run, or a link.

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

State the reason in the block, because the failure it prevents is silent. A formatter that reflows an
installed file raises no error and no test failure — it makes the file stop matching the release it was
copied from, and the header line is then the only provenance left. Both trees needed this and the third
entry anticipates it: a Markdown glob rewrote thirteen Method files in one run on `DXP-DesignSystem`
(2026-08-18) before anything excluded that directory; the Boxes are `.yaml`, so the same glob missed them
by luck, and the exclusion is written for the glob that grows rather than the glob measured that day.

## Step 8 — Summary

```
unic-archon-dlc installed.
  from: {PREVIOUS_VERSION} → {PLUGIN_VERSION}
  config:   {CONFIG_PATH}
  contract: {issue-tracker.md and triage-labels.md — written, or reported unchanged}
  archon remote: {ARCHON_REMOTE_RESOLVED} (Archon's own worktree.remote — verified, never written here)
  docs:     {docs.type} (publish: {docs.publish})
  design:   {design.type}
  gates:    {box}={mode} …
  methods:  {name} · {name} · … (bundle {BUNDLE_TAG})
  workflows written: {path} · {path} · …
  workflows removed: {path} · … | none
  workflows added:   {path} · … | none
  formatters: {tool} → {ignore file patched} | {tool} → ACTION REQUIRED: {entry to add}
```

Name **paths**, never a count alone: the point is a reviewable diff.

`ARCHON_REMOTE_RESOLVED` null → print `none resolved — Archon Boxes may need worktree.remote set manually`.

`WORKFLOWS_ADDED` is a subset of `WORKFLOWS_WRITTEN`; a path in one and not the other was already installed
and got overwritten. A Method that [README.md § Dependencies](../README.md#dependencies) names and Step 5
did not install is a fault: report it by name.

Build the version line in one of three forms, and compute it nowhere else:

- `PREVIOUS_VERSION` null **and** `WORKFLOWS_ADDED` as long as `WORKFLOWS_WRITTEN` — nothing was on disk to
  read a version from and every Box is new → `first install`.
- `PREVIOUS_VERSION` null and those counts differ — Boxes were installed but none names a version →
  `from: unknown`.
- Otherwise `from: {PREVIOUS_VERSION} → {PLUGIN_VERSION}`, both printed even when equal: a re-run at the
  same version is a fact worth showing.

The line is informational and gates nothing. Step 5 runs unattended on the upgrade path, so it never
becomes a prompt.

Close with the one open item that outlives a successful run — every `ACTION REQUIRED` formatter entry —
and this: **re-run `/unic-archon-dlc:setup` after updating the plugin.** It refreshes the Boxes and the
Methods and leaves every tenant-owned file alone.
