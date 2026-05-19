# Context — Spec 10: Doc Context Enrichment

## Source

- Spec file: `docs/plans/10-doc-context-enrichment.md`
- Version impact: **minor** (new user-visible capability, no breaking changes)
- Current plugin version: **0.8.0** → target: **0.9.0**

## Original request summary

Add a Doc Context phase that runs before review agents and injects structured, diff-aware summaries of the PR's linked ADO work items and any Confluence pages referenced in those work items. No new comments are ever posted to the PR — this is internal context only.

## Acceptance criteria

1. All changes land in a single conventional commit: `feat(pr-review): add doc context enrichment from work items and Confluence pages`
2. Version bumped to next available minor (0.9.0) after the re-review feature (0.8.0).
3. `plugin.json` and `marketplace.json` versions match.
4. `CHANGELOG.md` has a dated entry for the new version.
5. `scripts/confluence-client.mjs` has zero external runtime dependencies.
6. Doc Context is never posted to the PR — internal agent context only.
7. Graceful degradation: no work items → skip; no creds → warn + skip Confluence; fetch error → warn + skip page; local diff unavailable → sub-agents work from changed files list only.

## Key files to touch

| File                                      | Change                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `scripts/confluence-client.mjs`           | **New** — credential loading + Confluence v2 page fetch + CLI entry                          |
| `commands/review-pr.md`                   | Add step 4a; inject `DOC_CONTEXT` block into step 8 prompts; add `WebFetch` to allowed-tools |
| `CHANGELOG.md`                            | New `[Unreleased]` entry                                                                     |
| `docs/plans/README.md`                    | Already has spec 10 row (pending → done when complete)                                       |
| `docs/plans/10-doc-context-enrichment.md` | Mark done                                                                                    |

## Repository patterns

- ESM `.mjs` throughout, `// @ts-check` + JSDoc for type safety
- Tabs for indentation, no semicolons, trailing commas (Biome 2)
- No external runtime dependencies (see `auto-format` baseline)
- Credential loading pattern: env vars first (`CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`), fallback to `~/.unic-confluence.json` — mirrors `unic-confluence/scripts/push-to-confluence.mjs`
- Conventional commits: `feat(pr-review): …`
- `pnpm -w check` must pass before commit
- `pnpm --filter pr-review bump minor` bumps version + mirrors to marketplace.json

## Integration points

- `commands/review-pr.md` step 4 ends with changed files list known
- Step 4a runs after step 4, in parallel with steps 5–7
- Step 8 waits for 4a before launching review agents
- `scripts/confluence-client.mjs` is invoked by sub-agents inside step 4a via `node scripts/confluence-client.mjs <url>` or `node scripts/confluence-client.mjs --check-creds`
- ADO API for work items: `az devops invoke --area git --resource pullRequestWorkItems` + `az boards work-item show`
- Confluence v2 API: `GET {baseUrl}/wiki/api/v2/pages/{pageId}?body-format=storage` with Basic auth

## ADR references

- ADR-0010: inline Confluence client (self-contained `.mjs`, no shared package)
- ADR-0011: additive parallel paths for doc context extensibility (no plugin registry until third source type)
