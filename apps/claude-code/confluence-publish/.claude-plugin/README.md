# unic-confluence

Publish local Markdown files to Confluence pages directly from Claude Code.

## Install

```sh
# Register the Unic plugin marketplace (once per machine)
claude plugins marketplace add unic https://raw.githubusercontent.com/unic/unic-claude-code-confluence/main/.claude-plugin/marketplace.json

# Install the plugin
claude plugins install unic-confluence@unic
```

## Setup (once per repo)

### 1. Configure credentials

Run the interactive setup wizard. It stores credentials in `~/.unic-confluence.json` (chmod 600).

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --setup
```

You will be prompted for:

- **Confluence URL** — e.g. `https://yourcompany.atlassian.net` (default pre-filled for Unic: `https://uniccom.atlassian.net`)
- **Email** — the email address associated with your Atlassian account
- **API token** — generate one at https://id.atlassian.com → Security → API tokens

> Note: API tokens created before 2025 may have expired. Generate a new one if setup fails with a 401 error.

Credentials can also be provided as environment variables per-run:
`CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`

### 2. Create `confluence-pages.json` at your repo root

Map human-readable keys to Confluence page IDs. The page ID is the number in the Confluence URL: `.../pages/804848595/My+Page`.

```json
{
  "_comment": "Map human-readable keys to Confluence page IDs",
  "my-spec": 804848595,
  "architecture": 804848601
}
```

### 3. Add markers to your Confluence page

In the Confluence page editor, place these markers where the Markdown content should be injected. Everything between the markers is replaced on each publish.

```
[AUTO_INSERT_START: my-spec]

(Claude Code will inject content here)

[AUTO_INSERT_END: my-spec]
```

**Rules:**

- The label (e.g. `my-spec`) must match exactly between START and END — case-sensitive, no extra spaces.
- The label does not have to match the key in `confluence-pages.json`, but using the same value is recommended for clarity.
- Each page should have exactly one START/END pair.

If no markers are found, the publish command will refuse to proceed and instruct you to add them. (This is intentional — without markers, repeated publishes would duplicate content.)

## Usage

In Claude Code, invoke the slash command:

```
/unic-confluence <page-key-or-id> <markdown-file>
```

**Examples:**

```sh
# Use a key from confluence-pages.json
/unic-confluence my-spec docs/features/spec.md

# Use a raw numeric page ID directly (no confluence-pages.json required)
/unic-confluence 804848595 docs/features/spec.md
```

The command will:

1. Probe credentials (lightweight single GET).
2. Read the Markdown file and convert it to HTML.
3. Fetch the current page body from Confluence.
4. Inject the new HTML between the markers.
5. Publish the updated body via the Confluence v2 API.

## Verify page IDs

Check that all pages in `confluence-pages.json` still exist and are accessible:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --verify
```

Prints a `✅` or `❌` line for each entry. Exits 0 if all pages pass, 1 if any fail.

Useful for CI checks or after a Confluence reorganisation.

## Update

```sh
claude plugins marketplace update unic
claude plugins install unic-confluence@unic
```

## Troubleshooting

| Error                                         | Cause                                | Fix                                                                                     |
| --------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `Run --setup to configure credentials`        | No credentials file and no env vars  | Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --setup`               |
| `API token rejected`                          | Token expired or wrong               | Generate a new token at https://id.atlassian.com                                        |
| `Page ID not found`                           | Wrong ID in `confluence-pages.json`  | Run `--verify` to audit all IDs                                                         |
| `No [AUTO_INSERT_START:label] markers found`  | Markers missing from Confluence page | Add `[AUTO_INSERT_START: label]` / `[AUTO_INSERT_END: label]` to the page in Confluence |
| `Cannot reach Confluence — check VPN/network` | Not on VPN or network down           | Connect to VPN, then retry                                                              |
| `Marker label mismatch`                       | START and END labels differ          | Edit the Confluence page to make labels match exactly                                   |
