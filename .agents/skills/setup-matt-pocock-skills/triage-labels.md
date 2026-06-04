# Triage Labels

The skills speak in terms of canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

This repo uses the 8-state vocabulary owned by `unic-archon-dlc` (see `docs/agents/labels.md`). Note `rejected` is the canonical "will not be actioned" label here, **not** `wontfix`.

| Role             | Label             | Meaning                                          |
| ---------------- | ----------------- | ------------------------------------------------ |
| Needs evaluation | `needs-triage`    | Maintainer needs to evaluate this issue          |
| Needs info       | `needs-info`      | Waiting on reporter for more information         |
| Needs specs      | `needs-specs`     | Enough info from reporter; ready to write a spec |
| Ready for agent  | `ready-for-agent` | Fully specified, ready for an AFK agent          |
| Ready for human  | `ready-for-human` | Requires human implementation                    |
| Resolved         | `resolved`        | Implemented; ready for a PR                      |
| Closed           | `closed`          | PR has been merged                               |
| Won't fix        | `rejected`        | Will not be actioned (older skills call this role `wontfix`) |

When a skill mentions a role (e.g. "apply the AFK-ready label", or the legacy `wontfix` role), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.
