# Triage Labels

The skills speak in terms of canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

This repo uses the 8-state vocabulary owned by `unic-archon-dlc` (see `docs/agents/labels.md`). Note `rejected` is the canonical "will not be actioned" label here, **not** `wontfix`.

| Label in our tracker | Meaning                                          |
| -------------------- | ------------------------------------------------ |
| `needs-triage`       | Maintainer needs to evaluate this issue          |
| `needs-info`         | Waiting on reporter for more information         |
| `needs-specs`        | Enough info from reporter; ready to write a spec |
| `ready-for-agent`    | Fully specified, ready for an AFK agent          |
| `ready-for-human`    | Requires human implementation                    |
| `resolved`           | Implemented; ready for a PR                      |
| `closed`             | PR has been merged                               |
| `rejected`           | Will not be actioned                             |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.
