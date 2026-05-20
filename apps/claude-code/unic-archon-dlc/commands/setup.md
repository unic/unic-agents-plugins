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

Parse the JSON output. If `ok` is `false`, print `message` verbatim and stop — do not proceed to Step 2.

## Step 2 — Discover config state

Run:

```bash
node --input-type=module <<'EOJS'
let output
try {
  const { pathToFileURL } = await import('node:url')
  const { exploreProject } = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/setup-explorer.mjs`).href)
  const { readFileSync, existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const cwd = process.cwd()
  const snap = exploreProject(cwd)
  let config = null
  const configPath = join(cwd, '.archon', 'unic-dlc.config.json')
  if (snap.archonConfigPresent && existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'))
    } catch (parseErr) {
      output = { error: `Config file contains invalid JSON and cannot be read: ${parseErr?.message ?? String(parseErr)}. Fix or delete ${configPath} and re-run setup.`, gitRemote: snap.gitRemote, config: null }
    }
  }
  if (!output) {
    const agentDocsPath = join(cwd, 'docs', 'agents', 'issue-tracker.md')
    const claudeMdPath = join(cwd, 'CLAUDE.md')
    const docsPresent = existsSync(agentDocsPath)
    let claudeMdPresent = false
    if (existsSync(claudeMdPath)) {
      claudeMdPresent = readFileSync(claudeMdPath, 'utf8').includes('<!-- unic-archon-dlc:begin -->')
    }
    output = { gitRemote: snap.gitRemote, config, docsPresent, claudeMdPresent }
  }
} catch (err) {
  output = { error: `Plugin load error: ${err?.message ?? String(err)}`, gitRemote: null, config: null }
}
process.stdout.write(JSON.stringify(output) + '\n')
EOJS
```

Parse the output. If `error` is present, print `error` verbatim and stop. Otherwise set `CONFIG` from `config`, `GIT_REMOTE` from `gitRemote`, `DOCS_PRESENT` from `docsPresent`, `CLAUDE_MD_PRESENT` from `claudeMdPresent`.

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

### Full + default: print summary and exit (or repair)

If `STATE = 'full'` and `MODE = 'default'` and `DOCS_PRESENT` is `true` and `CLAUDE_MD_PRESENT` is `true`, print the current configuration and **stop** (do not call `runInstall`):

```
unic-archon-dlc is already configured:
  tracker:       {CONFIG.tracker}
  pr_strategy:   {CONFIG.pr_strategy}
  branching:     {CONFIG.branching}
  e2e_command:   {CONFIG.e2e_command or '(none)'}
  model_profile: {CONFIG.model_profile or 'balanced'}

Run `/unic-archon-dlc:setup reconfigure` to update settings.
```

If `STATE = 'full'` and `MODE = 'default'` but `DOCS_PRESENT` is `false` or `CLAUDE_MD_PRESENT` is `false`, print a repair notice and proceed to Step 5 with `partialAnswers = {}`:

```
Config is complete but setup did not finish — rerunning to repair docs/CLAUDE.md.
```

### Determine which fields to collect

- `STATE = 'fresh'` → collect all three mandatory fields + optional e2e_command
- `STATE = 'partial'` and `MODE = 'default'` → collect only the fields missing from `CONFIG` (skip any already present)
- `STATE = 'partial'` and `MODE = 'intent'` → collect missing mandatory fields first (to ensure completeness), then interpret `INTENT` to determine if any already-present field should also be updated
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

Substitute `{ANSWERS_JSON}` with the JSON-serialised `partialAnswers` object (the literal JSON text is placed directly inside the heredoc), then run:

```bash
node --input-type=module <<'EOJS'
let result
try {
  const { pathToFileURL } = await import('node:url')
  const { runInstall } = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/install-runner.mjs`).href)
  result = runInstall(process.cwd(), {ANSWERS_JSON})
} catch (err) {
  result = { ok: false, stage: 'unexpected', message: `Unexpected error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Parse the JSON output:

- If `ok` is `true`, print:

  ```
  unic-archon-dlc configured.
    config:    {result.configPath}
    docs:      written
    CLAUDE.md: updated
  ```

- If `ok` is `false`, print `result.message` and stop.
