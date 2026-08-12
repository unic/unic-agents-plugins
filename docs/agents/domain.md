# Domain

Repo-owned. Hand-maintained — no generator writes this file.

## Repository layout: multi-context

This repository uses **multi-context** layout. Each package/app has its own `CONTEXT.md` file. A `CONTEXT-MAP.md` at the repo root maps each context to its location.

- **Context map:** `CONTEXT-MAP.md`
- **ADRs:** monorepo-wide decisions live in root `docs/adr/`; each context may also keep its own `docs/adr/` for decisions scoped to that context.

## How agents use this

Every agent working in this repo should read the relevant `CONTEXT.md` (located via `CONTEXT-MAP.md`) and the ADRs in root `docs/adr/` plus any context-scoped `docs/adr/` before proposing terminology changes or architectural decisions.
