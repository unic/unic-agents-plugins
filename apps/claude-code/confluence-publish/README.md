# unic-confluence

Claude Code plugin for publishing markdown files to Confluence pages via the Confluence v2 API.

Part of the `unic-claude-code-*` plugin family for Unic-internal Claude Code tooling.

## Usage

```
/unic-confluence <page-key-or-id> <markdown-file>
```

Examples:

```sh
/unic-confluence my-page-key docs/features/my-spec.md
/unic-confluence 804848595 docs/features/my-spec.md    # raw page ID also works
```

## Per-repo setup

### 1. Install the Claude Code plugin

```sh
# Register the marketplace (once per machine)
claude plugins marketplace add unic/unic-claude-code-confluence

# Install the plugin
claude plugins install unic-confluence@unic-claude-code-confluence
```

### 2. Install as npm package (for Copilot / Cursor / other AI editors)

```sh
npm install -D git+ssh://git@github.com:unic/unic-claude-code-confluence
```

or

```sh
pnpm install -w -D git+ssh://git@github.com:unic/unic-claude-code-confluence
```

Then add to your repo's `package.json` scripts:

```json
"confluence": "node node_modules/unic-confluence/scripts/push-to-confluence.mjs"
```

### 3. Create `confluence-pages.json` at the repo root

```json
{
  "_comment": "Map human-readable keys to Confluence page IDs",
  "my-page-key": 000000000
}
```

Replace `000000000` with the actual Confluence page ID (find it in the Confluence URL or page info).

### 4. Configure credentials (once per machine)

```sh
npm run confluence -- --setup
```

Or set environment variables instead:

```sh
CONFLUENCE_URL=https://yourorg.atlassian.net
CONFLUENCE_USER=your@email.com
CONFLUENCE_TOKEN=your-api-token
```

### 5. Verify page IDs

```sh
npm run confluence -- --verify
```

## Updating

```sh
# Update Claude Code plugin
claude plugins marketplace update unic-claude-code-confluence
claude plugins install unic-confluence@unic-claude-code-confluence

# Update npm package
npm install -D git+ssh://git@github.com:unic/unic-claude-code-confluence
```

## Naming convention

This plugin follows the Unic Claude Code plugin naming convention:

| Surface                         | Value                        |
| ------------------------------- | ---------------------------- |
| GitHub repo                     | `unic-claude-code-<service>` |
| Plugin identifier (Claude Code) | `unic-<service>`             |
| npm package name                | `unic-<service>`             |

## License

Copyright © 2026 Unic. Licensed under the [LGPL-3.0-or-later](LICENSE).
