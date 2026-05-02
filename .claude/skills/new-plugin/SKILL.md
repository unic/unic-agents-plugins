---
name: new-plugin
argument-hint: `<plugin-name>` (e.g. `my-plugin`)
description: This skill should be used when the user asks to "create a new plugin", "scaffold a plugin", "add a plugin to the monorepo", "start a new plugin called X", or "set up a new plugin". Use to scaffold all required files and directory structure for a new Claude Code plugin under apps/claude-code/ following Unic monorepo conventions.
---

Scaffold a new Claude Code plugin at `apps/claude-code/$ARGUMENTS`. Use the `auto-format` plugin as the canonical reference for structure and file contents.

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

Once a common understanding is achieved, use the matching skill as the basis for your implementation:

<if condition="pluginType == 'command-based'">
  Use `/plugin-dev:command-development` for command-based plugins (slash commands).
</if>
<if condition="pluginType == 'agent-based'">
  Use `/plugin-dev:agent-development` for agent-based plugins (custom agents with tool use).
</if>
<if condition="pluginType == 'skill-based'">
  Use `/plugin-dev:skill-development` for skill-based plugins (tools callable from agents, without their own agent logic).
</if>
<if condition="pluginType == 'hook-based'">
  Use `/plugin-dev:hook-development` for hook-based plugins (event hooks).
</if>

## Files to create

The plugin-dev skill above scaffolds the plugin's core logic files (hooks, commands, agents, skills). The files below are the **monorepo-specific additions** this repo requires — create any that the plugin-dev skill did not already generate.

**`.claude-plugin/plugin.json`**

```json
{
  "name": "<plugin-name>",
  "version": "0.1.0",
  "description": "<description>",
  "author": { "name": "Unic AG", "url": "https://www.unic.com" },
  "homepage": "https://github.com/unic/unic-agents-plugins",
  "license": "LGPL-3.0-or-later",
  "keywords": ["unic"]
}
```

**`.claude-plugin/marketplace.json`** — mirror structure of `apps/claude-code/auto-format/.claude-plugin/marketplace.json`, adjusting name/description/version.

For **hook-based plugins**, `plugin.json` needs no extra fields beyond the base shape above.

For **command-based plugins** (slash commands), add a `commands` array to `plugin.json` pointing to each command file, and create a `commands/` directory with the command `.md` files. Reference `apps/claude-code/unic-confluence/.claude-plugin/plugin.json` as the example:

```json
{
  "name": "<plugin-name>",
  ...
  "commands": ["./commands/<command-name>.md"]
}
```

**`package.json`**

See `references/package-json-template.md` for the full template (hook-based and command-only variants). Copy `packageManager` from the root `package.json` at creation time.

**`.gitignore`** — copy verbatim from `assets/.gitignore` (bundled in this skill).

**`hooks/hooks.json`** — stub with an empty PostToolUse array:

```json
{ "hooks": { "PostToolUse": [] } }
```

Only include if the plugin registers hooks.

**`tsconfig.json`** — only if the plugin has scripts or tests:

```json
{
  "extends": "@unic/tsconfig/tsconfig.base.json",
  "include": ["scripts/**/*.mjs", "tests/**/*.mjs"]
}
```

**`ralph.yml`** — copy from `apps/claude-code/auto-format/ralph.yml`, replace the comment header plugin name.

**`PROMPT.md`** — minimal stub: `# <Plugin Name> — Ralph Prompt\n\nDescribe the task here.`

**`CHANGELOG.md`** — use the exact format from `apps/claude-code/auto-format/CHANGELOG.md` as template. Include only `## [Unreleased]` with empty Breaking/Added/Fixed subsections — no historical version entry yet.

**`README.md`** — one-paragraph description of what the plugin does.

**`CLAUDE.md`** — plugin-specific guidance (not a symlink at the plugin level; see `auto-format/CLAUDE.md` for structure).

**`docs/plans/README.md`** — stub with: `# Spec Roadmap\n\nSpec files for this plugin go here.`

**`scripts/`** and **`tests/`** — empty directories, only if the plugin has scripts or tests.

## Bundled resources

- **`references/package-json-template.md`** — full `package.json` template for hook-based and command-only plugins
- **`assets/.gitignore`** — standard plugin `.gitignore` to copy verbatim

## Do NOT create

- `LICENSE` file — the maintainer adds this manually.
- Any files not listed above.

## After scaffolding

1. Run `pnpm install` from the monorepo root to wire up workspace deps.
2. Instruct the user to add the license file manually, and point them to `LICENSE` file at the monorepo root as a template.
