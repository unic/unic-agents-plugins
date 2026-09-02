# Tool-agnostic, config-driven workflow

**Status:** Accepted (2026-06)

`unic-ticket-specification` is a generalisation of a project-specific `ticket-readiness` workflow into
a single bundle usable by **any** Unic project regardless of issue tracker (Jira, Azure DevOps,
GitHub), source-control host, number of code repos, or operating system (Windows / macOS). All
project-specific variability lives in a per-project config file, `.archon/ticket-spec.config.yaml`.
The workflow YAML and the seven `uts-*` command templates contain **no** tracker name, tenant,
cloud id, repo path, or OS-specific command.

## Considered options

- **One workflow per tracker (jira-ticket-spec, ado-ticket-spec, …)** — rejected. Three near-identical
  DAGs would drift, triple the maintenance, and still not cover multi-repo or per-client template
  differences. The branching that genuinely differs between trackers is small (fetch / create /
  update) and is better isolated inside command templates that read the config than duplicated across
  whole workflows.

- **Bake the active project's config into the workflow** (the original `ticket-readiness` shape)
  — rejected. It is exactly what blocks reuse: tenant URLs, project keys, and repo paths hardcoded in
  the DAG mean every new project forks the file. Extracting them into config is the whole point of the
  generalisation.

- **Tool-agnostic config file as the single source of variability** — chosen. `tracker.type` selects
  the tracker block; `repos[]` lists one or many checkouts; `docs` names the linked-documentation
  source; `classification` maps tracker issue-type names to template kinds; `templates` lets a client
  override the Bug / CR-Story shapes. The workflow reads this file at runtime and stays generic.

## Consequences

- The workflow and commands must never reference a concrete tracker/tenant/repo/OS. New tracker
  behaviour is added by reading a new config key, not by editing the DAG topology.
- A project installs the plugin by copying the bundle and filling in the config — see
  [ADR-0004](0004-setup-conversational-no-lib.md) for the `/setup` command that does this without
  hand-editing YAML.
- Only the config **template** (`ticket-spec.config.example.yaml`) ships in the bundle; a populated
  `ticket-spec.config.yaml` is created per project and never committed to the shared plugin.
- The Jira `cloud_id` may be left empty and auto-resolved at runtime from `site_url`, so client
  tenants whose GUID is unknown still work with no extra config.
