# MCP-first tracker access with a CLI fallback

**Status:** Accepted (2026-06)

The workflow reads from and writes to an issue tracker in three nodes (`analyze`, `apply-create`,
`apply-update`). Tracker access is **MCP-first with a CLI fallback**: tracker nodes load an MCP
server from the fixed path `.archon/mcp/ticket-spec-tracker.json`; when no MCP is configured
(`tracker.access.mcp: false`), the commands fall back to the tracker CLI named in config
(`jira` / `az` / `gh`).

## Considered options

- **MCP only** — rejected. Not every machine or CI runner has an MCP server configured or
  authenticated, and some Unic client tenants expose a CLI more readily than an MCP endpoint.
  MCP-only would make the bundle unusable in those environments.

- **CLI only** — rejected. The richer MCP integrations (e.g. the Atlassian MCP) give structured
  access to issues, fields, and metadata without per-tracker CLI quirks, and align with how the rest
  of the Unic agent tooling reaches Atlassian. Forcing CLI everywhere throws that away.

- **MCP-first, CLI fallback** — chosen. The common, richer path is MCP via a fixed, predictable file
  path so workflow nodes can declare `mcp: .archon/mcp/ticket-spec-tracker.json` statically; the CLI
  is the portable escape hatch. Which one is active is a single config switch, not a workflow edit.

## Consequences

- The MCP config path is **fixed** (`.archon/mcp/ticket-spec-tracker.json`) so the workflow YAML can
  reference it without templating. `/setup` writes the server matching `tracker.type`.
- Tracker nodes carry a generous `idle_timeout` and `retry` because a remote MCP server
  (`mcp-remote`) can cold-start slowly on the first call; the retry lets it self-heal rather than
  failing the run.
- The fallback CLI must be installed and authenticated on each machine that runs the workflow; this
  is documented in the bundle README and surfaced by `/setup`.
- Adding a new tracker means supplying its MCP server (or CLI) and the read/create/update calls in
  the `uts-*` commands — the access mechanism itself does not change.
