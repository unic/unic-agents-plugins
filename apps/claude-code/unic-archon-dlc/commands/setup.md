---
allowed-tools: ['Bash']
argument-hint: '[reconfigure | <free-form intent>]'
description: 'Configure unic-archon-dlc for this project: detect the stack, register the team system-skills, and write .archon/unic-dlc.config.yaml'
---

# unic-archon-dlc:setup

> Design rationale: [ADR-0019 — Conversational `/setup` + one thin tested schema lib](docs/adr/0019-conversational-setup.md) (supersedes ADR-0001); [ADR-0036 — `/setup` owns a named install set](docs/adr/0036-setup-owns-a-named-install-set.md) for Step 6's install engine.

**Arguments:** "$ARGUMENTS"

`/setup` is the **sole configuration entry point** and is **conversational**: it detects the stack, **composes the team's system-skills** to discover what the team has, and writes the rich `.archon/unic-dlc.config.yaml` — the config substrate the redesigned boxes read (each box is migrated onto it in its own redesign step; pre-redesign workflows under `.archon/workflows/` still reference the old JSON/keys until then). Only one deterministic concern is delegated to tested code — schema-validate + idempotent merge + YAML emit — in `lib/config-schema.mjs`. Conduct the conversation yourself; do not invent config keys the schema doesn't define.

Follow these steps in order. Do not skip any step. Do not write any files except through Step 5 (config), Step 6 (Methods bundle), and Step 7 (CLAUDE.md block).

> **Shell requirement**: Steps 1, 2, 5, and 6 use `<<'EOJS'` heredoc syntax, which requires a POSIX-compatible shell. On Windows, run inside WSL2 or Git Bash; cmd.exe and PowerShell do not support heredocs. All filesystem work uses Node's `node:fs`/`node:path`, so paths are cross-platform.

## Step 1 — Archon preflight (behavioural `≥ 0.7.0`)

Run:

```bash
node --input-type=module <<'EOJS'
let result
try {
  const { pathToFileURL } = await import('node:url')
  const { checkArchon } = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/archon-check.mjs`).href)
  result = checkArchon()
} catch (err) {
  result = { ok: false, code: 'other', message: `Plugin load error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Parse the JSON output. If `ok` is `false`, print `message` verbatim and stop — do not proceed. (The check enforces the key-discriminated schema floor: gates, loops, `context: fresh`, `evidence_policy`, and `always_run` only run correctly on Archon `≥ 0.7.0`.)

## Step 2 — Discover current config state

Run (reads the rich `.yaml` if present, else a legacy `.json` for migration; detects git remote + repo layout):

```bash
node --input-type=module <<'EOJS'
let output
try {
  const { pathToFileURL } = await import('node:url')
  const mod = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/config-schema.mjs`).href)
  const { existsSync } = await import('node:fs')
  const { execFileSync } = await import('node:child_process')
  const { join } = await import('node:path')
  const cwd = process.cwd()

  const yamlPath = join(cwd, '.archon', 'unic-dlc.config.yaml')
  const jsonPath = join(cwd, '.archon', 'unic-dlc.config.json')
  let config = null
  let source = null
  let legacy = false
  if (existsSync(yamlPath)) {
    const r = mod.loadConfig(yamlPath)
    if ('error' in r) { output = { error: r.message }; } else { config = r.config; source = yamlPath }
  } else if (existsSync(jsonPath)) {
    const r = mod.loadConfig(jsonPath)
    if ('error' in r) { output = { error: r.message }; } else { config = r.config; source = jsonPath; legacy = mod.isLegacyConfig(r.config) }
  }

  // A repo with NO remote at all cannot run any of the four Archon Boxes — every one derives its
  // target repository from a remote. Distinct from "no `origin` specifically", which /build's own
  // bootstrap handles at run time; this is the earlier, plainer refusal at /setup itself.
  let remotes = []
  let remotesErr = null
  try {
    const list = execFileSync('git', ['remote'], { stdio: ['pipe','pipe','pipe'], timeout: 5000 }).toString().trim()
    remotes = list.length === 0 ? [] : list.split(/\r?\n/).filter(Boolean)
  } catch (err) {
    remotesErr = err
  }
  if (!output && remotesErr && remotesErr.code === 'ENOENT') {
    output = { error: 'git binary not found on PATH. Install git before running /setup.' }
  } else if (!output && remotesErr) {
    output = { error: `Failed to read git remotes: ${remotesErr.message}. Confirm this directory is a git repository, then re-run /setup.` }
  } else if (!output && remotes.length === 0) {
    output = { error: 'This project has no git remote configured. All four Archon Boxes (/build, /qa, /pr-review, /explore) derive their target repository from a remote and cannot run without one. Add one — e.g. `git remote add origin <url>` — and re-run /setup.' }
  }

  if (!output) {
    let gitRemote = null
    try { gitRemote = execFileSync('git', ['remote', 'get-url', 'origin'], { stdio: ['pipe','pipe','pipe'], timeout: 5000 }).toString().trim() } catch {}
    const repoLayout = mod.detectRepoLayout(cwd)

    // Verify-only: report whether ARCHON'S OWN .archon/config.yaml (a different file from ours)
    // resolves a remote via its `worktree.remote` key, falling back to Archon's own auto-detection
    // (origin, else the sole remote). NEVER write .archon/config.yaml — it is Archon's file.
    const archonConfigPath = join(cwd, '.archon', 'config.yaml')
    let archonConfig = null
    if (existsSync(archonConfigPath)) {
      const r = mod.loadConfig(archonConfigPath)
      if ('ok' in r) archonConfig = r.config
    }
    const archonRemoteResolved = mod.resolveArchonRemote({ remotes, archonConfig })

    // Normalise to the rich shape so validation reflects what /setup will actually write.
    const normalised = legacy ? mod.mergeConfig(mod.migrateLegacy(config)) : (config ? mod.mergeConfig(config) : null)
    const validation = normalised ? mod.validateConfig(normalised) : { error: true, missing: mod.MANDATORY_PATHS }
    output = {
      gitRemote,
      archonRemoteResolved,
      repoLayout,
      source,
      legacy,
      hasConfig: config != null,
      current: normalised,
      missing: 'error' in validation ? validation.missing : [],
    }
  }
} catch (err) {
  output = { error: `Plugin load error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(output) + '\n')
EOJS
```

Parse the output. If `error` is present, print it verbatim and stop. Otherwise set `GIT_REMOTE`, `ARCHON_REMOTE_RESOLVED` (the remote Archon's own config resolves, or null — reported by Step 8, never written by this plugin), `REPO_LAYOUT`, `LEGACY` (true = a legacy flat `.json` will be migrated), `CURRENT` (the normalised config, or null), `CONFIG_PATH` (`source`, the on-disk path read — used by Step 8 if Step 5 is skipped), and `MISSING` (mandatory paths still unset).

Determine `STATE`:

- `CURRENT` is null → `STATE = 'fresh'`
- `MISSING` is non-empty → `STATE = 'partial'`
- Otherwise → `STATE = 'full'`

## Step 3 — Verify-only skill discovery (never installs)

Build a **capability → tool** registry the downstream boxes read (`mcp | cli | skill`, **MCP-first**). Discovery is **verify-only**: introspect what is installed; never install anything.

- **MCP servers**: note which relevant MCP servers are available in this session (tracker, docs, design — e.g. a GitHub/ADO/Jira MCP, a Confluence MCP, the Figma MCP).
- **CLI probes** (portable — no `jq`/`awk`/`sort`): `gh --version`, `az --version`, `jira version` (or `jira --help`), etc. Record which succeed.

Do **not** probe for Matt Pocock's skills here. The Methods the Boxes compose ship with this Plugin and are installed by Step 6; their availability is a Bundle-integrity question, not a discovery one. Which Method each Box reads is recorded once, in [`lib/methods-manifest.mjs`](../lib/methods-manifest.mjs) and the generated table in [README.md § Dependencies](../README.md#dependencies) — never restate that list here.

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

Substitute `{ANSWERS_JSON}` with the JSON-serialised `ANSWERS` object (placed directly inside the heredoc — never via a shell variable), then run:

```bash
node --input-type=module <<'EOJS'
let result
try {
  const { pathToFileURL } = await import('node:url')
  const mod = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/config-schema.mjs`).href)
  const { existsSync, mkdirSync, writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const cwd = process.cwd()
  const answers = {ANSWERS_JSON}

  const yamlPath = join(cwd, '.archon', 'unic-dlc.config.yaml')
  const jsonPath = join(cwd, '.archon', 'unic-dlc.config.json')

  // Load whatever exists; migrate a legacy flat .json but NEVER delete or modify it.
  // A present-but-malformed config MUST fail fast — never fall back to {} and clobber it.
  let existing = {}
  let loadError = null
  if (existsSync(yamlPath)) {
    const r = mod.loadConfig(yamlPath)
    if ('error' in r) loadError = r.message
    else existing = r.config
  } else if (existsSync(jsonPath)) {
    const r = mod.loadConfig(jsonPath)
    if ('error' in r) loadError = r.message
    else existing = mod.isLegacyConfig(r.config) ? mod.migrateLegacy(r.config) : r.config
  }

  if (loadError) {
    result = { ok: false, stage: 'config', message: `Existing config is present but unreadable — refusing to overwrite it. Fix or remove the file and re-run. ${loadError}` }
  } else {
    const merged = mod.mergeConfig(existing, answers)
    const emitted = mod.toYaml(merged)
    if ('error' in emitted) {
      result = { ok: false, stage: 'validate', message: emitted.message }
    } else {
      mkdirSync(join(cwd, '.archon'), { recursive: true })
      writeFileSync(yamlPath, emitted.yaml)
      result = { ok: true, configPath: yamlPath, legacyKept: existsSync(jsonPath) ? jsonPath : null }
    }
  }
} catch (err) {
  result = { ok: false, stage: 'unexpected', message: `Unexpected error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Parse the JSON output. If `ok` is `false`, print `message` and stop. If `ok` is `true`, note `configPath` and (if present) `legacyKept` — the legacy `.json` is **left in place** because other tools may still read it.

## Step 6 — Install the Methods and the Box workflows

The Methods the Boxes compose ship inside this Plugin at `vendor/mattpocock-skills/`. This step verifies that bundle and copies it into `.archon/methods/`, the `bundle` tier `resolveMethod` reads. It **never touches `.archon/methods.local/`** — that tier is the operator's own uncommitted override.

The same step then installs every `unic-dlc-*.yaml` this Plugin ships into the Consumer's `.archon/workflows/`, discovered by reading this Plugin's own `.archon/workflows/` at install time — no Box name is a literal anywhere in the install path. This is **name-scoped**, never a whole-directory clean-replace: `.archon/workflows/` is shared with the Consumer's own workflows, so only names matching the `unic-dlc-*.yaml` naming are ever written, overwritten, or swept as stale — including a Box retired from a later Plugin version, which is deleted **regardless of whether it carries the generated header**. A file named outside that pattern is never inspected, whatever it contains — that is what makes the variant escape hatch (README.md) true. `/setup` writes nothing into `.archon/commands/`; the Box command stubs live at `docs/boxes/` as operator documentation, not runtime artefacts.

Substitute `{MERGED_CONFIG_JSON}` with the JSON-serialised config Step 5 wrote — or with `CURRENT` when Step 5 was skipped — so the tier report reflects the team's own `methods.<name>.source` declarations. Then run:

```bash
node --input-type=module <<'EOJS'
let result
try {
  const { pathToFileURL } = await import('node:url')
  const { join } = await import('node:path')
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
  // Named explicitly: `join(undefined, …)` throws "path argument must be of type string",
  // which says nothing about what to do next.
  if (!pluginRoot) throw new Error('CLAUDE_PLUGIN_ROOT is not set. Run this as a /unic-archon-dlc: slash command — the snippet cannot find the Plugin on its own.')
  const bundle = await import(pathToFileURL(join(pluginRoot, 'lib', 'methods-bundle.mjs')).href)
  const manifest = await import(pathToFileURL(join(pluginRoot, 'lib', 'methods-manifest.mjs')).href)
  const resolver = await import(pathToFileURL(join(pluginRoot, 'lib', 'methods-resolver.mjs')).href)
  const artefacts = await import(pathToFileURL(join(pluginRoot, 'lib', 'artefact-install.mjs')).href)
  const { readFileSync } = await import('node:fs')
  const cwd = process.cwd()
  const config = {MERGED_CONFIG_JSON}
  const bundleRoot = join(pluginRoot, 'vendor', 'mattpocock-skills')
  const pluginVersion = JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8')).version

  const licence = bundle.verifyLicence({ bundleRoot })
  if (!licence.ok) {
    result = { ok: false, stage: 'licence', message: licence.message }
  } else {
    const integrity = bundle.verifyBundle({ bundleRoot })
    if (!integrity.ok) {
      result = { ok: false, stage: 'bundle', message: `The vendored Method bundle is incomplete — missing: ${integrity.missing.join(', ')}. This is a Plugin packaging fault; reinstall or report it.` }
    } else {
      const install = bundle.installMethods({ bundleRoot, repoRoot: cwd })
      if (!install.ok) {
        result = { ok: false, stage: 'install', message: install.message }
      } else {
        const workflows = artefacts.installBoxWorkflows({ pluginRoot, repoRoot: cwd, pluginVersion })
        if (!workflows.ok) {
          result = {
            ok: false,
            stage: 'workflows',
            message: `Failed to install the Box workflow YAMLs into .archon/workflows/ (${workflows.stage}: ${workflows.cause}). ${workflows.written.length} file(s) written and ${workflows.deleted.length} stale file(s) removed before the failure; re-run /unic-archon-dlc:setup to retry.`,
          }
        } else {
          const overrides = bundle.inspectLocalOverrides({ repoRoot: cwd })
          const tiers = manifest.METHODS_MANIFEST.map((entry) => {
            const resolved = resolver.resolveMethod(entry.name, { repoRoot: cwd, config, box: 'setup' })
            return { name: entry.name, tier: 'error' in resolved ? null : resolved.tier }
          })
          result = {
            ok: true,
            tag: manifest.METHODS_BUNDLE.tag,
            installed: install.installed,
            overrides,
            tiers,
            workflowsWritten: workflows.written,
            workflowsDeleted: workflows.deleted,
          }
        }
      }
    }
  }
} catch (err) {
  result = { ok: false, stage: 'unexpected', message: `Unexpected error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Parse the JSON output. If `ok` is `false`, print `message` verbatim and **stop the whole setup run** — each failure mode (`licence`, `bundle`, `install`, `workflows`, `unexpected`) means the shipped Plugin itself is incomplete, altered, or couldn't write to disk, none of which a re-run of the earlier steps fixes. On a `licence` failure, the message asks the maintainer to restore the file: **never create a `LICENSE` file yourself.** On an `install` or `workflows` failure, the message already tells the operator how much landed before the failure and that a bare re-run of `/setup` self-heals (it clean-replaces the affected tree). A `workflows` failure whose stage is `stale-sweep` means a `unic-dlc-*.yaml` this Plugin no longer ships could not be read or removed — its path and the read/remove error are already named in `message`, so `/setup` never reports success while that stale Box is still on disk.

If `ok` is `true`, keep `BUNDLE_TAG` (`tag`), `TIERS`, `OVERRIDES`, `WORKFLOWS_WRITTEN`, and `WORKFLOWS_DELETED` for the Step 8 summary. Any entry in `OVERRIDES` whose `matchesBundle` is `false` is a Local override forked from a different Bundle version (or from none at all) — report it; do not modify it.

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
- **Methods** — `.archon/methods/` is replaced wholesale on every `/unic-archon-dlc:setup` run. Put a
  local override in `.archon/methods.local/` instead.
- **What each box does** —
  <https://github.com/unic/unic-agents-plugins/blob/main/apps/claude-code/unic-archon-dlc/README.md>

<!-- unic-archon-dlc:end -->
```

Keep the edit idempotent: re-running `/setup` replaces the block in place, never appends a second one.

## Step 8 — Summary

Print a concise summary. List every Method with the tier it resolved from, and one line for Local overrides:

```
unic-archon-dlc configured.
  config:   {configPath}
  archon remote: {ARCHON_REMOTE_RESOLVED} (Archon's own worktree.remote — verified, never written by this plugin)
  tracker:  {tracker.type} (access: {mcp|cli})
  docs:     {docs.type} (publish: {docs.publish})
  gates:    build={…} qa={…} pr-review={…} explore={…}
  methods:  {name}({tier}) · {name}({tier}) · … (bundle {BUNDLE_TAG})
  overrides: none
  workflows written: {path} · {path} · …
  workflows removed: none
```

Fill `{configPath}` from `configPath` (Step 5's output) or, when Step 5 was skipped, from `CONFIG_PATH` (Step 2's output).

Fill the `archon remote:` line from `ARCHON_REMOTE_RESOLVED`. When it is null, print `none resolved — Archon Boxes may need worktree.remote set manually` instead of a remote name.

Build the `methods:` line from `TIERS` — one `{name}({tier})` per manifest entry, `·`-separated. A `null` tier means the Method resolved at no tier at all; print it as `{name}(UNRESOLVED)` and name it as a fault worth reporting.

Build the `overrides:` line from `OVERRIDES`: `none` when it is empty, otherwise one entry per override whose `matchesBundle` is `false`, e.g. `overrides: tdd — forked_from mismatch (expected {BUNDLE_TAG}, got v1.0.0|missing)`. Overrides that match the Bundle tag need no flag.

Build the `workflows written:` line from `WORKFLOWS_WRITTEN` — every path this run wrote into `.archon/workflows/`, `·`-separated. Build `workflows removed:` from `WORKFLOWS_DELETED` — `none` when it is empty, otherwise every stale `unic-dlc-*.yaml` path this run swept because the current Plugin version no longer ships it. Both lists name **paths written and paths deleted**, never a count alone — the point is a reviewable diff, not a summary number.

Then note: **re-run `/unic-archon-dlc:setup` after updating the plugin** to pick up new config keys (the merge is idempotent — your existing values are preserved).
