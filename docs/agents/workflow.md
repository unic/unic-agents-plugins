# Workflow Phases

unic-archon-dlc ships seven Archon workflow YAML DAGs. The six lifecycle phases below produce persistent artifacts committed to `docs/workflow/<slug>/`; the `review` workflow is on-demand and posts a single comment on the current PR.

| Phase   | Command                    | Artifact outputs                                                  |
| ------- | -------------------------- | ----------------------------------------------------------------- |
| explore | `/unic-dlc-explore <slug>` | `docs/workflow/<slug>/findings.md`                                |
| plan    | `/unic-dlc-plan <slug>`    | `docs/workflow/<slug>/PRD.md`, `issues.json`, `build-<slug>.yaml` |
| build   | `/unic-dlc-build <slug>`   | `docs/workflow/<slug>/report.md`                                  |
| qa      | `/unic-dlc-qa <slug>`      | merged PR                                                         |
| cleanup | `/unic-dlc-cleanup <slug>` | `docs/workflow/<slug>/arch-review.md`                             |
| triage  | `/unic-dlc-triage`         | `HANDOFF.md`, `docs/workflow/ROADMAP.md`                          |
| review  | `/unic-dlc-review`         | structured comment on the current PR (idempotent re-runs)         |

## State separation

| Layer                        | Storage                          | Who owns it       |
| ---------------------------- | -------------------------------- | ----------------- |
| Transient workflow state     | `$ARTIFACTS_DIR` (Archon native) | Archon runtime    |
| Persistent project artifacts | `docs/workflow/<slug>/`          | Committed to repo |
| Issue / ticket tracking      | Configured tracker               | Tracker backend   |
