# Setup is a conversational slash command with no JS lib

**Status:** Accepted (2026-06)

The user-facing entry point for configuring the plugin in a target project is the
`/unic-ticket-specification:setup` slash command (`commands/setup.md`). Unlike
`unic-archon-dlc`, whose setup delegates all filesystem writes to a tested
`lib/install-runner.mjs` ([its ADR-0001](../../../unic-archon-dlc/docs/adr/0001-setup-as-slash-command.md)),
this plugin's setup command does the work **conversationally** — Claude reads the documented config
template, asks the questions, and writes `.archon/ticket-spec.config.yaml` plus
`.archon/mcp/ticket-spec-tracker.json` directly. The plugin ships **no JavaScript**.

This decision exists to close a guideline gap: `CONTRIBUTING.md` requires plugins to be "zero-config
from the user's perspective — no configuration files users must create beyond credentials." Before
`/setup`, installing meant hand-copying `ticket-spec.config.example.yaml` and editing YAML, which
violated that rule.

## Considered options

- **Mirror `unic-archon-dlc`: a thin slash command delegating to `lib/install-runner.mjs`** —
  rejected for this plugin. That pattern earns its keep when there is non-trivial, drift-prone logic
  worth extracting and unit-testing (additive `defaults < existing < answers` merge, marker-delimited
  `CLAUDE.md` rewrites, multi-file `docs/agents/` generation). This bundle has none of that: it writes
  one config file and one MCP file from a documented template. Introducing a `lib/`, `test/`,
  `tsconfig.json`, and the typescript/`@types/node` toolchain to support ~30 lines of file-writing
  would add a build/test surface disproportionate to the value, and turn a pure-content plugin into a
  code plugin.

- **No setup command; keep the manual copy-and-edit instructions** — rejected. It is the status quo
  that breaks the zero-config rule and makes onboarding a YAML chore.

- **A conversational slash command, no JS** — chosen. It satisfies zero-config, keeps the plugin a
  pure Archon-workflow bundle (YAML + Markdown + JSON only), and stays idempotent (fresh / partial /
  full / reconfigure / targeted-tweak) by reading existing config and branching on `$ARGUMENTS`.

## Consequences

- The plugin's `package.json` has no `test` / `typecheck` script and no `tsconfig.json` — there is no
  JavaScript to check. This is intentional and documented in `AGENTS.md`.
- The merge precedence (`defaults < existing < answers`) and idempotency states live as prose
  instructions in `commands/setup.md` rather than as tested code. If this logic ever grows complex or
  bug-prone, revisit by extracting a `lib/` module and adopting the `unic-archon-dlc` delegation
  pattern — this ADR would then be superseded.
- `/setup` performs an Archon preflight (`archon --version`) and copies the workflow + command bundle
  into the target `.archon/` so a Consumer never hand-edits YAML to get running.
