---
allowed-tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob']
argument-hint: '[reconfigure | <free-form intent>]'
description: 'Configure unic-archon-dlc for this project: detect the stack, register the team system-skills, and write .archon/unic-dlc.config.yaml'
---

# unic-archon-dlc:setup

> Design rationale: [ADR-0019 — Conversational `/setup` + one thin tested schema lib](docs/adr/0019-conversational-setup.md) (supersedes ADR-0001); [ADR-0036 — `/setup` owns a named install set](docs/adr/0036-setup-owns-a-named-install-set.md) for Step 6's install engine.

**Arguments:** "$ARGUMENTS"

`/setup` is the **sole configuration entry point** and is **conversational**: it detects the stack, **composes the team's system-skills** to discover what the team has, and writes the rich `.archon/unic-dlc.config.yaml` — the config substrate the redesigned boxes read (each box is migrated onto it in its own redesign step; pre-redesign workflows under `.archon/workflows/` still reference the old JSON/keys until then). Merge and emit the YAML yourself, with your own tools. Conduct the conversation yourself; do not invent config keys the § Config reference in [README.md](../README.md) does not define.

Follow these steps in order. Do not skip any step. Do not write any files except through Step 5 (config), Step 6 (Methods bundle), and Step 7 (CLAUDE.md block).

## Step 1 — Archon preflight (behavioural `≥ 0.7.0`)

Run:

```bash
archon --version
```

Read the output yourself. This Plugin's floor is **Archon `0.7.0`** — the version the key-discriminated
schema needs: gates, loops, `context: fresh`, `evidence_policy` and `always_run`
([ADR-0033](docs/adr/0033-archon-070-schema-target.md)). If the command is not found, or the installed
version is below `0.7.0`, print what you saw with both versions and stop — do not proceed. Compare the
three numbers, never the raw strings: the output may carry a program name or a `v` prefix.

## Step 2 — Discover current config state

Read the current state with your own tools. Do not shell out to Node, do not import a Plugin module,
and do not read `$CLAUDE_PLUGIN_ROOT`: an installed Plugin ships no `node_modules`, and that variable is
not set inside the Bash tool ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5).

1. **The config.** Read `.archon/unic-dlc.config.yaml`. If it is absent, read
   `.archon/unic-dlc.config.json` instead — a legacy flat config from ADR-0001, which this run
   migrates into the rich nested shape and **never deletes or modifies**. If the file that exists is
   present but unreadable, print the parse error and stop: refuse to overwrite a config you could not
   read. Keep the path you read as `CONFIG_PATH`, and the parsed object as `CURRENT`.

2. **The remotes.** Run `git remote`. Three refusals, in this order:

   - `git` is not on `PATH` → print `git binary not found on PATH. Install git before running /setup.`
     and stop.
   - the command failed for any other reason → print the error, ask the operator to confirm this
     directory is a git repository, and stop.
   - the list is empty → print `This project has no git remote configured. All four Archon Boxes
(/build, /qa, /pr-review, /explore) derive their target repository from a remote and cannot run
without one. Add one — e.g. git remote add origin <url> — and re-run /setup.` and stop.

   Then run `git remote get-url origin` and keep the result as `GIT_REMOTE`; an absent `origin` is not
   a refusal here, only an empty value.

3. **Archon's own remote, verify-only.** Read `.archon/config.yaml` — **Archon's** file, a different
   file from ours, which this Plugin never writes. Resolve the remote the way Archon does and keep it
   as `ARCHON_REMOTE_RESOLVED`: its `worktree.remote` key when set, else `origin` when a remote of that
   name exists, else the sole remote when there is exactly one, else nothing. Step 8 reports this; no
   step writes it.

4. **The repo layout.** Read the working tree and keep `REPO_LAYOUT`: `multi-context` when the
   repository holds more than one independently-releasable project (a `packages/` or `apps/` tree with
   its own manifests), otherwise `single-context`.

Then determine `STATE`:

- `CURRENT` is null → `STATE = 'fresh'`
- `CURRENT` exists but `project.branching` is unset → `STATE = 'partial'`
- Otherwise → `STATE = 'full'`

`project.branching` is the one key a config needs before the Boxes can read it. Every other key has a
default, named in the § Config reference in [README.md](../README.md).

## Step 3 — Verify-only skill discovery (never installs)

Build a **capability → tool** registry the downstream boxes read (`mcp | cli | skill`, **MCP-first**). Discovery is **verify-only**: introspect what is installed; never install anything.

- **MCP servers**: note which relevant MCP servers are available in this session (tracker, docs, design — e.g. a GitHub/ADO/Jira MCP, a Confluence MCP, the Figma MCP).
- **CLI probes** (portable — no `jq`/`awk`/`sort`): `gh --version`, `az --version`, `jira version` (or `jira --help`), etc. Record which succeed.

Do **not** probe for Matt Pocock's skills here. The Methods the Boxes compose ship with this Plugin and are installed by Step 6; their availability is a Bundle-integrity question, not a discovery one. Which Method each Box reads is recorded once, in the table under [README.md § Dependencies](../README.md#dependencies) — never restate that list here.

For each capability pick the tool MCP-first, else CLI, else skill. A **missing _required_ capability → warn + degrade, non-blocking**: complete setup, record it unavailable in the config, and **list the boxes it blocks** (boxes re-probe at runtime and fail with a clear "install X"). Never abort setup for a missing capability.

## Step 4 — Parse arguments, then collect only the gaps conversationally

Arguments: `$ARGUMENTS`

- Empty/whitespace → `MODE = 'default'`
- Trimmed lowercase equals `reconfigure` → `MODE = 'reconfigure'`
- Otherwise → `MODE = 'intent'`, `INTENT = $ARGUMENTS`

If `STATE = 'full'` and `MODE = 'default'`, skip Step 5 (do not rewrite the config) but **still run Step 6**, then print the Step 8 summary and stop — tell the user to run `/unic-archon-dlc:setup reconfigure` to change settings. Step 6 is how a plugin upgrade lands a new Methods bundle, and it is idempotent: it writes only the generated `.archon/methods/` tree. Skipping it here would leave every already-configured project stuck on the bundle it first installed. Exception: if `LEGACY` is true, proceed through Step 5 to migrate even in this case (a rich `.yaml` does not yet exist).

Otherwise collect the fields to fill:

- `STATE = 'fresh'` → collect all mandatory fields + the optional ones below.
- `STATE = 'partial'` (default) → collect only `MISSING` fields.
- `MODE = 'reconfigure'` → collect all fields.
- `MODE = 'intent'` → collect `MISSING` first, then interpret `INTENT` to decide which already-set field(s) to also update.

Surface auto-detected hints while asking: `GIT_REMOTE` contains `github.com` → suggest `tracker.type = github`; `dev.azure.com`/`visualstudio.com` → `ado`. Always pass `REPO_LAYOUT` through (never ask).

Fields (map answers onto the schema paths — see `docs/adr/0018-generic-core-config-compose.md`):

- **project** — `project.name`, `project.branching` (`gitflow | github-flow`), `project.pr_strategy` (`merge | squash | rebase`). _(mandatory: branching, pr_strategy)_ Do **not** ask for `project.repo_ref` and do not write it: every box derives the target repository from the worktree's `origin` remote. It is an optional override for the one case that derivation cannot settle — a fork checkout whose parent differs from `origin`, where a box cancels rather than guess. Write it only if the user asks for it by name.
- **tracker** — `tracker.type` (`github | ado | jira | local-markdown`) _(mandatory)_; `tracker.coords` (e.g. `{owner, repo}` for github, `{org, project, repo}` for ado); `tracker.access` filled from Step 3 (`{mcp, cli}`).
- **docs** — `docs.type` (`confluence | markdown | none`) — where the team's **product specs** live; `docs.publish` (default `false`, opt-in). `docs.access` from Step 3.
- **design** — `design.type` (`figma | none`), `design.access` from Step 3.
- **classification** — `classification.labels` _(mandatory)_, the Canonical role → Label string
  mapping every Box resolves a role through. Ask **one** question. Show the three tables below as they
  stand — the right-hand column is what this Plugin offers, not what it writes on the team's behalf —
  and ask "Keep these? (recommended: yes)". On **yes**, write all seventeen entries explicitly. On
  **no**, take an override only for the rows the team renames; every other row keeps the string shown.
  Any entry in `MISSING` that starts with `classification.labels` selects this field, so a config
  written before a role existed asks for that role too; pre-fill every row that `CURRENT` already maps
  with the team's own string, and write the full seventeen back, so an override is never dropped by a
  partial re-run. Do **not** probe the tracker for its labels, do **not** create one, and do **not**
  report which are absent: a tracker with a different vocabulary is answered by mapping the role onto
  a string it already carries, not by adding a seventeenth label to someone else's board. The tier a
  row sits in is what tells a composed tracker skill which axis to write, so the team owns the
  right-hand column and never the left ([ADR-0024](../docs/adr/0024-triage-intake-on-ramp.md)).

  | `state` role      | Label string      | what it means                                          |
  | ----------------- | ----------------- | ------------------------------------------------------ |
  | `needs-triage`    | `needs-triage`    | Filed, not yet evaluated                               |
  | `needs-info`      | `needs-info`      | Waiting on the reporter for detail                     |
  | `needs-specs`     | `needs-specs`     | A valid idea, not yet decomposed — routes to `/specs`  |
  | `ready-for-agent` | `ready-for-agent` | Fully specified — an AFK agent can take it             |
  | `ready-for-human` | `ready-for-human` | Needs a human — a design call, or it reproduces poorly |
  | `resolved`        | `resolved`        | Implemented, awaiting the merge                        |
  | `closed`          | `closed`          | Merged, or already covered                             |
  | `rejected`        | `rejected`        | Will not be actioned                                   |

  | `type` role | Label string | what it means                             |
  | ----------- | ------------ | ----------------------------------------- |
  | `feature`   | `feature`    | New capability                            |
  | `bug`       | `bug`        | Something that should work does not       |
  | `spike`     | `spike`      | Time-boxed research                       |
  | `tech-debt` | `tech-debt`  | Cleanup, no user-visible behaviour change |
  | `docs`      | `docs`       | Documentation only                        |

  | `priority` role | Label string | what it means   |
  | --------------- | ------------ | --------------- |
  | `p0`            | `p0`         | Drop everything |
  | `p1`            | `p1`         | High — next up  |
  | `p2`            | `p2`         | Normal          |
  | `p3`            | `p3`         | Low — whenever  |

- **gates** — per Archon box (`build`, `qa`, `pr-review`, `explore`): `hitl` (default) or `afk`. Interactive skill boxes are always HITL and are not listed here.
- **build** — `build.e2e_command` (optional), `build.coverage_threshold` (optional). Leave `build.fresh_context_red_green`, `tdd_mode`, `nyquist_validation`, `slopsquatting_gate` at their defaults unless the user asks.
- **estimations** — `off | provisional | definitive | both` (default `off`).
- **model_profile** — `fast | balanced | max` (default `balanced`).

Build a single `ANSWERS` object containing **only** the fields you collected, keyed by the nested schema paths above, plus:

- `project.repo_layout` = `REPO_LAYOUT`,
- the Step-3 discovery results under `tracker.access` / `docs.access` / `design.access`.

## Step 5 — Write the config

Write `.archon/unic-dlc.config.yaml` with your own tools. Merge in this order — **defaults, then what
is on disk, then this run's answers** — key by key, deeply, so a re-run with one changed answer
preserves every other value:

1. Start from `CURRENT` as Step 2 read it. When Step 2 read a legacy flat `.json`, migrate it first:
   move each flat key under the nested key that now holds it, and **preserve every hand-added value**
   the team put there, including labels this Plugin never asked for.
2. Apply `ANSWERS` over it. An answer the operator did not give leaves the existing value alone; it
   never resets it to a default.
3. Emit YAML and write it to `.archon/unic-dlc.config.yaml`, creating `.archon/` when it does not
   exist. Keep comments and key order stable across runs where you can — this file is read by humans.

Two refusals. A config that is present but unreadable stops this step — print the parse error and
change nothing, because overwriting it would destroy the only copy. And a legacy `.archon/unic-dlc.config.json`
is **left exactly where it is**: other tools may still read it, so report that you kept it and never
delete it.

Note the path you wrote as `CONFIG_PATH` for the Step 8 summary.

## Step 6 — Install the Methods and the Box workflows

This step copies files **out of this Plugin's own installed directory**, so it is the one step that
needs to know where that is. Find it yourself: the directory holds `vendor/mattpocock-skills/`,
`.archon/workflows/unic-dlc-*.yaml` and `.claude-plugin/plugin.json`. A marketplace install puts it
under `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, one directory per installed version
— take the version that matches `.claude-plugin/plugin.json` in the copy you are running from. Confirm
the path with the operator before copying anything, and if you cannot find it, say so and **stop**
rather than guessing: an install that copies from the wrong version is worse than no install.

Read `version` from that directory's `.claude-plugin/plugin.json` and keep it as `PLUGIN_VERSION`.

**The Methods.** The Methods the Boxes compose ship inside this Plugin at `vendor/mattpocock-skills/`.
Verify that bundle, then copy it into `.archon/methods/` — the one path every Box and command reads a
Method from.

- Every Method directory in the bundle carries a `SKILL.md`, plus the companion files that Method reads
  (`tdd` reads `tests.md`; `triage` reads `AGENT-BRIEF.md` and `OUT-OF-SCOPE.md`). A directory holding
  a `SKILL.md` and nothing else is a Method whose own cross-references point at nothing — report it and
  stop.
- `vendor/mattpocock-skills/LICENSE` must be present. If it is absent, ask the maintainer to restore it
  and stop: **never create a `LICENSE` file yourself.**
- `vendor/mattpocock-skills/README.md` records the upstream repository, tag and commit the bundle was
  copied from. Read it and keep the tag as `BUNDLE_TAG`.
- Copy clean: replace `.archon/methods/` wholesale, so a Method dropped from a later Plugin version
  cannot linger.
- A `.archon/methods.local/` directory left by an earlier version now resolves nothing: `.archon/methods/`
  is the only path a Box or a command reads. Report it once as retired and **leave it on disk** — it is
  the operator's own work, and deleting it is not this step's call.

**The Box workflows.** Install every `unic-dlc-*.yaml` this Plugin ships into the Consumer's
`.archon/workflows/`, discovered by reading this Plugin's own `.archon/workflows/` — no Box name is a
literal anywhere in the install path. This is **name-scoped, never a whole-directory clean-replace**:
`.archon/workflows/` is shared with the Consumer's own workflows, so only names matching the
`unic-dlc-*.yaml` naming are ever written, overwritten, or swept as stale — including a Box retired
from a later Plugin version, which is deleted **regardless of whether it carries the generated
header**. A file named outside that pattern is never inspected, whatever it contains — that is what
makes the variant escape hatch (README.md) true. `/setup` writes nothing into `.archon/commands/`; the
Box command stubs live at `docs/boxes/` as operator documentation, not runtime artefacts.

Before overwriting, read the version out of the generated header of each `unic-dlc-*.yaml` already on
disk and keep the one you find as `PREVIOUS_VERSION` — the version that wrote the Boxes now being
replaced. It is empty on a fresh Consumer, and on a Box carrying no readable header.

Keep `WORKFLOWS_WRITTEN`, `WORKFLOWS_DELETED` and `WORKFLOWS_ADDED` for the Step 8 summary.

**Any failure here stops the whole setup run.** A missing licence, an incomplete bundle, a copy that
could not be written, a stale `unic-dlc-*.yaml` that could not be removed — each means the shipped
Plugin is incomplete or the disk refused a write, and none of them is fixed by re-running the earlier
steps. Say how much landed before the failure and that a bare re-run of `/setup` self-heals, because it
clean-replaces the affected tree. Never report success while a stale Box is still on disk.

## Step 7 — Refresh the `CLAUDE.md` marker block (idempotent)

Write/refresh the block in the consumer's `CLAUDE.md`, delimited by `<!-- unic-archon-dlc:begin -->` / `<!-- unic-archon-dlc:end -->`. Replace the whole marker-delimited block, **markers included**, and preserve everything outside it verbatim; if the file or block is absent, create it. This runs regardless of `docs.type`.

The block describes what this run installed on the consumer's own disk, and nothing about this Plugin's own shape: it names no pipeline stage, and no Box but `/unic-archon-dlc:setup` itself — it cannot say what regenerates the block without naming it — because a Plugin release renames, reorders and drops both without touching the consumer's repo. Everything it carries is instead a path the reader can open, a command they can run, or a link. It also carries one sentence naming `classification.labels` as the Canonical role → tracker Label string mapping this project answered during setup, and pointing at `/unic-archon-dlc:setup reconfigure` as the way to review or change it — this block is the only surface that ships into a Consumer's repo, so without that sentence the seventeen lines in the config have no thread to pull.

Write exactly this, markers included, as the whole block. Every line is static; fill nothing in:

```markdown
<!-- unic-archon-dlc:begin -->

## unic-archon-dlc

This project is configured for `unic-archon-dlc`. `/unic-archon-dlc:setup` writes this block —
anything between the markers is replaced on the next run.

- **Configuration** — `.archon/unic-dlc.config.yaml`. Its `classification.labels` map is the
  Canonical role → tracker Label string mapping every Box resolves a role through. Run
  `/unic-archon-dlc:setup reconfigure` to review or change it.
- **Interactive boxes** — this plugin's slash commands. Claude Code lists them in the session.
- **Archon Boxes** — the `unic-dlc-*.yaml` files in `.archon/workflows/`. List what is installed here
  with `archon workflow list`; run one with `archon workflow run <name> "<slug>"`. They are
  generated: `/unic-archon-dlc:setup` replaces them on every run.
- **Methods** — `.archon/methods/` is replaced wholesale on every `/unic-archon-dlc:setup` run. To
  change a Method, edit the file there and expect the next run to overwrite it.
- **What each box does** —
  <https://github.com/unic/unic-agents-plugins/blob/main/apps/claude-code/unic-archon-dlc/README.md>

<!-- unic-archon-dlc:end -->
```

Keep the edit idempotent: re-running `/setup` replaces the block in place, never appends a second one.

## Step 8 — Summary

Print a concise summary. List the Methods installed, and the Bundle tag they came from:

```
unic-archon-dlc configured.
  upgraded from: {PREVIOUS_VERSION} → {PLUGIN_VERSION}
  config:   {configPath}
  archon remote: {ARCHON_REMOTE_RESOLVED} (Archon's own worktree.remote — verified, never written by this plugin)
  tracker:  {tracker.type} (access: {mcp|cli})
  docs:     {docs.type} (publish: {docs.publish})
  gates:    build={…} qa={…} pr-review={…} explore={…}
  methods:  {name} · {name} · … (bundle {BUNDLE_TAG})
  workflows written: {path} · {path} · …
  workflows removed: none
  workflows added: {path} · {path} · …
```

Fill `{configPath}` from `configPath` (Step 5's output) or, when Step 5 was skipped, from `CONFIG_PATH` (Step 2's output).

Fill the `archon remote:` line from `ARCHON_REMOTE_RESOLVED`. When it is null, print `none resolved — Archon Boxes may need worktree.remote set manually` instead of a remote name.

Build the `methods:` line from the directories Step 6 copied into `.archon/methods/`, `·`-separated, with `BUNDLE_TAG` in brackets. A Method the table under [README.md § Dependencies](../README.md#dependencies) names and Step 6 did not install is a fault worth reporting by name.

Build the `workflows written:` line from `WORKFLOWS_WRITTEN` — every path this run wrote into `.archon/workflows/`, `·`-separated. Build `workflows removed:` from `WORKFLOWS_DELETED` — `none` when it is empty, otherwise every stale `unic-dlc-*.yaml` path this run swept because the current Plugin version no longer ships it. Build `workflows added:` from `WORKFLOWS_ADDED` — `none` when it is empty, otherwise every path this run wrote that the Consumer did not already have, i.e. the Boxes this Plugin version brings. `WORKFLOWS_ADDED` is a subset of `WORKFLOWS_WRITTEN`; the paths in one and not the other were already installed and were overwritten. All three lists name **paths written, paths deleted and paths added**, never a count alone — the point is a reviewable diff, not a summary number.

Build the version line from `PREVIOUS_VERSION` and `PLUGIN_VERSION`, in one of three forms, and compute it nowhere else:

- `PREVIOUS_VERSION` is null **and** `WORKFLOWS_ADDED` holds as many paths as `WORKFLOWS_WRITTEN` — nothing was on disk to read a version from and every Box is new, so print `first install`.
- `PREVIOUS_VERSION` is null and that count does not match — Boxes were already installed but none names a version, so print `upgraded from: unknown`.
- Otherwise print `upgraded from: {PREVIOUS_VERSION} → {PLUGIN_VERSION}`, printing both versions even when they are equal: a re-run at the same version is a fact worth showing, not a case to special-case away.

The line is informational and gates nothing. Step 6 runs unattended on the upgrade path, so never turn it into a prompt.

Then note: **re-run `/unic-archon-dlc:setup` after updating the plugin** to pick up new config keys (the merge is idempotent — your existing values are preserved).
