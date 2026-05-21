# Domain

Configured by unic-archon-dlc.

## Repository layout: multi-context

This repository uses **multi-context** layout. Each package/app has its own `CONTEXT.md` file. A `CONTEXT-MAP.md` at the repo root maps each context to its location.

- **Context map:** `CONTEXT-MAP.md`
- **ADRs:** `docs/adr/` (repo-level decisions)

## How agents use this

Every agent working in this repo should read `CONTEXT.md` (and the ADRs in `docs/adr/`) before proposing terminology changes or architectural decisions.
