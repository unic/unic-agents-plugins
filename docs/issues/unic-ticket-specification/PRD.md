# PRD: unic-ticket-specification

**Status:** resolved
**Plugin:** `apps/claude-code/unic-ticket-specification`
**Category:** plugin
**Tracking issue:** [unic/unic-agents-plugins#256](https://github.com/unic/unic-agents-plugins/issues/256)

A Claude Code plugin that packages a portable Archon workflow taking a tracker ticket from intake to
"ready for implementation" — tracker-agnostic (Jira, Azure DevOps, GitHub), multi-repo, and
OS-independent (Windows / macOS).

> Tracked retroactively to satisfy the Feature-first convention in `CONTRIBUTING.md`: the workflow
> was authored and tested in client projects and is now being
> brought into the shared `unic-agents-plugins` monorepo as a distributable plugin on branch
> `feature/add-ticket-specification-workflow`.

---

## Problem Statement

Unic teams repeatedly need to take a raw tracker ticket — an existing reference or a free-text
request — and groom it into something a developer or an AFK agent can implement: a clear,
template-shaped description, a classification (Bug vs Change-Request/Story), an effort estimate, and
a record of open questions. Doing this by hand is slow and inconsistent across clients, and each
client uses a different issue tracker (Jira, Azure DevOps, GitHub), a different number of code repos,
and a different OS. A project-specific `ticket-readiness` workflow proved the value but hardcoded one
tenant, project, and repo layout, so it could not be reused. There was no portable, installable
artifact a team could drop into any project.

---

## Solution

`unic-ticket-specification` ships the grooming workflow as a Claude Code plugin whose installable
bundle is its `.archon/` directory. The workflow is an 11-node Archon DAG: detect-input → analyze
(across all configured repos + linked docs) → classify → rewrite to the Bug or CR-Story template →
non-blocking completeness assessment → PERT estimate → persist locally → present draft → **human
approval gate** → apply (create or update) → report. All tracker/tenant/repo/OS variability lives in
a per-project config `.archon/ticket-spec.config.yaml`; nothing tracker-specific is in the workflow
or the seven `uts-*` command templates. Tracker access is MCP-first with a CLI fallback. A
`/unic-ticket-specification:setup` slash command makes installation zero-config: it asks a few
questions and writes the config and MCP server, so users never hand-edit YAML.

---

## User Stories

1. As a solution architect, I want to pass either an existing ticket reference (Jira key, ADO work-item id,
   GitHub issue) or a free-text description, and have the workflow detect which it is, so that one
   entry point covers both grooming and creation.
2. As a solution architect, I want the ticket analysed against all my configured code repos and linked docs,
   so that the rewritten description and estimate are grounded in the real codebase.
3. As a product owner, I want the description rewritten into our standard Bug or Change-Request/Story
   template, with a plain-language `### ToDo` separate from `### Suggested Technical Tasks`, so that
   business and technical audiences each get the right level of detail.
4. As a solution architect, I want a non-blocking completeness assessment that annotates gaps but never stops
   the run, so that incomplete tickets are still estimated, with caveats.
5. As a team lead, I want a three-point PERT effort estimate recorded on the ticket, so that planning
   has a defensible number.
6. As a reviewer, I want a mandatory human approval gate before anything is written to the tracker,
   with reject-and-revise up to three attempts, so that no automated content reaches the tracker
   without sign-off.
7. As a solution architect on any Unic project, I want the same workflow to work whether we use Jira, Azure
   DevOps, or GitHub, on Windows or macOS, across one or many repos, so that I learn it once.
8. As a solution architect installing the plugin, I want a `/setup` command that configures the project for
   me, so that I do not hand-edit YAML to get started.
9. As a solution architect, I want a full local copy of every proposal written under `output.dir`, so that the
   result survives a rejection or a failed tracker write.

---

## Implementation Decisions

- **Plugin location & packaging.** Lives at `apps/claude-code/unic-ticket-specification/`, mirroring
  `unic-archon-dlc`: the installable Archon assets sit under the plugin's `.archon/`, with plugin
  scaffolding (`.claude-plugin/`, `package.json`, `CHANGELOG.md`, `CONTEXT.md`, `AGENTS.md`,
  `CLAUDE.md` symlink, `README.md`) around them.
- **Tool-agnostic, config-driven.** See [ADR-0001](../../../apps/claude-code/unic-ticket-specification/docs/adr/0001-tool-agnostic-config-driven.md).
- **MCP-first, CLI fallback.** See [ADR-0002](../../../apps/claude-code/unic-ticket-specification/docs/adr/0002-mcp-first-cli-fallback.md).
- **Markdown-only descriptions.** See [ADR-0003](../../../apps/claude-code/unic-ticket-specification/docs/adr/0003-markdown-only-descriptions.md).
- **Setup is a conversational slash command, no JS lib.** See [ADR-0004](../../../apps/claude-code/unic-ticket-specification/docs/adr/0004-setup-conversational-no-lib.md).
- **Ship the config template only.** The bundle ships `ticket-spec.config.example.yaml`; the active
  `ticket-spec.config.yaml` is created per project and never committed to the shared plugin.
- **No LICENSE file.** Per the monorepo convention, the maintainer adds `LICENSE` files by hand.

---

## Testing Decisions

- This plugin ships **no JavaScript** — it is Archon workflow YAML, command Markdown, MCP JSON, and a
  config template — so it has no `node:test` suite. Quality gates are the repo's `pnpm ci:check`
  (Biome for JSON, Prettier for Markdown) and `pnpm --filter unic-ticket-specification
verify:changelog`.
- The workflow bundle itself was validated by real runs in multiple client projects
  before extraction.
- If `commands/setup.md` ever grows non-trivial config-merge logic, extract it to a tested `lib/`
  module and adopt the `unic-archon-dlc` delegation pattern (ADR-0004 names this trigger).

---

## Out of Scope

- Implementing the ticket, code review, or general Q&A — the workflow stops at "ready for
  implementation".
- Estimation methods other than PERT.
- Tracker backends beyond Jira, Azure DevOps, and GitHub.
- Tracker-specific rich markup (e.g. Jira ADF) — descriptions are Markdown only (ADR-0003).
- A non-interactive / headless variant of the approval gate — the human gate is mandatory.

---

## Further Notes

- The workflow is a generalisation of the project-specific `ticket-readiness` workflow; the
  generalisation (config extraction, multi-repo, multi-tracker) is the core of ADR-0001.
- The Jira `cloud_id` may be left empty and auto-resolved at runtime from `site_url`, so client
  tenants whose GUID is unknown work with no extra config.
