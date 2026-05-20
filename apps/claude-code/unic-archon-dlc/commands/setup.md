---
allowed-tools: ['Bash']
argument-hint: '[reconfigure | <free-form intent>]'
description: 'Configure unic-archon-dlc for this project: tracker, branching strategy, and optional e2e command'
---

# unic-archon-dlc:setup

> Design rationale: [ADR-0001 — Setup is a slash command delegating to lib/install-runner.mjs](docs/adr/0001-setup-as-slash-command.md)

**Arguments:** "$ARGUMENTS"

Follow these steps in order. Do not skip any step. Do not write any files except through Step 5.

## Step 1 — Archon preflight

Run:

```bash
node --input-type=module <<'EOJS'
const { checkArchon } = await import(`file://${process.env.CLAUDE_PLUGIN_ROOT}/lib/archon-check.mjs`)
process.stdout.write(JSON.stringify(checkArchon()) + '\n')
EOJS
```

Parse the JSON output. If `ok` is `false`, print `message` verbatim and stop — do not proceed to Step 2.

## Step 2 — Discover config state

Run:

```bash
node --input-type=module <<'EOJS'
const { exploreProject } = await import(`file://${process.env.CLAUDE_PLUGIN_ROOT}/lib/setup-explorer.mjs`)
const { loadConfig, isConfigError } = await import(`file://${process.env.CLAUDE_PLUGIN_ROOT}/lib/config-loader.mjs`)
const { join } = await import('node:path')
const cwd = process.cwd()
const snap = exploreProject(cwd)
let config = null
if (snap.archonConfigPresent) {
  const loaded = loadConfig(join(cwd, '.archon', 'unic-dlc.config.json'))
  if (!isConfigError(loaded)) config = loaded
}
process.stdout.write(JSON.stringify({ gitRemote: snap.gitRemote, config }) + '\n')
EOJS
```

Parse the output. Set `CONFIG` from the `config` field (null if absent or parse error), `GIT_REMOTE` from `gitRemote`.

Determine `STATE`:

- `CONFIG` is null → `STATE = 'fresh'`
- `CONFIG` is missing any of `tracker`, `pr_strategy`, `branching` → `STATE = 'partial'`
- Otherwise → `STATE = 'full'`

## Step 3 — Parse arguments and determine mode

Arguments: `$ARGUMENTS`

- Empty or whitespace only → `MODE = 'default'`
- Trimmed lowercase equals `reconfigure` → `MODE = 'reconfigure'`
- Otherwise → `MODE = 'intent'`, `INTENT = $ARGUMENTS`

## Step 4 — Act on STATE × MODE

### Full + default: print summary and exit

If `STATE = 'full'` and `MODE = 'default'`, print the current configuration and **stop** (do not call `runInstall`):

```
unic-archon-dlc is already configured:
  tracker:       {CONFIG.tracker}
  pr_strategy:   {CONFIG.pr_strategy}
  branching:     {CONFIG.branching}
  e2e_command:   {CONFIG.e2e_command or '(none)'}
  model_profile: {CONFIG.model_profile or 'balanced'}

Run `/unic-archon-dlc:setup reconfigure` to update settings.
```

### Determine which fields to collect

- `STATE = 'fresh'` → collect all three mandatory fields + optional e2e_command
- `STATE = 'partial'` → collect only the fields missing from `CONFIG` (skip any already present)
- `MODE = 'reconfigure'` → collect all three mandatory fields + optional e2e_command
- `STATE = 'full'` and `MODE = 'intent'` → interpret `INTENT` to decide which field(s) to update; ask only about those fields

### Collect answers conversationally

For each field to collect, ask the user conversationally. Surface auto-detected hints:

- `GIT_REMOTE` contains `github.com` → suggest `tracker = github`
- `GIT_REMOTE` contains `dev.azure.com` → suggest `tracker = ado`

Mandatory fields (ask in this order):

- **tracker** — issue tracker backend: `github` | `ado` | `jira` | `local-markdown`
- **pr_strategy** — PR merge strategy: `merge` | `squash` | `rebase`
- **branching** — branching model: `gitflow` | `github-flow`

Optional field:

- **e2e_command** — shell command to run e2e tests (e.g. `pnpm test:e2e`); user may leave empty

Build `partialAnswers` containing only the fields you collected. Fields with an empty e2e_command should be set to `null`.

## Step 5 — Write config

Substitute `{ANSWERS_JSON}` with the JSON-serialised `partialAnswers` object, then run:

```bash
ANSWERS_JSON='{ANSWERS_JSON}' \
node --input-type=module <<'EOJS'
const { runInstall } = await import(`file://${process.env.CLAUDE_PLUGIN_ROOT}/lib/install-runner.mjs`)
const result = runInstall(process.cwd(), JSON.parse(process.env.ANSWERS_JSON))
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Parse the JSON output:

- If `ok` is `true`, print:

  ```
  unic-archon-dlc configured.
    config:    {result.configPath}
    docs:      {result.wroteDocs ? 'written' : 'skipped'}
    CLAUDE.md: {result.wroteClaudeMd ? 'updated' : 'skipped'}
  ```

- If `ok` is `false`, print `result.message` and stop.
