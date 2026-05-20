# Setup is a slash command delegating to `lib/install-runner.mjs`

**Status:** Accepted (2025-05)

The user-facing entry point for configuring unic-archon-dlc in a target project is the
`/unic-archon-dlc:setup` slash command (`commands/setup.md`), not a Node CLI hook. The
slash command stays thin — it conducts the conversation (asks for tracker, branching
strategy, e2e command; surfaces auto-detected values from `lib/setup-explorer.mjs`) and
delegates all filesystem writes to `lib/install-runner.mjs`, a pure function extracted
from the deleted `hooks/install.mjs`. This keeps one source of truth for the merge logic
(`defaults < existing < answers`), the marker-delimited `CLAUDE.md` update, and the
`docs/agents/*.md` generation.

## Considered options

- **Keep `hooks/install.mjs` alongside the slash command** — rejected. The Claude Code
  `"hooks": { "install": ... }` manifest field does not auto-run interactive scripts, so
  the hook never worked as advertised. Two UIs sharing one engine would still drift on the
  subtle additive-merge semantics, and no documented user flow depends on a terminal entry
  point. A future non-interactive CLI need can be served by a 5-line wrapper around
  `runInstall()`.

- **Re-implement install logic inline in the slash command markdown** — rejected. The
  existing lib modules (`agent-docs-writer`, `config-loader`, `setup-explorer`,
  `labels-config`) are already pure functions taking a `projectDir`. Porting them into
  prose duplicates tested logic and invites drift. Markdown is the wrong place for the
  defaults/existing/answers precedence rules.

- **Split into `/unic-archon-dlc:setup` + `/unic-archon-dlc:reconfigure`** — rejected.
  Once-per-project operations don't justify two slash commands. Claude can read existing
  config and behave contextually (fresh / partial / full / reconfigure / targeted-tweak)
  from a single entry point via free-form `$ARGUMENTS`.

## Consequences

- `hooks/install.mjs` is deleted; the `"hooks"` field is removed from `plugin.json`. Other
  plugins copying this manifest as a template should not reinstate the field unless they
  have a hook that Claude Code actually executes.

- `lib/install-runner.mjs` accepts a _partial_ answers object and merges with existing
  config. It enforces the mandatory-fields invariant after merge, not at the call site.
  The slash command is responsible for collecting answers before calling.

- The Archon binary preflight (`lib/archon-check.mjs`, extracted from `checkArchon()` in
  install.mjs) runs only in setup. Workflow commands rely on the natural error from a
  missing `archon` binary plus their own config-presence check.

- The first ADR for this plugin establishes the per-plugin `docs/adr/` location under
  `apps/claude-code/unic-archon-dlc/`, separate from the monorepo-level `docs/adr/`.
