# 0019. GPG tag signing is opt-in via UNIC_SIGN_TAGS repository secret

**Status:** Accepted (2025-04)

## Context

Signed git tags provide provenance guarantees but require GPG keys to be set up in the CI environment. Mandatory signing would block contributors who have not configured GPG.

## Decision

`unic-tag` and the release workflow sign tags only when the `UNIC_SIGN_TAGS` environment variable / repository secret is set to a truthy value. When absent, tags are created unsigned.

## Consequences

- Local `pnpm --filter <name> tag` runs without GPG by default.
- CI can be configured to sign by adding the `UNIC_SIGN_TAGS` secret to the GitHub repository.
- Verifying tag signatures requires the public key to be distributed separately.
