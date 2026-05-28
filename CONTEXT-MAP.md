# Context Map

## Shared vocabulary

- [Monorepo](./CONTEXT.md) — Plugin, Workspace Package, Release, Feature, Feature Runner, Consumer

## Plugin contexts

- [auto-format](./apps/claude-code/auto-format/CONTEXT.md) — formatting automation hook for Claude Code
- [pr-review](./apps/claude-code/pr-review/CONTEXT.md) — PR review command targeting Azure DevOps
- [unic-confluence](./apps/claude-code/unic-confluence/CONTEXT.md) — Markdown-to-Confluence publishing command
- [unic-archon-dlc](./apps/claude-code/unic-archon-dlc/CONTEXT.md) — Archon-powered AI development lifecycle DLC
- [unic-pr-review](./apps/claude-code/unic-pr-review/CONTEXT.md) — PR review command for Azure DevOps with Confluence and Jira context

## Relationships

- All Plugin contexts share the vocabulary defined in the monorepo context
- **auto-format**, **pr-review**, and **unic-archon-dlc** are Claude Code Plugins with no runtime dependencies on each other
- **unic-confluence** can be installed as a git dependency for use outside Claude Code.
- **pr-review** has a soft dependency on the `pr-review-toolkit` plugin from `anthropics/claude-plugins-official`
- **unic-archon-dlc** requires the Archon workflow engine (version ≥ 0.10) in the target project; it has no runtime dependencies on any other plugin in this repo
- Architectural decisions are split by scope: monorepo-wide decisions live in root `docs/adr/`; decisions scoped to a single context live in that context's own `docs/adr/`.
