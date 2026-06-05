# 0001. Vendor shared Atlassian code for self-containment

**Status:** Accepted (2026-06)

## Context

`unic-spec-review` needs Confluence access (read pages and comments, write comments), credential loading from `~/.unic-confluence.json`, and an interactive credential setup wizard. `unic-pr-review` already implements all three as runtime Node.js modules: `scripts/atlassian-fetch.mjs`, `scripts/lib/credentials.mjs`, and `scripts/setup-confluence.mjs`.

Three ways to obtain this functionality were considered:

- **Cross-import from `unic-pr-review`.** Rejected. Plugins are installed and versioned independently; one plugin importing another's internal scripts at runtime creates a hard dependency that breaks whenever the other plugin is absent, relocated, or version-skewed.
- **Extract a shared `@unic/atlassian` workspace package.** Rejected for now (see Reasons).
- **Vendor (copy) the modules into this plugin.** Chosen.

## Decision

Copy `atlassian-fetch.mjs`, `credentials.mjs`, and the `setup-confluence` wizard from `unic-pr-review` into this plugin, and extend the local copy of `atlassian-fetch` with Confluence comment read and write. The plugin ships its own `/setup-confluence` command. It has no runtime or setup dependency on any other plugin and is fully usable when installed alone.

Credentials use the shared `~/.unic-confluence.json` convention (or `CONFLUENCE_*` env vars). This is a shared credential store keyed by a conventional filename, not a coupling between plugins: each plugin creates and reads the file through its own wizard, so a user with both plugins configures Confluence once.

## Reasons

- **Self-containment is the product requirement.** A reviewer must be able to install only this plugin and run a review. That rules out any cross-plugin runtime or setup dependency.
- **Consistent with the monorepo's runtime-duplication stance.** Root [ADR-0025](../../../../../docs/adr/0025-clierror-duplication-intentional.md) keeps small runtime modules intentionally duplicated and defers a shared package until a third copy appears; root [ADR-0002](../../../../../docs/adr/0002-shared-unic-packages.md) reserves `@unic/*` packages for shared dev tooling, not runtime utilities. Vendoring here follows both.
- **Duplication cost is lower than coordination cost today.** A shared package would need its own version, changelog, and release lifecycle, and would have to stay compatible across two consumers on independent release cadences.

## Consequences

- Vendoring makes `unic-spec-review` the **second** copy of `atlassian-fetch` and `credentials` (`unic-pr-review` is the first). This is under root ADR-0025's three-copy consolidation trigger but moves toward it. If a third runtime copy of these modules appears, that is the trigger to open a spec for a shared `@unic/atlassian` package, consolidate all copies, and supersede this ADR alongside root ADR-0025.
- The copies will drift from `unic-pr-review`'s originals over time (this plugin extends `atlassian-fetch` with comment write that `unic-pr-review` does not need). Drift is expected and acceptable; the modules are not kept in lockstep.
- Bug fixes to vendored code are applied per plugin, not propagated automatically. Architecture reviews should not flag the duplication as a defect.
