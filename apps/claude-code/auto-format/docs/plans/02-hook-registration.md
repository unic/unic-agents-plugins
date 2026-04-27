# 02. Hook Registration
**Status: done — 2026-04-27**

**Priority:** P0
**Effort:** S
**Version impact:** minor
**Depends on:** spec-01
**Touches:** `hooks/hooks.json`

## Context

Claude Code discovers plugin hooks by reading `hooks/hooks.json` in the plugin install directory. This file declares which Claude Code tool events to listen on and which command to run. Without this file, the plugin does nothing even after install.

The hook must match `Write|Edit|MultiEdit|NotebookEdit` — these are the four Claude Code built-in tools that write file content. `MultiEdit` and `NotebookEdit` are commonly omitted by other implementations (e.g. `DXP-Profileservices` only matches `Write|Edit`) but both can be triggered by Claude in normal workflows.

The command invokes the hook script (spec 03) via `node` rather than directly, so it works on systems where `.mjs` files may not have executable permissions (Windows, some CI).

## Current behaviour

After spec `01`: no `hooks/` directory exists. The plugin is not yet wired to any Claude Code events.

## Target behaviour

- `hooks/hooks.json` exists with a `PostToolUse` registration for `Write|Edit|MultiEdit|NotebookEdit`.
- The command is `node ${CLAUDE_PLUGIN_ROOT}/scripts/format-hook.mjs`.
- `CLAUDE_PLUGIN_ROOT` is the env var Claude Code sets to the plugin's install path. `CLAUDE_PROJECT_DIR` (used in the script itself) is set to the consumer project's working directory.
- The hooks directory and file are committed.

## Implementation steps

### Step 1 — Create `hooks/hooks.json`

```json
{
	"hooks": {
		"PostToolUse": [
			{
				"matcher": "Write|Edit|MultiEdit|NotebookEdit",
				"hooks": [
					{
						"type": "command",
						"command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/format-hook.mjs"
					}
				]
			}
		]
	}
}
```

Note: `${CLAUDE_PLUGIN_ROOT}` is a literal string here — Claude Code performs environment variable substitution when loading the hook. Do NOT expand it yourself.

### Step 2 — Commit

```sh
git add hooks/
git commit -m "feat(spec-02): register PostToolUse hook for Write|Edit|MultiEdit|NotebookEdit"
```

## Acceptance criteria

- `hooks/hooks.json` is valid JSON.
- `PostToolUse` key is present.
- Matcher is exactly `"Write|Edit|MultiEdit|NotebookEdit"`.
- Command contains `${CLAUDE_PLUGIN_ROOT}/scripts/format-hook.mjs`.

## Verification

```sh
# 1. Valid JSON
cat hooks/hooks.json | python3 -m json.tool > /dev/null && echo "OK: hooks.json valid"

# 2. Matcher is correct
node -e "
  import('./hooks/hooks.json', {assert:{type:'json'}}).then(h => {
    const m = h.default.hooks.PostToolUse[0].matcher;
    console.assert(m === 'Write|Edit|MultiEdit|NotebookEdit', 'Wrong matcher: ' + m);
    console.log('OK: matcher correct:', m);
  });
"
```

## Out of scope

- No hook script yet (spec 03).
- No PreToolUse hook (not in scope for this plugin).
- No plugin-level `.claude/settings.json` — that would override user settings. Hooks belong in `hooks/hooks.json`.

_Ralph: append findings here._
