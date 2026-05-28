# 0003. Environment variable override for all credential fields

**Status:** Accepted (2026-05)

## Context

CI pipelines and Docker environments cannot place files in `~/.unic-confluence.json` or `~/.unic-azure.json`. Env vars are the standard mechanism for injecting secrets in those contexts.

## Decision

`credentials.mjs` resolves each field by checking env vars first, then falling back to the credential file. The env vars are: `CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`, `JIRA_URL`, `AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PAT`.

## Consequences

- Env vars always win — a set env var cannot be overridden by a file (intentional; env vars are explicit).
- Partial env-var overrides are allowed: a Consumer can set only `CONFLUENCE_TOKEN` and leave the rest in the file.
- Tests can inject credential values via env vars without touching the filesystem.
