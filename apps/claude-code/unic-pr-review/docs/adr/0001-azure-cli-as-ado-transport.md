# 0001. Azure CLI as the ADO transport

**Status:** Accepted (2026-05)

## Context

The Plugin must call Azure DevOps APIs to fetch PR diffs, post comments, and query work items. The two options are: (a) direct REST calls over HTTPS using a PAT, or (b) shelling out to the `az devops` CLI extension.

## Decision

All ADO API calls go through `az devops` subcommands. The Plugin never makes direct HTTP requests to the ADO REST API.

## Consequences

- Authentication is handled entirely by the Azure CLI credential cache — the Plugin does not manage tokens directly.
- Consumers must have `az` and the `azure-devops` extension installed (verified by the doctor command).
- The Plugin cannot easily run in environments where the CLI is unavailable (e.g., GitHub Actions without the az setup step).
- Subprocess output parsing is required for all ADO data; error handling must interpret az exit codes.
