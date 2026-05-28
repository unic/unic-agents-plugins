# 0007. Zero runtime npm dependencies in the scaffold slice

**Status:** Accepted (2026-05)

## Context

The scaffold slice (doctor command + credential loader) can be implemented entirely with Node.js built-ins (`node:fs`, `node:os`, `node:path`, `node:child_process`, `node:https`, `node:http`). Adding runtime npm deps increases install time, attack surface, and the chance of supply-chain incidents.

## Decision

`package.json` has no `dependencies` key in the scaffold slice. All implementation uses `node:*` built-ins only.

## Consequences

- `pnpm install` in the plugin directory installs only devDependencies.
- Any PR adding a runtime dep to this plugin requires an ADR amendment.
- Future slices (e.g., diff analysis) may add runtime deps by amending this ADR with a justification.
