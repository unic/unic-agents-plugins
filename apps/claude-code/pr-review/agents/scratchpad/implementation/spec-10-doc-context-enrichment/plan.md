# Plan — Spec 10: Doc Context Enrichment

## Step 1 — Create `scripts/confluence-client.mjs`

- **Demoable outcome**: `node scripts/confluence-client.mjs --check-creds` exits 0 when creds present (or non-zero with clear message when absent). `node scripts/confluence-client.mjs <url>` prints Confluence storage XML to stdout.
- **Subtask wave**:
  - Create `scripts/confluence-client.mjs` with `loadCredentials()`, `fetchPageText()`, and CLI entry point (handles `--check-creds` and `<url>` args).

## Step 2 — Edit `commands/review-pr.md`

- **Demoable outcome**: Step 4a appears between step 4 and step 5 in the command; step 8 agent prompts receive `{DOC_CONTEXT}` preamble; `WebFetch` is in `allowed-tools`.
- **Subtask wave**:
  - Insert step 4a (work item fetch + Doc Context Sub-agent spawning logic) after step 4.
  - Inject `DOC_CONTEXT` block into step 8 agent prompt templates and add `WebFetch` to `allowed-tools` frontmatter.

## Step 3 — Finalize

- **Demoable outcome**: `pnpm -w check` passes; `pnpm --filter pr-review verify:changelog` passes; spec marked done; single conventional commit created.
- **Subtask wave**:
  - Update `CHANGELOG.md`, bump version to 0.9.0, mark spec done in `docs/plans/10-doc-context-enrichment.md`, update `docs/plans/README.md` spec-10 row → done, run all verifications, git commit.
