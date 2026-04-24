# 17. Add "Do Not Add" Section to `CLAUDE.md`

**Priority:** P2
**Effort:** S
**Depends on:** none
**Touches:** `CLAUDE.md`

## Context

The repo's `CLAUDE.md` accurately documents what the codebase does and how it works, but says nothing about what is intentionally out of scope. Without an explicit boundary, AI contributors (and new human contributors) are likely to propose or implement features that sound reasonable on the surface but would undermine the plugin's deliberate simplicity. Examples of this drift that have already appeared in other Confluence tool projects: image upload pipelines, create-page support, multi-instance config schemas, MCP server wrappers. Each of these is a plausible extension but each also significantly expands the attack surface, the configuration schema, and the maintenance burden. A `## Do not add` section in `CLAUDE.md` is the correct place to document these decisions because it is the first file Claude reads when starting a session in this repo. The section converts implicit architectural decisions into explicit, machine-readable policy.

## Current behaviour

`CLAUDE.md` ends after the `## Naming convention` section:

```markdown
## Naming convention

| Surface           | Value                        |
| ----------------- | ---------------------------- |
| GitHub repo       | `unic-claude-code-<service>` |
| Plugin identifier | `unic-<service>`             |
| npm package name  | `unic-<service>`             |
```

(End of file — no "Do not add" or "Out of scope" section exists.)

To verify:
```sh
tail -15 CLAUDE.md
# Shows naming convention table, then EOF
```

## Target behaviour

`CLAUDE.md` has a new `## Do not add` section appended after `## Naming convention`. The section lists eight categories of features that are explicitly out of scope, each with a concise rationale. The final paragraph gives a decision rule for anything not on the list.

The existing content of `CLAUDE.md` is untouched.

## Implementation steps

### Step 1 — Append section to `CLAUDE.md`

Open `CLAUDE.md` and append the following block after the last line of the `## Naming convention` table:

```markdown

## Do not add

The following are explicitly out of scope for this plugin. Do not implement them without first opening a GitHub issue and getting explicit sign-off from the maintainer:

- **Image upload / attachments** — walking the Markdown AST to find local image references and uploading them via `/wiki/rest/api/content/{id}/child/attachment` is significant work that requires a new CLI subcommand, a new content-negotiation path, and multi-part form handling. Defer until a user explicitly requests it with a concrete use case.

- **Create-page support** — the script only updates existing pages. Adding `POST /wiki/api/v2/pages` with `spaceId` + `parentId` requires a schema change to `confluence-pages.json` (value becomes an object, not just a page ID integer), complicating every code path that reads the file. Defer unless there is real demand.

- **Multi-space or cross-instance publishing** — `confluence-pages.json` maps keys to page IDs, and page IDs are unique per Confluence instance. Supporting multiple Confluence instances would require a different config schema (e.g. a `baseUrl` field per entry) and credential routing logic. Out of scope.

- **MCP server** — there is no benefit to wrapping this plugin's functionality in a Model Context Protocol server. The slash command is the correct and sufficient surface. An MCP server would add a process lifecycle, a transport layer, and a versioned protocol schema for zero user-visible benefit.

- **Agents or sub-agents** — the publish task is a deterministic one-shot sequence: read file → convert Markdown → GET page → inject → PUT page. There is no branching, no tool-selection, and no iteration. Agent autonomy adds complexity without value here.

- **Recursive directory publishing** — publishing all Markdown files under a directory tree in one command (e.g. `node push-to-confluence.mjs docs/`) requires mapping every file to a page ID, handling partial failures, and defining rollback semantics. The complexity grows faster than the value. Publish one file at a time.

- **Changesets or release-please** — the `sync-version.mjs` script (spec 06) is sufficient for one package with two version fields. Do not add a release-management framework (Changesets, release-please, semantic-release) — the overhead exceeds the benefit for a single-file plugin.

- **Watch mode / file-watcher** — a flag like `--watch` that re-publishes on file change is not appropriate for a Confluence publishing tool. Confluence is not a live preview target; each publish increments the page version and creates a revision in Confluence's history. Accidental rapid publishes would pollute the revision history.

When in doubt: if the feature is not in the existing `scripts/push-to-confluence.mjs` command set and is not listed in an open `docs/plans/` spec, it is out of scope. Open a GitHub issue before starting implementation.
```

No other changes to `CLAUDE.md`.

## Test cases

| Check | Expected result |
|---|---|
| `grep "Do not add" CLAUDE.md` | At least one match |
| `grep "Image upload" CLAUDE.md` | One match |
| `grep "Create-page" CLAUDE.md` | One match |
| `grep "MCP server" CLAUDE.md` | One match |
| `grep "Agents" CLAUDE.md` | One match |
| `grep "Recursive directory" CLAUDE.md` | One match |
| `grep "Changesets" CLAUDE.md` | One match |
| `grep "Watch mode" CLAUDE.md` | One match |
| Existing sections (`## What this repo is`, `## Key files`, etc.) still present | Yes |
| Naming convention table still present | Yes |
| No new files created | Yes |

## Acceptance criteria

- [ ] `CLAUDE.md` contains a `## Do not add` section.
- [ ] The section appears after `## Naming convention` (at the end of the file).
- [ ] The section covers all eight categories: image upload, create-page, multi-instance, MCP server, agents, recursive directory publishing, changesets, and watch mode.
- [ ] Each category has a one-sentence rationale (not just a label).
- [ ] The section ends with a decision rule for unlisted features.
- [ ] The existing `CLAUDE.md` sections are unchanged.
- [ ] No new files are created by this spec.

## Verification

```sh
# 1. Confirm "Do not add" section exists
grep -n "## Do not add" CLAUDE.md
# Expected: one match near the end of the file

# 2. Confirm all eight categories are present
grep -c "Image upload\|Create-page\|Multi-space\|MCP server\|Agents\|Recursive directory\|Changesets\|Watch mode" CLAUDE.md
# Expected: 8

# 3. Confirm existing sections are still present
grep "## What this repo is\|## Key files\|## Running\|## Content injection\|## Credentials\|## Plugin versioning\|## Naming convention" CLAUDE.md | wc -l
# Expected: 7

# 4. Confirm "Do not add" is the last section
tail -30 CLAUDE.md | grep "^## "
# Expected: "## Do not add" is the only heading in the last 30 lines

# 5. No uncommitted changes to other files
git diff --name-only
# Expected: only CLAUDE.md
```

## Out of scope

- Do not modify any existing `CLAUDE.md` sections.
- Do not move implementation guidance from `docs/plans/` into `CLAUDE.md` — specs belong in `docs/plans/`.
- Do not add a "Do add" or "Planned features" section — that information lives in `docs/plans/`.
- Do not add links to GitHub issues (none exist yet for these items).
- No changes to `scripts/`, `commands/`, `.claude-plugin/`, or any other file.

## Follow-ups

- After spec 06 (version sync script) lands, remove the `sync-version.mjs` forward-reference from the Changesets bullet and replace with a direct description of what that script does.
- If any of the eight "Do not add" items is eventually accepted and specced out, remove it from this section and add a note: "This item was deferred — see spec NN."
- Consider adding a `## Canonical patterns` section to `CLAUDE.md` documenting the positive analogs to the "do not add" list (e.g. "add new CLI subcommands as `if (args[0] === "--foo")` branches in `main()`").

_Ralph: append findings here._
