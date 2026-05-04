# 0005. --ping / --check-auth replaces per-page --verify for auth probing

**Status:** Accepted (2025-04)

## Context

An earlier design included a `--verify` flag that fetched N pages to confirm they were accessible. This was slow (N Confluence API round-trips) and gave a vague failure signal when one of N pages was inaccessible.

## Decision

Replace per-page verification with a single `--ping` / `--check-auth` flag that calls a lightweight Confluence API endpoint (e.g. `GET /rest/api/user/current`). One round-trip confirms auth and connectivity.

## Consequences

- Auth check is O(1) regardless of the number of pages configured.
- The check does not verify page-level access (read/write permissions per page).
- CI pipelines should run `--check-auth` on startup rather than `--verify`.
