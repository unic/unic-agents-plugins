# 0011. Aliases auto-populate in confluence-pages.json on first publish by numeric ID

**Status:** Accepted (2025-04)

## Context

`confluence-pages.json` is initially configured with bare page IDs, which are not human-readable. Requiring authors to manually add slugified aliases is tedious.

## Decision

On the first successful publish of a page identified by its numeric ID, the script fetches the page title from Confluence, slugifies it, and writes an alias key back into `confluence-pages.json`. Subsequent publishes can reference the page by either the numeric ID or the alias.

## Consequences

- `confluence-pages.json` becomes progressively more readable as pages are published.
- The script must have write access to `confluence-pages.json` at publish time.
- An alias collision (two pages with the same slugified title) must be detected and rejected.
