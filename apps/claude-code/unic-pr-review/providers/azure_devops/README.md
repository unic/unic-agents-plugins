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

## `discoverWorkItems(prMetadata)`

Reads the PR's **native** `workItemRefs` field and normalises each entry to
`{ id, type: "ado-work-item", url, raw }`. It never regex-scrapes the PR
description — work-item discovery is a Provider contract (ADR-0001 amendment).
Returns `[]` when `workItemRefs` is empty or absent.

## Registered agents

| Role    | Agent name                                        |
| ------- | ------------------------------------------------- |
| fetcher | `unic-pr-review:ado-fetcher`                      |
| writer  | `unic-pr-review:ado-writer` (not yet implemented) |

## Adding fixtures

PR-metadata fixtures live in `fixtures/`. They mirror the shape returned by
`az devops invoke --area git --resource pullrequests`. Add a new fixture file and
reference it from `tests/provider.test.mjs` via the `fixture(name)` helper. The
`fixtures/ado-cli-inventory.json` file catalogues every `az devops invoke` call
the ADO Fetcher agent emits; the root `tests/ado-cli-smoke.test.mjs` asserts the
agent and the inventory stay in sync.
