# 0010. Provider as a folder bundle

**Status:** Accepted (2026-06)

## Context

A Source Platform Provider encapsulates everything the orchestrator needs to talk to one host (Azure DevOps today; GitHub/GitLab later): the PR-URL pattern, the URL parser, the names of the fetcher/writer agents, and work-item discovery. The Plugin needs a shape for these Providers that keeps adding a new host contained and keeps test fixtures close to the code they exercise.

Two alternatives were considered:

- **Single file `providers/azure_devops.mjs`.** Rejected. A library file would have to embed agent-name references (`agents.fetcher`, `agents.writer`) inline, leaving no natural home for the provider's test fixtures or its unit tests, which would scatter into the shared `tests/` and `fixtures/` trees. Adding GitHub/GitLab support would mean touching a growing `index` file and threading new fixtures through the shared test directory rather than dropping a self-contained unit.
- **Folder bundle `providers/<name>/`.** Accepted (see Decision). Each bundle owns its code, metadata, docs, fixtures, and tests in one directory.

## Decision

Each Source Platform Provider ships as a folder bundle `providers/<name>/` containing:

- `provider.mjs` — the code contract (library + CLI entry, mirroring `scripts/lib/changed-file-analyser.mjs`)
- `manifest.json` — bundle metadata (name, label, version, registered agents)
- `README.md` — bundle docs
- `fixtures/` — test fixtures co-located with the provider
- `tests/` — the bundle's unit tests

The bundle exports `name`, `label`, `prUrlPattern`, `parsePrUrl(url) → { orgUrl, project, repo, prId }`, `agents.{ fetcher, writer }` (in the `unic-pr-review:*` namespace), and `discoverWorkItems(workItemRefs) → [{ id, type, url, raw }]`. `providers/index.mjs` exposes `detectProvider(url) → ProviderModule | null` by testing each registered provider's `prUrlPattern` in first-match-wins order.

## Amendment (2026-06) — discoverWorkItems signature: refs array, not prMetadata blob

`discoverWorkItems` was originally specified as `discoverWorkItems(prMetadata)` — taking the raw PR-metadata object and extracting `prMetadata.workItemRefs` internally. This was changed to `discoverWorkItems(workItemRefs)` — taking the refs array directly — because `workItemRefs` buried inside the large `prMetadata` blob was silently dropped by the ADO Fetcher agent on large PRs (agent improvisation to keep inline output small; the `?? []` fallback then collapsed data-loss into the legitimate "no Work Items linked" state, bypassing the silent-false-negative guard in Fetcher Step 1.5).

The fix decouples the two: the ADO Fetcher now emits `workItemRefs` as a **top-level** field on `FETCHER_OUTPUT` (small summary-tier data, always kept inline), and the orchestrator (`review-pr.md` Step 1.5) reads `FETCHER_OUTPUT.workItemRefs` directly and passes the array to `discoverWorkItems`. The raw `prMetadata` blob is no longer on the discovery data path. `discoverWorkItems` throws on any non-array input — including `undefined` from an absent key — so a handoff data-loss can never be silently swallowed.

## Consequences

- Adding GitHub/GitLab is a contained PR: drop a new `providers/<name>/` folder and register it in `providers/index.mjs`. No edits to existing provider bundles.
- Fixtures and unit tests live beside the provider code they exercise, not in the shared `tests/`/`fixtures/` trees.
- The ADO Writer agent name (`agents.writer`) lives in the provider bundle, not scattered across the orchestrator.
- The orchestrator depends only on the contract surface (`detectProvider`, `parsePrUrl`, `discoverWorkItems`, `agents`), so a provider's internals can change without touching `commands/review-pr.md`.
