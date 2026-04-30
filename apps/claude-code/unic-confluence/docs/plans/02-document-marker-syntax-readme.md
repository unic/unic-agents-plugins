# 02. Document Marker Syntax in README
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** none
**Touches:** `README.md`

## Context

The `[AUTO_INSERT_START:label]` / `[AUTO_INSERT_END:label]` marker syntax is the primary mechanism for safely injecting content into Confluence pages without overwriting surrounding content. It is implemented in `injectContent()` at lines 121-148 of `scripts/push-to-confluence.mjs`, but it is completely absent from `README.md`. Users discovering the plugin for the first time have no way to know they need to set up markers on their Confluence pages before publishing — they will trigger the silent-append foot-gun (Strategy 3, lines 197-199) and discover doubled content after a second publish run. Similarly, the `confluence-pages.json` mapping file is referenced in the script (line 213) but is not documented in the README alongside the usage example. This is a docs-only change; no script logic is touched.

## Current behaviour

`README.md` has a "Usage" section that shows how to invoke the script but does not mention:

- The `[AUTO_INSERT_START:label]` / `[AUTO_INSERT_END:label]` markers.
- How to add markers to a Confluence page.
- That labels are case-sensitive.
- What happens when markers are absent (today: silently appends; after spec 03: errors with a hint).
- The legacy `md-start` / `md-end` anchor-macro fallback.
- The `confluence-pages.json` file format or where it lives.

The "Per-repo setup" section (if it exists) or equivalent does not cover page preparation.

Relevant source code for accuracy:

`scripts/push-to-confluence.mjs`, lines 121-148 (marker detection and injection):
```js
const TEXT_START_RE = /(?:<p>\s*)?\[AUTO_INSERT_START:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
const TEXT_END_RE   = /(?:<p>\s*)?\[AUTO_INSERT_END:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;

function injectContent(existingBody, newHtml, title) {
	const hasStart = TEXT_START_RE.test(existingBody);
	const hasEnd   = TEXT_END_RE.test(existingBody);

	// Strategy 1: plain-text markers
	if (hasStart || hasEnd) {
		if (hasStart !== hasEnd) {
			console.error(`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END]...`);
			process.exit(1);
		}
		// ... slices body and injects newHtml between markers
	}
	// Strategy 2: anchor macros (legacy fallback)
	// ...
	// Strategy 3: append (no markers found) — FOOT-GUN: doubles content on each run
	return existingBody + "\n" + newHtml;
}
```

`scripts/push-to-confluence.mjs`, lines 207-252 (`resolvePageId` reading `confluence-pages.json`):
```js
function resolvePageId(arg) {
	if (isNumericId(arg)) { ... }
	const pagesPath = path.join(process.cwd(), "confluence-pages.json");
	if (!existsSync(pagesPath)) { console.error("confluence-pages.json not found ..."); process.exit(1); }
	// ... parses JSON and returns pages[arg]
}
```

## Target behaviour

`README.md` gains a "Page setup" section (placed between the existing "Usage" section and "Per-repo setup", or appended to "Usage" if "Per-repo setup" does not exist). The section covers:

1. **What markers look like** — show the raw text a user types into Confluence.
2. **How to add them** — step-by-step: open the Confluence page → Edit → type the marker lines → Save.
3. **Label rules** — labels are case-sensitive; the label in `[AUTO_INSERT_START:label]` must exactly match the label in `[AUTO_INSERT_END:label]`.
4. **What happens without markers** — currently silently appends (doubles content on re-run); after spec 03 this will become an explicit error with a `--replace-all` opt-out.
5. **Legacy anchor-macro fallback** — mention that old pages may use Confluence anchor macros named `md-start` / `md-end` instead of text markers; this is deprecated and new pages should use text markers.
6. **`confluence-pages.json`** — document the file format and that it lives at the repo root; show a minimal example alongside the usage example.

The section must include the exact copy-paste example block shown below so users can drop it straight into Confluence:

```
[AUTO_INSERT_START: my-docs]

(Claude Code will inject content here)

[AUTO_INSERT_END: my-docs]
```

## Implementation steps

### Step 1 — Read the current `README.md`

Read the full file to understand the existing section order, heading levels, and writing style before editing.

File: `README.md` (repo root).

### Step 2 — Add `confluence-pages.json` example to the Usage section

Locate the Usage section. After the existing usage invocation example (e.g. `pnpm confluence my-page docs/my-file.md`), add a note explaining the `my-page` argument can be a numeric Confluence page ID **or** a key defined in `confluence-pages.json`. Append a minimal example:

```markdown
#### `confluence-pages.json` (optional key mapping)

Place this file at your repo root to use short keys instead of numeric page IDs:

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
```

### Step 3 — Add the "Page setup" section

After the Usage section (or after the `confluence-pages.json` sub-section added in step 2), insert the following new section. Match the existing heading level convention in the README (use `##` if top-level sections use `##`, `###` if they use `###`).

Suggested content (adapt heading level to match the existing document):

```markdown
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
```

### Step 4 — Verify no unintended whitespace or broken Markdown

After editing, re-read `README.md` and confirm:
- No raw `[AUTO_INSERT_START` / `[AUTO_INSERT_END` markers appear outside fenced code blocks (they would be mistaken for actual page markers if a tool renders the README as Confluence content).
- All fenced code blocks are properly closed.
- All heading levels are consistent with the rest of the document.

## Test cases

This is a docs-only change; there are no script test cases.

| Check | Expected result |
|---|---|
| `grep "AUTO_INSERT_START" README.md` | At least one occurrence (in the docs example) |
| `grep "confluence-pages.json" README.md` | At least one occurrence with a JSON example |
| `grep "md-start" README.md` | At least one occurrence in the legacy section |
| `grep "case-sensitive" README.md` | Mentioned |
| README renders correctly in GitHub Markdown preview | No broken fences, all code blocks closed |

## Acceptance criteria

- `README.md` contains a "Page setup" (or equivalent title) section documenting the marker syntax.
- The exact copy-paste block `[AUTO_INSERT_START: my-docs]` / `[AUTO_INSERT_END: my-docs]` appears verbatim in a fenced code block.
- `confluence-pages.json` format is documented with a JSON example.
- Label case-sensitivity is explicitly stated.
- Legacy `md-start` / `md-end` anchor macros are mentioned as deprecated.
- The consequence of missing markers (silent append / future error) is noted.
- No changes made to any file other than `README.md`.
- Lint passes (Markdown linting if configured; otherwise manual review).
- Slash command `/unic-confluence` still works end-to-end (no script changes).

## Verification

```sh
# 1. Confirm marker docs are present
grep -c "AUTO_INSERT_START" README.md
# Expected: >= 1

# 2. Confirm confluence-pages.json is documented
grep -c "confluence-pages.json" README.md
# Expected: >= 1

# 3. Confirm legacy anchor section exists
grep -c "md-start" README.md
# Expected: >= 1

# 4. Confirm no script files were modified
git diff --name-only
# Expected: only README.md
```

## Out of scope

- Do not modify `scripts/push-to-confluence.mjs`.
- Do not modify `commands/unic-confluence.md`.
- Do not document `--dry-run` — that flag does not exist yet (spec 04).
- Do not document `--replace-all` — that flag does not exist yet (spec 03).
- Do not document `--check-auth` — that subcommand does not exist yet (spec 07).
- Do not change marker behaviour, regex patterns, or any logic.
- No version bump.

## Follow-ups

- After spec 03 lands, update the "What happens without markers" paragraph to describe the new error behaviour and mention `--replace-all`.
- After spec 04 lands, add a short `--dry-run` note to the Usage section.
- Consider adding a troubleshooting section covering the 401/403/404 error messages that `handleHttpError` produces (lines 98-106).

_Ralph: append findings here._
