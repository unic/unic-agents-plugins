# Azure DevOps Provider

The `azure_devops` Source Platform Provider bundle (ADR-0010). It is the first
concrete Provider for `unic-pr-review` and supplies everything the orchestrator
needs to read an Azure DevOps PR.

## Matched URLs

`prUrlPattern` matches both ADO URL flavours:

- `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<id>`
- `https://<org>.visualstudio.com/<project>/_git/<repo>/pullrequest/<id>` (legacy)

Non-PR ADO URLs and other hosts (GitHub, GitLab) do not match.

## `parsePrUrl(url)`

Returns the addressable parts of a PR:

```json
{ "orgUrl": "https://dev.azure.com/myorg", "project": "myproject", "repo": "myrepo", "prId": 42 }
```

Throws `Not an ADO PR URL: <url>` when the URL does not match `prUrlPattern`.

## `discoverWorkItems(workItemRefs)`

Takes the `workItemRefs` array hoisted by the ADO Fetcher to `FETCHER_OUTPUT.workItemRefs`
(top-level, not nested in `prMetadata`) and normalises each entry to
`{ id, type: "ado-work-item", url, raw }`. It never regex-scrapes the PR
description — work-item discovery is a Provider contract (ADR-0001 amendment, ADR-0010 amendment).

Throws when `workItemRefs` is not an array (including `undefined` from an absent key).
The orchestrator's loud-Notice path (`review-pr.md` Step 1.5) is the only way to reach
`WORK_ITEMS = []` when `FETCHER_OUTPUT.workItemRefs` is absent — this function must not
silently swallow data-loss.

Returns the normalised array (empty `[]` when the input array is empty — legitimate no-WI case).

## Registered agents

| Role    | Agent name                                        |
| ------- | ------------------------------------------------- |
| fetcher | `unic-pr-review:ado-fetcher`                      |
| writer  | `unic-pr-review:ado-writer` (not yet implemented) |

## Adding fixtures

PR-metadata fixtures live in `fixtures/`. They mirror the `az devops invoke --area git --resource pullrequests`
ADO wire-format response. `workItemRefs` is a top-level field on the fixture object (not nested inside
`prMetadata`) — it is fetched separately from the `pullrequestworkitems` endpoint and emitted by the Fetcher
as a top-level `FETCHER_OUTPUT` field. Pass `fixture('...').workItemRefs` directly to `discoverWorkItems`.
Add a new fixture file and reference it from `tests/provider.test.mjs` via the `fixture(name)` helper. The
`fixtures/ado-cli-inventory.json` file catalogues every `az devops invoke` call the ADO Fetcher agent emits;
the root `tests/ado-cli-smoke.test.mjs` asserts the agent and the inventory stay in sync.
