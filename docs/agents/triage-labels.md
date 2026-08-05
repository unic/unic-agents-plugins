# Triage Labels

Repo-owned. Hand-maintained — no generator writes this file.

`/triage` speaks in **canonical roles**. This file maps every role it can name onto the label strings this repo actually uses. Left column entries are the skill's literal role names, so a lookup never needs interpretation. The full tracker taxonomy is in [`labels.md`](labels.md).

## Category roles

| Canonical role | Label in this repo | Note                                                                                                                                                                |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bug`          | `bug`              | —                                                                                                                                                                   |
| `enhancement`  | `feature`          | This repo has no `enhancement` label. **Never create one** — [ADR-0032](../adr/0032-label-taxonomy.md) merged 48 `enhancement` issues into `feature` and deleted it |

The type tier carries four more labels no canonical role names — `spike`, `tech-debt`, `docs`, `release`. Apply them directly when they fit better than `feature`.

## State roles

| Canonical role    | Label in this repo | Meaning                                  |
| ----------------- | ------------------ | ---------------------------------------- |
| `needs-triage`    | `needs-triage`     | Maintainer needs to evaluate this issue  |
| `needs-info`      | `needs-info`       | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent`  | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human`  | Requires human implementation            |
| `wontfix`         | `rejected`         | Will not be actioned                     |

**`rejected` is this repo's label, never `wontfix`.** The skill's canonical role keeps the older name; the label does not.

## Repo-only states

Three more state labels exist that no canonical role names. They extend the skill's five-state machine rather than replacing it — `/triage` will not apply them on its own, so set them by hand or by whichever command owns that transition.

| Label         | Meaning                                         | Sits between                 |
| ------------- | ----------------------------------------------- | ---------------------------- |
| `needs-specs` | Enough info from the reporter; ready for a spec | `needs-info` → `ready-for-*` |
| `resolved`    | Implemented; ready for a PR                     | `ready-for-*` → `closed`     |
| `closed`      | PR has been merged                              | after `resolved`             |

Full order: `needs-triage` → `needs-info` → `needs-specs` → `ready-for-agent` / `ready-for-human` → `resolved` → `closed`, with `rejected` reachable at any point.
