# Interactive Approval Loop as the default write path

The Plugin previews a Review in the terminal by default and writes nothing to ADO. `--post` enters the Approval Loop — each Finding shown one at a time with accept / edit / skip choices. `--post --yes` bulk-accepts and posts every Finding without prompting.

## Considered options

- **Bulk-post by default, like a CI bot.** Rejected — this Plugin runs from a developer's terminal, not a CI pipeline. Posting unfiltered LLM output to a shared PR thread is a noise-and-trust hazard the invoker hasn't opted into.
- **Preview-then-confirm-once (single y/N for the whole batch).** Rejected — invokers consistently want to drop the one weak Finding without re-running the whole Review. Per-Finding choice costs a few seconds and earns trust.

## Consequences

- The Plugin must render Findings in a stable order and emit a resumable state log so an interrupted Approval Loop can be picked up without re-running the agents.
- The default behaviour (no `--post`) makes every Review effectively a dry-run, which removes the need for a separate `--dry-run` flag.
- The `--yes` escape hatch lets CI use the Plugin without prompts; the Plugin must detect non-TTY stdin and abort cleanly when `--post` is given without `--yes` in a non-interactive context.
