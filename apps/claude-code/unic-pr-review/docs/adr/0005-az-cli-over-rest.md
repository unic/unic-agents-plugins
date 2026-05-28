# `az` CLI for Azure DevOps, custom HTTP for Atlassian

ADO Fetcher and ADO Writer shell out to `az devops invoke` for every Source Platform operation. Confluence and Jira are accessed via direct HTTPS calls in a Node script because Atlassian's Cloud REST endpoints are stable, JSON-native, and authenticated with a static token — no first-party CLI worth the dependency.

## Considered options

- **REST everywhere via Node fetch.** Rejected for ADO — the ADO REST surface is broad, evolves per-org, and requires resolving organisation, project, repository, and PR IDs through several round-trips. The `az` CLI handles all of that, ships with the user's existing auth context (`az login`), and is already trusted by the developer community.
- **`az` CLI for Atlassian too (via a community wrapper).** Rejected — no first-party or widely-trusted CLI exists for Confluence v2 or Jira Cloud; pinning a community wrapper would add a runtime dep with weaker stability guarantees than calling the REST API directly.

## Consequences

- The Plugin's external dependency footprint is `az` CLI + the `azure-devops` extension. The Doctor command verifies both.
- Atlassian fetching lives in a small in-repo Node script using `node:fetch` and the shared Credential File loader — no `marked`-class runtime deps.
- Future GitHub or GitLab support will pick the right CLI/REST balance per-Platform; there is no global doctrine that all Source Platforms must use a CLI.
