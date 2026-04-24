# 16. Add `.claude-plugin/README.md` for Marketplace Documentation

**Status: done — 2026-04-24**

**Priority:** P2
**Effort:** S
**Depends on:** none
**Touches:** `.claude-plugin/README.md` (new file)

## Context

The Claude Code plugin marketplace renders `.claude-plugin/README.md` as the primary documentation surface visible to users browsing or installing the plugin. This surface is separate from the repo-root `README.md`, which is aimed at npm consumers who install the package into their own repos. Currently `.claude-plugin/README.md` does not exist, so marketplace users see no documentation when they inspect the `unic-confluence` plugin — no setup instructions, no usage examples, no marker syntax explanation. A user who discovers the plugin through the marketplace has no in-product path to configure it correctly. This spec creates that file. The content is intentionally scoped to plugin consumers (people using `/unic-confluence` in Claude Code) and does not duplicate the npm-consumer instructions in the root README.

## Current behaviour

```sh
ls .claude-plugin/
# plugin.json  marketplace.json
# (no README.md)
```

Marketplace users who run `claude plugins info unic-confluence` or browse the marketplace listing see no documentation beyond the `description` field in `marketplace.json` (`"Publish markdown files to Confluence pages via the Confluence v2 API."`).

## Target behaviour

`.claude-plugin/README.md` exists and is shown in the marketplace UI. It covers:

1. What the plugin does (one line).
2. How to install it via the marketplace (two commands: marketplace add, then install).
3. One-time setup: run `--setup`, create `confluence-pages.json`, add markers to the Confluence page.
4. How to use the slash command (`/unic-confluence`).
5. How to verify page IDs (`--verify`).
6. How to update the plugin.

The file avoids npm-consumer instructions (no `npm install`, no `"confluence"` script, no `package.json` snippets).

## Implementation steps

### Step 1 — Create `.claude-plugin/README.md`

Create the file at `.claude-plugin/README.md` with the following content:

```markdown
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

| Error | Cause | Fix |
|---|---|---|
| `Run --setup to configure credentials` | No credentials file and no env vars | Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --setup` |
| `API token rejected` | Token expired or wrong | Generate a new token at https://id.atlassian.com |
| `Page ID not found` | Wrong ID in `confluence-pages.json` | Run `--verify` to audit all IDs |
| `No [AUTO_INSERT_START:label] markers found` | Markers missing from Confluence page | Add `[AUTO_INSERT_START: label]` / `[AUTO_INSERT_END: label]` to the page in Confluence |
| `Cannot reach Confluence — check VPN/network` | Not on VPN or network down | Connect to VPN, then retry |
| `Marker label mismatch` | START and END labels differ | Edit the Confluence page to make labels match exactly |
```

> Ralph: the marketplace registration URL (`https://raw.githubusercontent.com/...`) is a placeholder. Confirm the correct URL from the repo's `marketplace.json` or the Claude Code plugin documentation before shipping.

### Step 2 — Verify the file is picked up by the plugin manifest

Open `.claude-plugin/plugin.json` and confirm there is no `readme` or `docs` field that explicitly points elsewhere. The default convention for Claude Code plugins is `.claude-plugin/README.md` — no manifest change is required if the convention is followed.

If `plugin.json` has a `readme` key pointing to a different path, update it to `"./README.md"` (relative to `.claude-plugin/`).

## Test cases

| Scenario | Expected result |
|---|---|
| `ls .claude-plugin/` after this change | `marketplace.json  plugin.json  README.md` |
| `cat .claude-plugin/README.md` contains "Install" section | Yes |
| `cat .claude-plugin/README.md` contains `--setup` instructions | Yes |
| `cat .claude-plugin/README.md` contains `confluence-pages.json` snippet | Yes |
| `cat .claude-plugin/README.md` contains `[AUTO_INSERT_START` example | Yes |
| `cat .claude-plugin/README.md` contains `/unic-confluence` usage | Yes |
| `cat .claude-plugin/README.md` contains `--verify` | Yes |
| Root `README.md` is unchanged | Yes — this spec does not touch it |
| `.claude-plugin/plugin.json` is unchanged | Yes — no manifest change needed |

## Acceptance criteria

- [ ] `.claude-plugin/README.md` exists.
- [ ] File contains a top-level `# unic-confluence` heading.
- [ ] File contains an Install section with both `marketplace add` and `plugins install` commands.
- [ ] File contains Setup instructions covering credentials (`--setup`), `confluence-pages.json`, and markers.
- [ ] File contains a Usage section with the `/unic-confluence` slash command syntax and at least one example.
- [ ] File contains a `--verify` section.
- [ ] File contains an Update section.
- [ ] File does NOT contain `npm install` or `package.json` script instructions (those belong in the root README).
- [ ] Root `README.md` is unchanged.
- [ ] `.claude-plugin/plugin.json` is unchanged (unless it had an explicit `readme` key pointing elsewhere).

## Verification

```sh
# 1. Confirm file exists
ls -la .claude-plugin/README.md

# 2. Confirm key sections are present
grep -c "## Install\|## Setup\|## Usage\|## Verify\|## Update\|## Troubleshooting" .claude-plugin/README.md
# Expected: 6

# 3. Confirm no npm-consumer content leaked in
grep "npm install\|package\.json" .claude-plugin/README.md
# Expected: no output

# 4. Confirm markers example is present
grep "AUTO_INSERT_START" .claude-plugin/README.md
# Expected: at least one match

# 5. Confirm root README is untouched
git diff README.md
# Expected: no changes
```

## Out of scope

- Do not modify the root `README.md`.
- Do not add `npm install` or consuming-repo setup instructions to this file — those belong in the root README.
- Do not duplicate the full marker syntax specification here; a working example is enough.
- Do not add a `CHANGELOG` or release notes to this file.
- Do not add badges (CI status, npm version, etc.).
- No version bump to `plugin.json` or `marketplace.json` for this documentation-only change.

## Follow-ups

- Once the marketplace registration URL is confirmed, replace the placeholder URL in the Install section.
- If Claude Code's marketplace adds support for screenshots or video previews in plugin READMEs, consider adding a screenshot of a successful publish.
- After spec 03 (`--replace-all`) lands, add a note to the Troubleshooting table for the "No markers found" error that mentions `--replace-all`.

_Ralph: append findings here._
