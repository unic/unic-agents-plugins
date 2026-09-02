# unic-ticket-specification — portable Archon workflow bundle

A generic version of `ticket-readiness`, usable by **any Unic project**
regardless of issue tracker (**Jira / Azure DevOps / GitHub**), source-control
host, number of code repos, or operating system (**Windows / macOS**).

It takes a ticket from intake to "ready for implementation": detect input →
fetch + analyse (across all configured repos + linked docs) → classify Bug vs
Change-Request/Story → rewrite to the configured template → non-blocking
completeness check → **PERT** estimate → persist locally → present draft →
**human approval gate** → write back to the tracker → report.

## How it stays generic

- **No tracker/tenant/repo/OS detail is hardcoded in the workflow.** It all lives
  in a per-project config: `.archon/ticket-spec.config.yaml`.
- **MCP-first, CLI fallback.** Tracker nodes load an MCP server from the fixed
  path `.archon/mcp/ticket-spec-tracker.json`. If no MCP is configured, commands
  fall back to the tracker CLI named in the config (`jira` / `az` / `gh`).
- **Multi-repo.** `repos:` lists one or many checkouts; analysis greps across all.
- **OS-independent.** Paths are relative + forward-slash; no shell-specific or
  OS-specific commands. Works the same on Windows and macOS.

## Files in this bundle

Copy these into a target project's `.archon/` to install:

```
.archon/
├─ workflows/
│  └─ unic-ticket-specification.yaml      # the DAG
├─ commands/
│  ├─ uts-analyze.md                      # fetch + analyse (3 trackers, N repos, docs)
│  ├─ uts-rewrite-bug.md                  # Bug template fill
│  ├─ uts-rewrite-crstory.md              # CR/Story template fill
│  ├─ uts-estimate.md                     # PERT estimate
│  ├─ uts-persist-local.md                # stable local copy of the proposal
│  ├─ uts-apply-create.md                 # create (post-approval, 3 trackers)
│  └─ uts-apply-update.md                 # update (post-approval, 3 trackers)
├─ mcp/
│  └─ ticket-spec-tracker.json            # tracker MCP server (per project)
├─ ticket-spec.config.example.yaml        # documented config template (copy → ticket-spec.config.yaml)
└─ unic-ticket-specification.README.md    # this file
```

> `ticket-spec.config.yaml` (the ACTIVE per-project config) is **not** part of the
> bundle — you create it per project in step 1 below by copying the `.example`.

## Per-project setup

**Recommended:** run `/unic-ticket-specification:setup` in Claude Code. It auto-detects the tracker
from the git remote, asks a few questions, and writes `ticket-spec.config.yaml` and the MCP server
for you — no hand-edited YAML. It is idempotent (re-run to fill gaps; pass `reconfigure` to start
over).

**Manual (3 steps)** if you prefer not to use `/setup`:

1. **Config.** Copy `ticket-spec.config.example.yaml` → `ticket-spec.config.yaml`
   and fill in: `tracker.type`, the matching tracker block (tenant/org/project),
   `repos`, `docs`, and (optionally) override `templates`.
2. **Access.** Either:
   - set `tracker.access.mcp: true` and put the right MCP server in
     `mcp/ticket-spec-tracker.json` (Atlassian / Azure DevOps / GitHub MCP), **or**
   - set `tracker.access.mcp: false` and `tracker.access.cli` to `jira`/`az`/`gh`
     (that CLI must be installed + authenticated on each machine).
3. **Run** it against the project, passing either an existing ticket reference or
   a free-text description of a new ticket.

## Notes

- The human approval gate is mandatory — nothing is written to the tracker until
  you approve. Rejecting with feedback revises the draft/estimate/target and
  re-presents (up to 3 attempts).
- A full local copy of every proposal is written under `output.dir`
  (default `ticket-spec-output/`) so results survive rejection or failure.
- This bundle lives in the shared `unic-agents-plugins` repo and ships only the
  config **template** (`ticket-spec.config.example.yaml`). Each project copies it to
  `ticket-spec.config.yaml` and fills in its own tracker/repo detail; the active
  config is never committed to the shared bundle.
