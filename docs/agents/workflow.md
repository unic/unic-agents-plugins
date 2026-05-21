# Workflow Phases

unic-archon-dlc ships six Archon workflow YAML DAGs. Each phase produces persistent artifacts committed to `docs/workflow/<slug>/`.

| Phase   | Command                    | Artifact outputs                                                  |
| ------- | -------------------------- | ----------------------------------------------------------------- |
| explore | `/unic-dlc-explore <slug>` | `docs/workflow/<slug>/findings.md`                                |
| plan    | `/unic-dlc-plan <slug>`    | `docs/workflow/<slug>/PRD.md`, `issues.json`, `build-<slug>.yaml` |
| build   | `/unic-dlc-build <slug>`   | `docs/workflow/<slug>/report.md`                                  |
| qa      | `/unic-dlc-qa <slug>`      | merged PR                                                         |
| cleanup | `/unic-dlc-cleanup <slug>` | `docs/workflow/<slug>/arch-review.md`                             |
| triage  | `/unic-dlc-triage`         | `HANDOFF.md`, `docs/workflow/ROADMAP.md`                          |

## State separation

| Layer                        | Storage                          | Who owns it       |
| ---------------------------- | -------------------------------- | ----------------- |
| Transient workflow state     | `$ARTIFACTS_DIR` (Archon native) | Archon runtime    |
| Persistent project artifacts | `docs/workflow/<slug>/`          | Committed to repo |
| Issue / ticket tracking      | Configured tracker               | Tracker backend   |
