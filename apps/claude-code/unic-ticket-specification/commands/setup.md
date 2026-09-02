---
allowed-tools: ['Read', 'Write', 'Glob', 'Bash']
argument-hint: '[reconfigure | <free-form intent>]'
description: 'Configure unic-ticket-specification for this project: tracker, repos, linked docs, and tracker access (MCP or CLI)'
---

# unic-ticket-specification:setup

> Design rationale: [ADR-0004 — Setup is a conversational slash command with no JS lib](docs/adr/0004-setup-conversational-no-lib.md)

**Arguments:** "$ARGUMENTS"

This command makes the plugin **zero-config from the user's perspective**: instead of hand-editing
YAML, you answer a few questions and it writes `.archon/ticket-spec.config.yaml` and
`.archon/mcp/ticket-spec-tracker.json` for you. It is idempotent — safe to re-run.

Follow these steps in order. Do not write any files except in Step 5. Ask questions **one at a
time**, with a short explainer, and skip anything that is already configured.

## Step 0 — Archon preflight

The workflow runs on the Archon engine. Check it is available:

```sh
archon --version
```

If `archon` is not found, tell the user the plugin requires the Archon workflow engine in this
project and stop. Otherwise continue.

## Step 1 — Locate the bundle and the target `.archon/`

The installable bundle lives in this plugin under `${CLAUDE_PLUGIN_ROOT}/.archon/`. The target is
the current project's `.archon/` directory (create it if missing). Read the documented template
`${CLAUDE_PLUGIN_ROOT}/.archon/ticket-spec.config.example.yaml` — it is the source of truth for
every config key and its allowed values. Use it verbatim as the shape you fill in.

## Step 2 — Determine the current state (idempotency)

Read `.archon/ticket-spec.config.yaml` in the target project if it exists, and parse `$ARGUMENTS`:

- **fresh** — no config file: prompt for everything in Step 3.
- **partial** — config exists but is missing one or more of `tracker.type`, the matching tracker
  block, or at least one entry under `repos`: confirm what is set and ask only for the gaps.
- **full** — config is complete and `$ARGUMENTS` is empty: print the current configuration as a
  summary and stop (no writes).
- **reconfigure** — `$ARGUMENTS` is `reconfigure`: re-prompt for everything, pre-filling current
  values as defaults.
- **targeted tweak** — `$ARGUMENTS` is free-form intent (e.g. "switch tracker to azure-devops",
  "add the platform repo"): change only what the intent names; leave everything else intact.

## Step 3 — Gather answers (one question at a time)

Auto-detect what you can before asking. Run `git remote -v` and `git config --get remote.origin.url`
to guess the tracker (`github.com` → `github`; `dev.azure.com` / `visualstudio.com` → `azure-devops`;
otherwise ask, defaulting to `jira`). Then collect, skipping anything already set:

1. **`project.name`** and **`project.key_prefixes`** (Jira project keys that mark an existing
   ticket, e.g. `["ACME"]`; usually empty for Azure DevOps / GitHub).
2. **`tracker.type`** — `jira` | `azure-devops` | `github` (pre-filled from auto-detection).
3. The matching **tracker block**:
   - jira: `site_url`, `default_project`; leave `cloud_id` empty to auto-resolve at runtime.
   - azure-devops: `org_url`, `project`, and the `work_item_types` bug / cr_story names.
   - github: `issues_repo` (`owner/repo`) and the bug / cr_story `labels`.
4. **`tracker.access`** — prefer MCP: `mcp: true` (Step 5 writes the right MCP server). If the user
   has no MCP, set `mcp: false` and `cli` to `jira` / `az` / `gh` (it must be installed +
   authenticated on each machine).
5. **`docs`** — linked documentation source: `confluence` | `azure-wiki` | `github-wiki` | `none`
   (with `confluence.cloud_id` when applicable).
6. **`repos`** — one or many code checkouts, each `name` + `path` (relative, forward-slash). Default
   to a single `{ name: "main", path: "." }`.
7. Offer to keep the default `classification`, `estimation` (`pert`), `output.dir`, and `templates`
   from the example; only ask to override `templates` if the client uses non-standard ticket shapes.

## Step 4 — Confirm

Show the user the resolved configuration as YAML and the MCP server you will write, and confirm
before writing. If they reject, return to Step 3 for the parts they want changed.

## Step 5 — Write the files

Into the **target project**:

1. Write `.archon/ticket-spec.config.yaml` — start from the example template, preserve its comments,
   and fill in the answers. For a partial/tweak run, merge with `defaults < existing < answers`
   (answers win), and never drop fields the user did not touch.
2. Write `.archon/mcp/ticket-spec-tracker.json` only when `tracker.access.mcp` is `true`. Choose the
   server that matches `tracker.type`:
   - jira → the Atlassian MCP (`npx -y mcp-remote https://mcp.atlassian.com/v1/mcp/authv2`), exactly
     as shipped in `${CLAUDE_PLUGIN_ROOT}/.archon/mcp/ticket-spec-tracker.json`.
   - azure-devops → the Azure DevOps MCP server the team uses.
   - github → the GitHub MCP server the team uses.
     If `mcp` is `false`, do not write this file; the workflow uses the configured CLI instead.
3. Copy the workflow and command bundle into the target `.archon/` if not already present: the
   `workflows/unic-ticket-specification.yaml` and the seven `commands/uts-*.md` files from
   `${CLAUDE_PLUGIN_ROOT}/.archon/`. Never overwrite an existing customised copy without confirming.

Use forward-slash, relative paths in everything you write — the bundle must work identically on
Windows and macOS.

## Step 6 — Report

Summarise what was written (config path, whether an MCP server was written or a CLI was selected,
and which repos are configured), then tell the user how to run it:

```sh
archon workflow run unic-ticket-specification --input "<ticket reference or new-ticket description>"
```
