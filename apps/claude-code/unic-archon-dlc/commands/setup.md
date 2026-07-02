---
allowed-tools: ['Bash']
argument-hint: '[reconfigure | <free-form intent>]'
description: 'Configure unic-archon-dlc for this project: detect the stack, register the team system-skills, and write .archon/unic-dlc.config.yaml'
---

# unic-archon-dlc:setup

> Design rationale: [ADR-0019 — Conversational `/setup` + one thin tested schema lib](docs/adr/0019-conversational-setup.md) (supersedes ADR-0001).

**Arguments:** "$ARGUMENTS"

`/setup` is the **sole configuration entry point** and is **conversational**: it detects the stack, **composes the team's system-skills** to discover what the team has, and writes the rich `.archon/unic-dlc.config.yaml` that every other box reads. Only one deterministic concern is delegated to tested code — schema-validate + idempotent merge + YAML emit — in `lib/config-schema.mjs`. Conduct the conversation yourself; do not invent config keys the schema doesn't define.

Follow these steps in order. Do not skip any step. Do not write any files except through Step 5 (config) and Step 6 (docs).

> **Shell requirement**: Steps 1, 2, and 5 use `<<'EOJS'` heredoc syntax, which requires a POSIX-compatible shell. On Windows, run inside WSL2 or Git Bash; cmd.exe and PowerShell do not support heredocs. All filesystem work uses Node's `node:fs`/`node:path`, so paths are cross-platform.

## Step 1 — Archon preflight (behavioural `≥ 0.5.0`)

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

Parse the JSON output. If `ok` is `false`, print `message` verbatim and stop — do not proceed. (The check enforces the key-discriminated schema floor: gates, loops, and `context: fresh` only run correctly on Archon `≥ 0.5.0`.)

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

  if (!output) {
    let gitRemote = null
    try { gitRemote = execFileSync('git', ['remote', 'get-url', 'origin'], { stdio: ['pipe','pipe','pipe'], timeout: 5000 }).toString().trim() } catch {}
    const repoLayout = mod.detectRepoLayout(cwd)
    // Normalise to the rich shape so validation reflects what /setup will actually write.
    const normalised = legacy ? mod.mergeConfig(mod.migrateLegacy(config)) : (config ? mod.mergeConfig(config) : null)
    const validation = normalised ? mod.validateConfig(normalised) : { error: true, missing: mod.MANDATORY_PATHS }
    output = {
      gitRemote,
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

Parse the output. If `error` is present, print it verbatim and stop. Otherwise set `GIT_REMOTE`, `REPO_LAYOUT`, `LEGACY` (true = a legacy flat `.json` will be migrated), `CURRENT` (the normalised config, or null), and `MISSING` (mandatory paths still unset).

Determine `STATE`:

- `CURRENT` is null → `STATE = 'fresh'`
- `MISSING` is non-empty → `STATE = 'partial'`
- Otherwise → `STATE = 'full'`

## Step 3 — Verify-only skill discovery (never installs)

Build a **capability → tool** registry the downstream boxes read (`mcp | cli | skill`, **MCP-first**). Discovery is **verify-only**: introspect what is installed; never install anything.

- **MCP servers**: note which relevant MCP servers are available in this session (tracker, docs, design — e.g. a GitHub/ADO/Jira MCP, a Confluence MCP, the Figma MCP).
- **CLI probes** (portable — no `jq`/`awk`/`sort`): `gh --version`, `az --version`, `jira version` (or `jira --help`), etc. Record which succeed.
- **Matt Pocock's skill suite** is a **declared dependency** ([ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md)): verify the skills the DLC composes are present (`grill-with-docs`, `to-prd`, `to-issues`, `triage`, `improve-codebase-architecture`, `handoff`, `prototype`). Check the available skills list.

For each capability pick the tool MCP-first, else CLI, else skill. A **missing _required_ capability → warn + degrade, non-blocking**: complete setup, record it unavailable in the config, and **list the boxes it blocks** (boxes re-probe at runtime and fail with a clear "install X"). Never abort setup for a missing capability.

## Step 4 — Parse arguments, then collect only the gaps conversationally

Arguments: `$ARGUMENTS`

- Empty/whitespace → `MODE = 'default'`
- Trimmed lowercase equals `reconfigure` → `MODE = 'reconfigure'`
- Otherwise → `MODE = 'intent'`, `INTENT = $ARGUMENTS`

If `STATE = 'full'` and `MODE = 'default'`, print the current configuration summary and **stop** (do not rewrite) — tell the user to run `/unic-archon-dlc:setup reconfigure` to change settings. Exception: if `LEGACY` is true, proceed to migrate even in this case (a rich `.yaml` does not yet exist).

Otherwise collect the fields to fill:

- `STATE = 'fresh'` → collect all mandatory fields + the optional ones below.
- `STATE = 'partial'` (default) → collect only `MISSING` fields.
- `MODE = 'reconfigure'` → collect all fields.
- `MODE = 'intent'` → collect `MISSING` first, then interpret `INTENT` to decide which already-set field(s) to also update.

Surface auto-detected hints while asking: `GIT_REMOTE` contains `github.com` → suggest `tracker.type = github`; `dev.azure.com`/`visualstudio.com` → `ado`. Always pass `REPO_LAYOUT` through (never ask).

Fields (map answers onto the schema paths — see `docs/adr/0018-generic-core-config-compose.md`):

- **project** — `project.name`, `project.branching` (`gitflow | github-flow`), `project.pr_strategy` (`merge | squash | rebase`). _(mandatory: branching, pr_strategy)_
- **tracker** — `tracker.type` (`github | ado | jira | local-markdown`) _(mandatory)_; `tracker.coords` (e.g. `{owner, repo}` for github, `{org, project, repo}` for ado); `tracker.access` filled from Step 3 (`{mcp, cli}`).
- **docs** — `docs.type` (`confluence | markdown | none`) — where the team's **product specs** live; `docs.publish` (default `false`, opt-in). `docs.access` from Step 3. _(Independent of the `docs/agents/*.md` files Step 6 always writes.)_
- **design** — `design.type` (`figma | none`), `design.access` from Step 3.
- **gates** — per Archon box (`build`, `qa`, `pr-review`, `explore`): `hitl` (default) or `afk`. Interactive skill boxes are always HITL and are not listed here.
- **build** — `build.e2e_command` (optional), `build.coverage_threshold` (optional). Leave `build.fresh_context_red_green`, `tdd_mode`, `nyquist_validation`, `slopsquatting_gate` at their defaults unless the user asks.
- **estimations** — `off | provisional | definitive | both` (default `off`).
- **model_profile** — `fast | balanced | max` (default `balanced`).

Build a single `ANSWERS` object containing **only** the fields you collected, keyed by the nested schema paths above, plus:

- `project.repo_layout` = `REPO_LAYOUT`,
- the Step-3 discovery results under `tracker.access` / `docs.access` / `design.access` and a `skills` block (`{ matt_suite: { present, missing } }`).

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
  let existing = {}
  if (existsSync(yamlPath)) {
    const r = mod.loadConfig(yamlPath)
    if (!('error' in r)) existing = r.config
  } else if (existsSync(jsonPath)) {
    const r = mod.loadConfig(jsonPath)
    if (!('error' in r)) existing = mod.isLegacyConfig(r.config) ? mod.migrateLegacy(r.config) : r.config
  }

  const merged = mod.mergeConfig(existing, answers)
  const emitted = mod.toYaml(merged)
  if ('error' in emitted) {
    result = { ok: false, stage: 'validate', message: emitted.message }
  } else {
    mkdirSync(join(cwd, '.archon'), { recursive: true })
    writeFileSync(yamlPath, emitted.yaml)
    result = { ok: true, configPath: yamlPath, legacyKept: existsSync(jsonPath) ? jsonPath : null }
  }
} catch (err) {
  result = { ok: false, stage: 'unexpected', message: `Unexpected error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Parse the JSON output. If `ok` is `false`, print `message` and stop. If `ok` is `true`, note `configPath` and (if present) `legacyKept` — the legacy `.json` is **left in place** because other tools may still read it.

## Step 6 — Update agent docs (idempotent)

Write/refresh the auto-managed `## Agent skills` block in the consumer's `CLAUDE.md`, delimited by `<!-- unic-archon-dlc:begin -->` / `<!-- unic-archon-dlc:end -->`. Replace only the content **between** the markers (preserve everything outside verbatim); if the file or block is absent, create it. The block points readers at the box set (`/specs → /tickets → /build → /pr-review → /qa`; on-ramps `/triage`, `/qa`; off-line `/setup`, `/explore`, `/improve-architecture`, `/cleanup`) and at `.archon/unic-dlc.config.yaml` as the config source of truth. This runs regardless of `docs.type`.

Keep the edit idempotent: re-running `/setup` replaces the block in place, never appends a second one.

## Step 7 — Summary

Print a concise summary:

```
unic-archon-dlc configured.
  config:   {configPath}
  tracker:  {tracker.type} (access: {mcp|cli})
  docs:     {docs.type} (publish: {docs.publish})
  gates:    build={…} qa={…} pr-review={…} explore={…}
  skills:   Matt suite {present|MISSING: …}; blocked boxes: {…|none}
```

Then note: **re-run `/unic-archon-dlc:setup` after updating the plugin** to pick up new config keys (the merge is idempotent — your existing values are preserved).
