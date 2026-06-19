---
description: Fetch (if existing) and analyze a ticket against the configured code repos and linked docs; surface gaps, ambiguities, and open questions. Tracker-agnostic (Jira / Azure DevOps / GitHub).
argument-hint: <ticket reference or free-text ticket description>
---

# Ticket fetch + analysis

You are preparing a ticket for implementation readiness. This step gathers all
context. Do **not** write anything back to the tracker.

## Inputs

- Original user input: `$ARGUMENTS`
- Detected input (JSON: `mode` = existing|create, `key`, `project`): `$detect-input.output`
- **Project config: read `.archon/ticket-spec.config.yaml` FIRST** — it defines
  the tracker type, access method, repos, docs source, and tenant/org/project.

Everything tracker- and project-specific comes from that config. Do not assume a
particular tracker, tenant, or repo layout.

## Tooling: MCP-first, CLI fallback (OS-independent)

- If `tracker.access.mcp` is `true`, a tracker MCP server is loaded for this
  node. Prefer its tools. The server may need a moment to start (npx cold
  start) — if its tools are not visible on your first attempt, wait briefly and
  retry before giving up.
- Otherwise (or if MCP tools never appear), fall back to the CLI named in
  `tracker.access.cli` via Bash. Use only portable, non-interactive commands
  that work the same on Windows and macOS (no shell-specific syntax, no
  OS-specific paths). Examples per tracker:
  - jira → Atlassian MCP, else `jira issue view <key> --plain`
  - az → `az boards work-item show --id <id> --output json` (Azure DevOps)
  - gh → `gh issue view <number> --repo <owner/repo> --json ...` (GitHub)

## Jira cloudId resolution (jira tracker only)

If `tracker.type` is `jira` and `tracker.jira.cloud_id` is **empty**, resolve it
ONCE before any Jira/Confluence call: invoke `getAccessibleAtlassianResources`
and pick the resource whose `url` matches `tracker.jira.site_url`; use that `id`
as the cloudId everywhere below. (If only one resource is returned, use it.) If a
non-empty `cloud_id` is configured, use it directly. The same resolved cloudId
applies to Confluence when `docs.type` is `confluence`.

## Step 0 — Fetch the ticket (existing path only)

If `$detect-input.output.mode` is `existing`, fetch the ticket FIRST, then write
it to `$ARTIFACTS_DIR/ticket.md`. Use the method for `tracker.type`:

- **jira**: `getJiraIssue` (cloudId from `tracker.jira.cloud_id`, issue key from
  `$detect-input.output.key`) for summary, description, issue type, status,
  comments; `getJiraIssueRemoteIssueLinks` to discover linked pages.
- **azure-devops**: fetch the work item by id (`tracker.azure_devops.org_url` +
  `project`) for title, description/repro steps, work-item type, state,
  comments, and linked artifacts.
- **github**: fetch the issue from `tracker.github.issues_repo` by number for
  title, body, labels, state, and comments.

Write the fetched content (summary/title, type, status, full description,
relevant comments, links) to `$ARTIFACTS_DIR/ticket.md`. Record the exact
**issue type name** at the top of that file (e.g. `Issue type: Bug`).

If `mode` is `create`, there is no ticket to fetch — skip this step.

## Step 0b — Resolve the target

Decide where the ticket belongs and write `$ARTIFACTS_DIR/target.json`:

```
{
  "mode": "create" | "existing",
  "tracker": "jira" | "azure-devops" | "github",
  "project_key": "<Jira project key | ADO project | GitHub owner/repo>",
  "project_name": "<human name>",
  "key": "<existing reference, else empty>",
  "reason": "<one line: why this target>"
}
```

- `tracker` = `tracker.type` from config.
- **Existing**: `key` = `$detect-input.output.key`. `project_key` =
  - jira: the key prefix of that reference;
  - azure-devops: `tracker.azure_devops.project`;
  - github: `tracker.github.issues_repo`.
- **Create**:
  - jira: if `$detect-input.output.project` is non-empty use it; else if the
    input names a project use that; else use `tracker.jira.default_project`.
    (If the tracker exposes a project list and the right one is ambiguous, you
    may call `getVisibleJiraProjects` to pick the best match; fall back to the
    default and say so in `reason`.)
  - azure-devops: `tracker.azure_devops.project`.
  - github: `tracker.github.issues_repo`.
  - `key` = "".

This `target.json` is authoritative for the apply step and is shown to the human
at the approval gate, who can override it.

## Step 1 — Analyze

1. **Establish the subject.**

   - Existing path: use `$ARTIFACTS_DIR/ticket.md` as the source of truth.
   - Create path: use `$ARGUMENTS` as the raw requirement.

2. **Explore the code — ACROSS ALL configured repos.** Iterate over every entry
   in `repos` from the config. For each, resolve its `path` (relative to the
   working directory or absolute; treat paths as forward-slash, OS-neutral) and
   use Read / Grep / Glob within it to locate the components, modules, services
   or pages this ticket touches. Identify:

   - The concrete files / areas that would change (note **which repo** each is in).
   - Existing patterns or prior art for the requested behaviour.
   - Technical constraints, dependencies, and cross-repo integration points.

   If a configured repo path does not exist on this machine, note it as a gap and
   continue with the repos that are present — never fail the analysis over a
   missing checkout.

3. **Pull linked documentation** according to `docs.type`:

   - `confluence`: fetch linked/related pages with `getConfluencePage` /
     `searchConfluenceUsingCql` (cloudId from `docs.confluence.cloud_id`).
   - `azure-wiki`: fetch the relevant wiki pages from the Azure DevOps project.
   - `github-wiki`: read the repo wiki / docs.
   - `none`: skip.
     Summarise anything that affects scope or acceptance criteria.

4. **Identify gaps.** Explicitly list missing information,
   ambiguities/contradictions, assumptions you would have to make, and open
   questions for the requester / PO.

## Output

Write a structured analysis to **`$ARTIFACTS_DIR/analysis.md`** with these sections:

```
# Analysis: <ticket summary>

## Subject & intent
## Affected code areas
- <repo>: <file/module> — <why it is relevant>

## Linked documentation
## Technical constraints & dependencies
## Open questions
- [ ] <question>

## Assumptions
- <assumption>
```

Cite `repo:file_path:line` references where you found relevant code. This
analysis (plus `ticket.md`) is the foundation for classification, the rewritten
description, and the estimate — capture everything that affects scope.

After writing the file(s), print a one-paragraph summary of the key findings and
the number of open questions to your output.
