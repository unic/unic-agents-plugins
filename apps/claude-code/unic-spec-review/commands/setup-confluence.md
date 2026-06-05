---
description: Interactive setup wizard that writes Confluence credentials to ~/.unic-confluence.json for unic-spec-review.
---

# Setup Confluence

> ⚠️ Scaffold stub: not yet implemented. Behaviour is specified in the [PRD](../docs/issues/unic-spec-review/PRD.md) (#200); the command body lands with its implementation slice.

This plugin ships its own Confluence credential wizard so it is fully self-contained: it never depends on another plugin being installed or set up. It writes to the shared `~/.unic-confluence.json` convention (also honouring `CONFLUENCE_*` env vars), so a user with `unic-pr-review` already configured does not configure Confluence twice. See `AGENTS.md` for the locked design.
