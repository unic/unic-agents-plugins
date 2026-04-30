# 11. README Troubleshooting Section
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** none (documentation-only change)
**Touches:** `README.md`

## Context

`scripts/push-to-confluence.mjs` contains well-crafted, specific error messages for the most common failure modes: 401 token expiry, 403 permission issues, 404 missing page ID, 409 version conflict, network errors, empty HTML, and missing `confluence-pages.json`. These messages are good enough to unblock an experienced developer who reads them carefully, but they appear only at runtime — a user who cannot get the command to run at all (e.g. because they have not set up VPN, or they have not created `confluence-pages.json`) will see nothing useful. The README currently has no troubleshooting section. This spec adds one, positioned after "Per-repo setup → Verify page IDs", so it is the first place a stuck user looks after the setup instructions. Each entry is keyed to a recognisable symptom rather than to an internal mechanism, making it searchable and scannable.

## Current behaviour

`README.md` sections (in order):

1. Usage
2. Per-repo setup
   - Install plugin
   - Install as npm package
   - Create confluence-pages.json
   - Configure credentials
   - Verify page IDs
3. Updating
4. Naming convention
5. License

There is no troubleshooting section. No error symptom reference. No VPN mention. No mention that API tokens expire.

The error messages in source that this section mirrors:

| Source location | Error text |
|---|---|
| `push-to-confluence.mjs:99` | `"API token rejected — generate a new one at https://id.atlassian.com → Security → API tokens (note: tokens created before 2025 may have expired)"` |
| `push-to-confluence.mjs:100` | `"Access denied — check that your API token has permission to read and write this page"` |
| `push-to-confluence.mjs:101` | `"Page ID not found — check confluence-pages.json or verify the page still exists"` |
| `push-to-confluence.mjs:102` | `` `Page was updated by someone else. Retry with: npm run confluence -- ${process.argv[2]} ${process.argv[3]}` `` |
| `push-to-confluence.mjs:88` | `"Cannot reach Confluence — check VPN/network connectivity"` |
| `push-to-confluence.mjs:425-428` | `"Markdown converted to empty HTML — check the source file is not empty"` |
| `push-to-confluence.mjs:218-221` | `"confluence-pages.json not found — create it or pass a page ID directly"` |
| `push-to-confluence.mjs:54` | `` "Run `npm run confluence -- --setup` to configure credentials" `` |

## Target behaviour

`README.md` gains a "## Troubleshooting" section immediately before "## Updating". The section contains one subsection per common failure mode. Each subsection:

- Starts with a `###` heading phrased as the user sees it (the HTTP status code or the symptom keyword).
- Gives one or two sentences explaining the most likely cause.
- Gives the exact corrective action (command to run, URL to visit, person to contact).
- Does not duplicate prose from the setup section — links back by heading anchor where relevant.

After this spec the section reads exactly as shown in the Implementation steps below. Do not paraphrase.

## Implementation steps

### Step 1 — Locate the insertion point in README.md

Find the line in `README.md` that reads `## Updating` (the exact heading for the Updating section). Insert the new section **immediately before** that line, with one blank line separating the new section from the Updating heading.

### Step 2 — Insert the Troubleshooting section

The exact Markdown to insert (copy verbatim, preserving blank lines between subsections):

````markdown
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

Either create `confluence-pages.json` at your repository root (see [Per-repo setup → Create confluence-pages.json](#create-confluence-pagesjson) above), or pass the numeric Confluence page ID directly as the first argument instead of a key name.

### Credentials not configured

Run `pnpm confluence --setup` (or `node scripts/push-to-confluence.mjs --setup`) to store your Confluence URL, email, and API token in `~/.unic-confluence.json`.
Alternatively, set the environment variables `CONFLUENCE_URL`, `CONFLUENCE_USER`, and `CONFLUENCE_TOKEN`.
````

### Step 3 — Verify section heading anchor

The `confluence-pages.json` subsection links to `#create-confluence-pagesjson`. Check that the existing README has a heading that renders to that anchor. In standard GitHub Markdown, `## Create confluence-pages.json` becomes `#create-confluence-pagesjson`. If the existing heading is worded differently, adjust the anchor link in the troubleshooting entry to match the actual heading, or leave it as a plain reference without a link.

### Step 4 — Update the 409 retry command reference

The troubleshooting entry for 409 says "Re-run the same command". Once spec 12 lands, the runtime error message will also print the exact command. These two are consistent — no change needed to keep them in sync.

## Test cases

### TC-01: Section renders correctly on GitHub
Push the change and open `README.md` on GitHub. Each `###` heading should appear as a level-3 heading in the rendered view. The fenced code block inside "401 API token rejected" should render as a code block with `sh` syntax highlighting.

### TC-02: Anchor link resolves
Click the link `#create-confluence-pagesjson` in the "confluence-pages.json not found" subsection when viewing the README on GitHub. It should scroll to the correct setup subsection. If it does not, fix the anchor as described in Step 3.

### TC-03: Section position
The `## Troubleshooting` heading must appear after the last Per-repo setup subsection and before `## Updating`. Verify by reading the raw Markdown section order.

### TC-04: No content duplication
No setup instruction is repeated verbatim in the troubleshooting section — it only contains cross-references (links or short mentions). Verify by reading both sections.

### TC-05: All 8 error categories covered
Count the `###` subsections: 401, 403, 404, 409, Network, Empty HTML, confluence-pages.json, Credentials. Exactly 8 subsections present.

## Acceptance criteria

- `README.md` contains a `## Troubleshooting` section
- Section is placed between "Per-repo setup" (or its last subsection) and `## Updating`
- Exactly 8 `###` subsections, one per common failure mode listed in "Current behaviour"
- The 401 subsection includes the `https://id.atlassian.com` URL
- The 401 subsection includes a code block showing how to re-run setup with `pnpm`
- The Network subsection explicitly mentions VPN
- The Network subsection includes the Confluence base URL `https://uniccom.atlassian.net`
- The credentials subsection mentions all three env vars: `CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`
- No `handleHttpError`, `push-to-confluence.mjs`, or internal function names are mentioned in the README (keep user-facing language)
- No changes to any `.mjs` file in this spec

## Verification

```sh
# Confirm section exists
grep -n "## Troubleshooting" README.md

# Confirm all 8 subsections are present
grep -c "^### " README.md
# Expected: 8 (or more if other subsections existed before — adjust count accordingly)

# Confirm VPN mention
grep -i "vpn" README.md

# Confirm credential env vars are mentioned
grep "CONFLUENCE_URL" README.md
grep "CONFLUENCE_USER" README.md
grep "CONFLUENCE_TOKEN" README.md

# Confirm section is before Updating
awk '/^## Troubleshooting/{t=NR} /^## Updating/{u=NR} END{if(t && u && t<u) print "OK: Troubleshooting before Updating"; else print "FAIL"}' README.md
```

## Out of scope

- Do not modify `handleHttpError` in `push-to-confluence.mjs` — the error messages in the source file are separate from the README documentation.
- Do not add a "debug mode" flag or `--verbose` flag — that is a separate feature.
- Do not add screenshots or GIFs to the README.
- Do not rewrite existing README sections — only insert the new Troubleshooting section.
- Do not change the heading hierarchy of existing sections.

## Follow-ups

- Once spec 12 lands (fix `handleHttpError` argv leak), update the 409 troubleshooting entry to show the exact `pnpm confluence <pageArg> <filePath>` retry syntax instead of the generic "re-run the same command".
- Consider adding a "Known limitations" section covering the 5 MB file size limit and single-page-at-a-time constraint.
