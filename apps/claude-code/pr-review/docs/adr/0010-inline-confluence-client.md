# Inline Confluence client, no dependency on unic-confluence

The doc-context enrichment feature needs to fetch and read Confluence pages. A `unic-confluence` plugin exists in the same monorepo but targets publishing workflows, not reading. More importantly, Claude Code plugins have no runtime package resolution — when a user installs `pr-review` they get only its directory; workspace packages are not available on their machine. Introducing a shared `packages/confluence-client/` would require a build step that bundles or copies code into the plugin, which the monorepo explicitly avoids.

We therefore replicate the minimal Confluence fetch logic as a self-contained `.mjs` script inside `pr-review/`. Credential lookup mirrors `unic-confluence` exactly — env vars first (`CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`), falling back to `~/.unic-confluence.json`. Both plugins target Unic employees; honouring the same lookup order means a developer with both plugins installed needs zero additional setup. This is a deliberate shared convention for a known, bounded audience — not accidental coupling. If the overlap with `unic-confluence` grows to the point where duplication is painful, that is the signal to introduce a build step — not before.

**Status:** Accepted (2026-05)

**Considered alternatives:**

- Soft dependency on `unic-confluence` (ADR-0008 pattern) — rejected: wrong scope (publishing vs. reading), not guaranteed to be installed
- Shared workspace package — rejected: no runtime package resolution for installed plugins without a bundler
