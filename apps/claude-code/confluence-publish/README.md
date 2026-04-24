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

### `confluence-pages.json` (optional key mapping)

The `<page-key-or-id>` argument accepts either a raw numeric Confluence page ID or a short key defined in `confluence-pages.json`. Place this file at your repo root:

```json
{
  "my-docs": 123456789,
  "another-page": 987654321
}
```

Then publish using the key:

```sh
pnpm confluence my-docs docs/my-file.md
```

## Page setup — injection markers

The script injects your Markdown content into a Confluence page rather than replacing the whole page. To control *where* the content lands, add injection markers directly to the Confluence page body.

### Adding markers to a Confluence page

1. Open the target Confluence page and click **Edit**.
2. Place your cursor where you want the injected content to appear.
3. Type the start marker on its own line:
   ```
   [AUTO_INSERT_START: my-docs]
   ```
4. Leave a blank line (optional placeholder text helps with visual orientation):
   ```
   (Claude Code will inject content here)
   ```
5. Type the end marker on its own line:
   ```
   [AUTO_INSERT_END: my-docs]
   ```
6. **Save** the page.

Full copy-paste block:

```
[AUTO_INSERT_START: my-docs]

(Claude Code will inject content here)

[AUTO_INSERT_END: my-docs]
```

### Label rules

- The label (`my-docs` above) is **case-sensitive**. `My-Docs` and `my-docs` are different labels.
- The label in `[AUTO_INSERT_START:label]` must exactly match the label in `[AUTO_INSERT_END:label]`.
- Whitespace around the label is trimmed — `[AUTO_INSERT_START: my-docs]` and `[AUTO_INSERT_START:my-docs]` are equivalent.
- A page can have only one marker pair. Multiple pairs are not supported.

### What happens without markers

If the page has no markers, the script currently appends the new HTML after all existing content. **Running the publish command twice will double the content.** A future update (spec 03) will change this to an explicit error with a `--replace-all` opt-out flag.

### Legacy anchor-macro fallback (deprecated)

Pages set up before text markers were introduced may use Confluence anchor macros instead:

- Start anchor: macro named `md-start`
- End anchor: macro named `md-end`

This fallback is still supported but deprecated. Migrate legacy pages to text markers when convenient.

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
pnpm confluence --setup
```

Or set environment variables instead:

```sh
CONFLUENCE_URL=https://yourorg.atlassian.net
CONFLUENCE_USER=your@email.com
CONFLUENCE_TOKEN=your-api-token
```

### 5. Verify page IDs

```sh
pnpm confluence --verify
```

## Troubleshooting

### 401 API token rejected

Generate a new token at <https://id.atlassian.com> → Security → API tokens.
Tokens created before 2025 may have expired even if the Atlassian interface shows them as active.
After generating, re-run setup:

```sh
pnpm confluence --setup
# or, if running the script directly:
node scripts/push-to-confluence.mjs --setup
```

### 403 Access denied

Your API token does not have Edit permission for this Confluence page or space.
Ask a Confluence space admin to grant your account Edit access, then retry.

### 404 Page ID not found

The page ID in `confluence-pages.json` is incorrect, or the page has been deleted or moved.
Verify the ID by opening the page in Confluence and checking the URL — the numeric ID appears after `/pages/`.
Run `pnpm confluence --verify` to test all IDs in `confluence-pages.json` at once.

### 409 Conflict — page updated by someone else

Someone edited the Confluence page between the time this script read the current version (GET) and tried to write the new version (PUT).
Re-run the same command — the script will fetch the current version and retry cleanly.

### Network error / Cannot reach Confluence

Make sure you are connected to the Unic VPN.
The Confluence instance (`https://uniccom.atlassian.net`) is not reachable from the public internet.

### Markdown converts to empty HTML

The Markdown source file may be empty, or it may contain only a YAML frontmatter block with no body content below the closing `---`.
Check the file path you passed as the second argument.

### confluence-pages.json not found

Either create `confluence-pages.json` at your repository root (see [Per-repo setup → Create confluence-pages.json](#3-create-confluence-pagesjson-at-the-repo-root) above), or pass the numeric Confluence page ID directly as the first argument instead of a key name.

### Credentials not configured

Run `pnpm confluence --setup` (or `node scripts/push-to-confluence.mjs --setup`) to store your Confluence URL, email, and API token in `~/.unic-confluence.json`.
Alternatively, set the environment variables `CONFLUENCE_URL`, `CONFLUENCE_USER`, and `CONFLUENCE_TOKEN`.

## Updating

```sh
# Update Claude Code plugin
claude plugins marketplace update unic-claude-code-confluence
claude plugins install unic-confluence@unic-claude-code-confluence

# Update npm package
npm install -D git+ssh://git@github.com:unic/unic-claude-code-confluence

# Or
pnpm install -w -D git+ssh://git@github.com:unic/unic-claude-code-confluence
```

## Naming convention

This plugin follows the Unic Claude Code plugin naming convention:

| Surface                         | Value                        |
| ------------------------------- | ---------------------------- |
| GitHub repo                     | `unic-claude-code-<service>` |
| Plugin identifier (Claude Code) | `unic-<service>`             |
| npm package name                | `unic-<service>`             |

## Releasing

Every `feat(spec-NN)` / `fix(spec-NN)` commit includes its own version bump and CHANGELOG entry via `pnpm bump`. No separate "release commit" is needed.

**Per change (every commit):**
1. Add one bullet under the matching subsection of `## [Unreleased]` in `CHANGELOG.md` (`### Breaking`, `### Added`, or `### Fixed`).
2. `pnpm bump <patch|minor|major>` — bumps `plugin.json`, mirrors into `marketplace.json`, promotes `[Unreleased]` → a dated version section.
3. `git add -A && git commit -m "feat(spec-NN): <description> (vX.Y.Z)"`.

**SemVer policy:**
| Change type | Bump |
|---|---|
| Breaking change to CLI flags, exit codes, or on-disk contracts | `major` |
| New flag, subcommand, or user-visible feature | `minor` |
| Bug fix, refactor, docs, internal tooling | `patch` |

**To tag and push a release boundary (optional, periodic):**
```sh
pnpm tag                  # creates local git tag vX.Y.Z
git push --follow-tags    # pushes tag to GitHub
```

**Optional — enable the local pre-push changelog check:**
```sh
git config core.hooksPath .githooks
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the spec-driven development workflow, how to write specs, and how to run Ralph Orchestrator.

## License

Copyright © 2026 Unic. Licensed under the [LGPL-3.0-or-later](LICENSE).
