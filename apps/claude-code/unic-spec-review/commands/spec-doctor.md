---
allowed-tools: Bash(node *)
argument-hint: (no arguments)
description: Verify unic-spec-review prerequisites (Confluence credentials, Figma Dev Mode MCP, and Playwright MCP).
---

# unic-spec-review:spec-doctor

Runs a preflight check for all unic-spec-review prerequisites so you can diagnose setup issues before running a review.

Checks performed:

1. Atlassian credentials are present (`~/.unic-confluence.json` or `CONFLUENCE_*` env vars)
2. Confluence is reachable via HTTP (Basic auth)
3. Figma Dev Mode MCP is connected
4. Playwright MCP is connected

## Step 1 - Print the spec-doctor header

Print:

```
unic-spec-review spec-doctor
─────────────────────────────────
```

## Step 2 - Run the Confluence credential and connectivity check

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/spec-doctor.mjs"
```

Show the script output verbatim (one ✓/✗ line per check).

Record whether the script exited 0 (all credential/connectivity checks passed) or 1 (failed).

## Step 3 - Check for Figma Dev Mode MCP

Determine whether a Figma Dev Mode MCP tool is available in the current Claude Code session
by checking the active tool set for tools whose names match `mcp__figma*` or any tool clearly
from a Figma Dev Mode MCP server.

- If the Figma Dev Mode MCP is **available**: print `✓ Figma Dev Mode MCP - connected`
- If the Figma Dev Mode MCP is **NOT available**: print the following explicit failure (not a silent skip):
  ```
  ✗ Figma Dev Mode MCP - not connected
    Remediation: Enable the Figma Dev Mode MCP in your Claude Code MCP settings.
    See https://help.figma.com/hc/en-us/articles/32132100888087 for setup instructions.
  ```
  Record whether this check passed or failed.

## Step 4 - Check for Playwright MCP

Determine whether a Playwright MCP tool is available in the current Claude Code session
by checking the active tool set for tools whose names match `mcp__playwright*` or any tool
clearly from a Playwright MCP server.

- If the Playwright MCP is **available**: print `✓ Playwright MCP - connected`
- If the Playwright MCP is **NOT available**: print the following explicit failure (not a silent skip):
  ```
  ✗ Playwright MCP - not connected
    Remediation: Enable the Playwright MCP in your Claude Code MCP settings.
    Example config: https://github.com/microsoft/playwright-mcp
  ```
  Record whether this check passed or failed.

## Step 5 - Print overall result

Print:

```
─────────────────────────────────
```

Then:

- If **all checks passed**: print `All checks passed.`
- If **any check failed**: print `One or more checks failed - see lines marked ✗ above.`

Missing MCPs are hard failures. Do not summarise them as warnings or caveats;
they must appear as ✗ lines.
