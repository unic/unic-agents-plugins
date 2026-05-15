# unic-archon-dlc

A Claude Code Plugin shipping six Archon YAML workflows covering the full AI development lifecycle.

## Language

**DlcConfig**:
The machine-readable configuration object persisted to `.archon/unic-dlc.config.json` in the target project. Drives workflow behaviour across all six lifecycle phases.
_Avoid_: plugin config, settings file

**IssueTracker**:
The backend used to record and track work items. Supported values: `github`, `ado`, `jira`, `local`. Determines which CLI commands the tracker adapter emits.
_Avoid_: issue system, ticket system

**BranchingStrategy**:
The git workflow adopted by the target project. Supported values: `gitflow`, `github-flow`. Governs branch naming and PR target conventions described in `docs/agents/branching.md`.
_Avoid_: git flow, branching model

**Workflow**:
One of the six Archon YAML DAG files shipped by the plugin: `explore`, `plan`, `build`, `qa`, `cleanup`, `triage`. Each workflow is a file under `.archon/workflows/` invoked via `archon run <name>`.
_Avoid_: pipeline, process, script

**WorkflowNode**:
A single step inside a Workflow YAML file. Nodes have a `type` (prompt, bash, loop) and optional `depends_on` links that form the DAG edges.
_Avoid_: step, task, job

**Gate**:
A WorkflowNode with `interactive: true` that pauses execution and waits for human terminal input before the Archon runtime continues. Gates are placed at every phase boundary where human judgement is required.
_Avoid_: checkpoint, approval step, human-in-the-loop node

**Artifact**:
A persistent file written to `docs/workflow/<slug>/` during workflow execution. Artifacts are committed to the repository and survive across context windows. Examples: `findings.md`, `PRD.md`, `issues.json`, `report.md`.
_Avoid_: output file, result, log

**Slug**:
A short, URL-safe identifier for a feature being developed through the lifecycle. Used as the directory name under `docs/workflow/<slug>/` and as the suffix of the generated build workflow (`build-<slug>.yaml`).
_Avoid_: feature name, project name, branch name

## Relationships

- A **DlcConfig** drives exactly one **IssueTracker** adapter and one **BranchingStrategy** convention
- Each **Workflow** is a DAG of **WorkflowNode**s connected by `depends_on` edges
- **Gates** are specialised **WorkflowNode**s that pause the **Workflow** for human approval
- **Artifacts** are produced by **WorkflowNode**s and persisted under `docs/workflow/<Slug>/`
- The **Slug** is the link between a feature's transient workflow state (`$ARTIFACTS_DIR`) and its persistent **Artifacts**

## Example dialogue

> **Dev:** "Should the plan workflow proceed to yaml-gen if the plan-checker finds issues?"
> **Domain expert:** "No. The plan-checker loop runs up to three iterations to resolve consistency issues. If the issue count does not decrease between iterations — a stall — the workflow escalates to a Gate immediately rather than burning remaining retries."
