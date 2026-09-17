# The orchestrator and `/wayfinder`

Two things coordinate work in this repository and they are often confused, because both produce
plans and both talk about streams. They are not alternatives. One plans; the other dispatches,
verifies and remembers.

## Who does what

|                               | `/wayfinder`                                                    | the orchestrator                                                            |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| What it is                    | a skill                                                         | a session role                                                              |
| What it produces              | a map: decision tickets, and each decision recorded as it lands | openers, verified worker reports, a `STATE` block                           |
| How long it lives             | the invocation                                                  | days, across maps                                                           |
| Dispatches workers            | no                                                              | yes                                                                         |
| Verifies what a worker claims | no                                                              | yes — that is its central rule                                              |
| Who starts it                 | the maintainer types it; it carries `disable-model-invocation`  | the maintainer opens a session with `.orchestration/orchestrator-prompt.md` |
| How many at once              | one per map                                                     | one per project                                                             |

A map exists perfectly well without an orchestrator: you type `/wayfinder`, read the map, and
work the tickets yourself. What `/wayfinder` does not do is hold the context between maps, and
that is the whole reason the orchestrator exists — several sessions' worth of reading, kept in
one place, so no single working session has to carry it.

Planning and remembering are different jobs. Only the second one needs to last.

## Why the orchestrator is a session, not an agent

Claude Code offers three containers and none of them is a long-lived named agent:

| Container             | Lifetime                                     | Addressable by a peer |
| --------------------- | -------------------------------------------- | --------------------- |
| `.claude/agents/*.md` | one task; isolated context; returns a report | no                    |
| `.claude/commands/`   | injected into the current session            | n/a                   |
| `.claude/skills/`     | loaded into the current session              | n/a                   |

`ListAgents` and `SendMessage` address **live sessions**, and a session's name comes from
`/rename`, not from a definition file. A subagent definition would break the two properties the
orchestrator depends on: a context that has read everything, and workers that can write to it
over days.

GitHub Copilot models this differently — `.github/agents/*.md` with `handoffs:` frontmatter is a
persistent named agent — so a Copilot port of this role is a different artefact, not a copy.

What can be packaged in Claude Code is the **start**: the orchestrator prompt, as a skill with
`disable-model-invocation: true`, the same gate `/wayfinder` and `/grill-with-docs` carry. Only
the maintainer invokes it.

## The boundary

The orchestrator edits coordination artefacts: tracker items, session openers, review summaries,
findings registers, decision records when authorised, project memory and its own handoff.

It does not edit implementation files — not a `.mjs`, not a Box YAML, not a command prompt. That
is deliberate: its value is a clean, long-lived context, and implementation detail destroys it.

It does not merge. When a ticket or a pull request is ready it reports the evidence on the
ticket, where the evidence outlives the session that produced it, and a repository developer
merges.

## Where the rest lives

The orchestrator's own configuration, handoff, doctrine and lessons live in `.orchestration/`,
which is **not tracked**: its state names a client repository and this repository is public. The
layout follows the generic orchestrator kit — `config.yaml`, `orchestrator-prompt.md`,
`HANDOFF.md` with one `STATE` block, and an archive.
