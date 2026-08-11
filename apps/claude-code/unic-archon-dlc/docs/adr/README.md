# ADRs — unic-archon-dlc plugin

Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root. See the root `docs/adr/README.md` for format and numbering conventions.

## Index

| ID   | Title                                                                                      | Status                              |
| ---- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| 0001 | Setup is a slash command delegating to `lib/install-runner.mjs`                            | Superseded by ADR-0019              |
| 0002 | Each plugin has its own Ralph loop with its own ralph.yml and PROMPT.md                    | Superseded by ADR-0009              |
| 0003 | Spec template format for Ralph-executable specs                                            | Superseded by ADR-0009              |
| 0004 | Ralph implements one spec per iteration, then commits and stops                            | Superseded by ADR-0009              |
| 0005 | `/tdd` for behavioral specs, direct for structural ones, dispatched by `Version impact:`   | Accepted                            |
| 0006 | Feature Runner injects a scoped context bundle into every `/tdd` sub-agent invocation      | Superseded by ADR-0010              |
| 0007 | `## Blocked by` is the canonical sequencing signal for Feature Runner issue execution      | Accepted                            |
| 0008 | Feature Runner invokes `/tdd` non-interactively; acceptance criteria replace planning      | Superseded by ADR-0010              |
| 0009 | Retire ralph-orchestrator; adopt unic-archon-dlc as the Feature Runner                     | Accepted                            |
| 0010 | Retire the `/implement-feature` skill; Feature Runner backed solely by `unic-dlc-build`    | Accepted                            |
| 0011 | Archon version target (≥ 0.5.0) and key-discriminated node-schema conventions              | Accepted; floor amended by ADR-0033 |
| 0012 | Fresh-context red/green separation for anti-cheating                                       | Accepted                            |
| 0013 | Issue tracker is the single source of truth; HANDOFF.md/ROADMAP.md dropped                 | Accepted                            |
| 0014 | Workflow-per-box decomposition                                                             | Accepted; revised by ADR-0017       |
| 0015 | `workflows/<slug>/` is the artifact home                                                   | Accepted                            |
| 0016 | DLC is a thin process layer; compose team system-skills for the _how_                      | Accepted; amended by ADR-0030       |
| 0017 | Container follows structural need (Archon for AFK, commands/skills for interactive)        | Accepted                            |
| 0018 | Generic core + per-project config; tested lib only for tracker-agnostic deterministic IP   | Accepted                            |
| 0019 | Conversational `/setup` + one thin tested schema lib                                       | Accepted                            |
| 0020 | `/specs` reaches an aligned PRD by branch-on-input                                         | Accepted (amended)                  |
| 0021 | A box ships only if it adds value; reference verbatim skills                               | Accepted; amended by ADR-0030       |
| 0022 | `/tickets` slices a PRD into build-ready issues; `/build` consumes them via a generic loop | Accepted                            |
| 0023 | `/build` is one generic red/green loop; dag-builder dissolved                              | Accepted (amended #281)             |
| 0024 | `/triage` is the intake on-ramp; thin wrapper binds Matt's method to DLC config            | Accepted                            |
| 0025 | `/qa` is an Archon pipeline with two config-gated approvals + an issue-producing on-ramp   | Accepted                            |
| 0026 | `/pr-review` is a generic fan-out Archon workflow harvesting unic-pr-review's learnings    | Accepted (amended #281)             |
| 0027 | `/improve-architecture` is a skill composing Matt's method + owns ADR superseding          | Accepted                            |
| 0028 | `/cleanup` is the repo-global operational janitor; retires the legacy cleanup workflow     | Accepted                            |
| 0029 | `/explore` is an off-line research + AFK-spike on-ramp; findings.md is the /specs baton    | Accepted (amended #281)             |
| 0030 | The DLC is a Harness hosting Methods; a Box survives only for what no Method can supply    | Accepted                            |
| 0031 | Methods are bundled, the plugin version is the pin, resolution is three-tier               | Accepted                            |
| 0032 | Vocabulary: Box, Method, Local Method, Bundle; config is parameters, a Method is procedure | Accepted                            |
| 0033 | Archon 0.7.0 schema target — floor bump, always_run, sub-runs deferred                     | Accepted                            |
| 0034 | The evidence gate is a deterministic script writer, never a self-judging prompt            | Accepted                            |
| 0035 | `/archon-upgrade` reports Archon-release impact; read-only, cites 0011/0033 by reference   | Accepted                            |
