# unic-spec-review

A Claude Code plugin for **adversarial review of web specifications**. Given Confluence spec pages (parent + children), Figma designs, and the live production system, it runs a multi-agent review (eight technical dimensions plus Green/Yellow/Red perspective lenses from the Six Thinking Hats) and produces Confidence-scored, hat-tagged Findings.

Findings are presented for triage first. With `--post`, an interactive Approval Loop lets you select which Findings to publish as Confluence comments (inline-anchored where possible, footer fallback), with content-similarity de-duplication against existing comments so repeated runs by multiple reviewers don't pile up duplicates.

The plugin is fully self-contained: it ships its own `/setup-confluence` wizard and vendored credential handling, so it can be installed and used without any other plugin. It stores credentials in `~/.unic-confluence.json` (the same convention `unic-pr-review` uses, or `CONFLUENCE_*` env vars), so a user with both plugins configures Confluence once. Figma access is via the Figma Dev Mode MCP; live-system access is via the Playwright MCP. Both are discovered at runtime.

> **S8 available:** pass a single Confluence page URL to run a full eleven-agent adversarial review, then use `--post` to open the multi-Finding Approval Loop — select comma-separated Finding numbers, review near-duplicate flags (`[~near-dup]` / `[~likely-dup]`) backed by Jaccard similarity against existing page comments, and post approved Findings as inline-anchored Confluence comments (or page-level footer fallback). Figma and live-system inspection are deferred to later slices. See `docs/issues/` for the roadmap.
