---
title: plugin naming conventions - add unic prefix
created: 2026-05-07
---

plugin naming conventions - add unic prefix

## How it works

The slash command name is assembled by Claude Code from two parts:

```
/<plugin-name>:<command-filename-without-extension>
```

- **`<plugin-name>`** — the `"name"` field in `.claude-plugin/plugin.json`
- **`<command-filename>`** — the filename under `commands/` without `.md`

Example: plugin name `pr-review` + command file `review-pr.md` → `/pr-review:review-pr`

`unic-confluence` already follows the desired pattern: plugin name `unic-confluence` + command `unic-confluence.md` → `/unic-confluence:unic-confluence`.

## To add a `unic` prefix to all plugins

Rename the `"name"` field in each plugin's `.claude-plugin/plugin.json`:

- `pr-review` → `unic-pr-review` (command becomes `/unic-pr-review:review-pr`)
- `auto-format` → `unic-auto-format`

**Breaking change:** existing installs have `"pr-review@unic": true` in `enabledPlugins` — they'd need to update to `"unic-pr-review@unic": true`. Safe to do now if the plugin isn't widely distributed.
