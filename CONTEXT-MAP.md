# Context Map

## Shared vocabulary

- [Monorepo](./CONTEXT.md) — Plugin, Workspace Package, Release, Spec, Spec Runner, Consumer

## Plugin contexts

- [auto-format](./apps/claude-code/auto-format/CONTEXT.md) — formatting automation hook for Claude Code
- [pr-review](./apps/claude-code/pr-review/CONTEXT.md) — PR review command targeting Azure DevOps
- [unic-confluence](./apps/claude-code/unic-confluence/CONTEXT.md) — Markdown-to-Confluence publishing command

## Relationships

- All three Plugin contexts share the vocabulary defined in the monorepo context
- **auto-format** and **pr-review** are Claude Code Plugins with no runtime dependencies on each other
- **unic-confluence** can be installed as a git dependency for use outside Claude Code.
- **pr-review** has a soft dependency on the `pr-review-toolkit` plugin from `anthropics/claude-plugins-official`
