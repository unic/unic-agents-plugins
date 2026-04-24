---
allowed-tools: Bash(node *), Bash(pnpm install*)
description: Publish a markdown file to a Confluence page
---

Publish a markdown file to a Confluence page using the bundled push-to-confluence.mjs script.

Arguments: $ARGUMENTS
Expected format: <page-key-or-id> <markdown-file>
Example: spec-42410 docs/features/profile-features.md
Example: 804848595 docs/features/profile-features.md

## Steps

### 0. Ensure dependencies are installed

Check if `marked` is available in the plugin directory:

```sh
test -d "${CLAUDE_PLUGIN_ROOT}/node_modules/marked" || pnpm install --prefix "${CLAUDE_PLUGIN_ROOT}"
```

### 1. Parse arguments

Split $ARGUMENTS by whitespace. The first token is the page key or ID, the second is the markdown file path.
If either is missing, tell the user: "Usage: /unic-confluence <page-key-or-id> <markdown-file>"

Page keys are human-friendly names defined in `confluence-pages.json` at the repo root (e.g. `spec-42410`).
You can also pass a raw numeric Confluence page ID directly.

### 2. Check credentials (quick auth probe)

Run to verify credentials are configured:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --ping
```

Performs a single HTTP GET to verify credentials are valid. If credentials are missing or rejected, instruct the user to run:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --setup
```

If the publish step fails with "No markers found", the target Confluence page needs [AUTO_INSERT_START:label] / [AUTO_INSERT_END:label] markers. To overwrite the full page body instead, pass --replace-all as part of $ARGUMENTS.

### 3. Run the publish script

Execute from the project root:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" <page-key-or-id> <markdown-file>
```

### 4. Report result

If successful, confirm to the user which file was published and to which page.
If it fails, show the error and suggest fixes:

- Wrong page key: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --verify` to check all page IDs
- File not found: verify the markdown file path
- Expired token: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --setup` to reconfigure credentials
