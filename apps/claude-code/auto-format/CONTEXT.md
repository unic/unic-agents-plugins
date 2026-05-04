# auto-format

A Claude Code Plugin that automatically formats files after Claude edits them, using the Consumer's own tooling.

## Language

**Edit Event**:
The moment Claude finishes writing or editing a file, which fires the Format Hook.
_Avoid_: write event, save event, tool call

**Formatter**:
A Consumer-owned tool invoked after an Edit Event to normalise file style — Prettier, ESLint, Biome, or any combination.
_Avoid_: linter (Formatters may include linters, but the term is broader)

**Format Hook**:
The PostToolUse hook that auto-format installs into Claude Code to trigger Formatters after every Edit Event.
_Avoid_: auto-format hook (redundant), plugin hook

## Relationships

- An **Edit Event** triggers exactly one **Format Hook** run
- The **Format Hook** invokes zero or more **Formatters** based on what the Consumer has configured
- **Formatters** are owned and provided by the Consumer — the Format Hook never bundles them

## Example dialogue

> **Dev:** "Should the Format Hook fail loudly if the Formatter exits with an error?"
> **Domain expert:** "Never. The Format Hook always exits 0 — it must never block Claude after an Edit Event. Formatter errors go to stderr only."
