# ADRs — unic-archon-dlc plugin

Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root. See the root `docs/adr/README.md` for format and numbering conventions.

## Index

| ID   | Title                                                                                    | Status                 |
| ---- | ---------------------------------------------------------------------------------------- | ---------------------- |
| 0001 | Setup is a slash command delegating to `lib/install-runner.mjs`                          | Accepted               |
| 0002 | Each plugin has its own Ralph loop with its own ralph.yml and PROMPT.md                  | Superseded by ADR-0009 |
| 0003 | Spec template format for Ralph-executable specs                                          | Superseded by ADR-0009 |
| 0004 | Ralph implements one spec per iteration, then commits and stops                          | Superseded by ADR-0009 |
| 0005 | `/tdd` for behavioral specs, direct for structural ones, dispatched by `Version impact:` | Accepted               |
| 0006 | Feature Runner injects a scoped context bundle into every `/tdd` sub-agent invocation    | Superseded by ADR-0010 |
| 0007 | `## Blocked by` is the canonical sequencing signal for Feature Runner issue execution    | Accepted               |
| 0008 | Feature Runner invokes `/tdd` non-interactively; acceptance criteria replace planning    | Superseded by ADR-0010 |
| 0009 | Retire ralph-orchestrator; adopt unic-archon-dlc as the Feature Runner                   | Accepted               |
| 0010 | Retire the `/implement-feature` skill; Feature Runner backed solely by `unic-dlc-build`  | Accepted               |
| 0011 | Archon version target (≥ 0.5.0) and key-discriminated node-schema conventions            | Accepted               |
| 0012 | Fresh-context red/green separation for anti-cheating                                     | Accepted               |
| 0013 | Issue tracker is the single source of truth; HANDOFF.md/ROADMAP.md dropped               | Accepted               |
| 0014 | Workflow-per-box decomposition                                                           | Accepted               |
| 0015 | `workflows/<slug>/` is the artifact home                                                 | Accepted               |
