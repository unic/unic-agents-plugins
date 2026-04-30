# 03. Refuse Publish Without Markers (Breaking Change → v2.0.0)
**Status: done — 2026-04-24**

**Priority:** P0
**Effort:** M
**Depends on:** 02 (README should document markers before this error starts firing)
**Touches:** `scripts/push-to-confluence.mjs`, `commands/unic-confluence.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

## Context

`injectContent()` at lines 197-199 of `scripts/push-to-confluence.mjs` has a silent foot-gun: when neither text markers nor anchor macros are found on a Confluence page, it appends the new HTML after all existing page content. Running the publish command a second time doubles the content; a third run triples it. This is the worst-case default because it is silent, cumulative, and affects production Confluence pages. The correct default is to refuse and tell the user what to do. An explicit `--replace-all` opt-in flag gives a controlled escape hatch for users who genuinely want to overwrite the full body, with a local backup created automatically as a safety net. This is a breaking change because existing workflows that relied on the append behaviour will now error. The version is bumped to 2.0.0.

## Current behaviour

`scripts/push-to-confluence.mjs`, lines 197-199 (Strategy 3 inside `injectContent`):

```js
// Strategy 3: append (no markers found) — FOOT-GUN: doubles content on each run
return existingBody + "\n" + newHtml;
```

`injectContent` function signature at line 124:

```js
function injectContent(existingBody, newHtml, title) {
```

Call site in `main()`, approximately line 469:

```js
const newBody = injectContent(existingBody, html, title);
```

`import` destructure at line 11:

```js
import {
	chmodSync,
	existsSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "fs";
```

`.claude-plugin/plugin.json` current version:

```json
{
  "version": "1.0.2"
}
```

`.claude-plugin/marketplace.json` current version:

```json
{
  "plugins": [{
    "version": "1.0.2"
  }]
}
```

## Target behaviour

### `scripts/push-to-confluence.mjs`

1. `injectContent` signature changes to accept an options object:
   ```
   injectContent(existingBody, newHtml, title, { replaceAll = false, pageId, version } = {})
   ```

2. Strategy 3 (the append foot-gun at lines 197-199) is replaced with:
   - If `replaceAll` is `true`: write the current `existingBody` to a backup file at `~/.unic-confluence/backups/{pageId}-v{version}.html`, log the backup path to stdout, and return `newHtml` as the full replacement body.
   - If `replaceAll` is `false` (default): print an error message to stderr explaining that no markers were found and exit 1.

3. `main()` parses `--replace-all` and `--dry-run` (see spec 04) from `process.argv` using a flags-first pattern that also filters positional args:
   ```js
   const replaceAll = args.includes("--replace-all");
   const positionalArgs = args.filter(a => !a.startsWith("--"));
   ```

4. The `injectContent` call site passes `{ replaceAll, pageId, version }` so the backup filename is deterministic.

5. `mkdirSync` is added to the existing `fs` import destructure.

6. The backup uses `mkdirSync` (with `{ recursive: true }`) and `writeFileSync` — keeping `injectContent` synchronous.

### `commands/unic-confluence.md`

Step 2 (the pre-flight check) is updated to mention `--replace-all` as an option if the user gets the no-markers error.

### `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`

Version bumped from `1.0.2` to `2.0.0`.

### Edge cases

- Page with valid marker pair → `replaceAll` is never reached; markers take precedence. No backup is created.
- Mismatched labels (start without matching end) → existing error message at lines 130-132 fires before Strategy 3 is reached. Unchanged.
- `--replace-all` with a marker page → markers are found in Strategy 1 or 2 and content is injected normally; `replaceAll` is never consulted. The flag is silently ignored when markers exist.
- `pageId` or `version` undefined when `replaceAll = true` → backup filename degrades gracefully: use `"unknown-page"` for pageId and `"unknown-version"` for version. Log a warning.

## Implementation steps

### Step 1 — Add `mkdirSync` to the `fs` import

File: `scripts/push-to-confluence.mjs`, lines 11-17.

Before:
```js
import {
	chmodSync,
	existsSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "fs";
```

After:
```js
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "fs";
```

### Step 2 — Update `injectContent` signature

File: `scripts/push-to-confluence.mjs`, line 124.

Before:
```js
function injectContent(existingBody, newHtml, title) {
```

After:
```js
function injectContent(existingBody, newHtml, title, { replaceAll = false, pageId, version } = {}) {
```

### Step 3 — Replace Strategy 3 (lines 197-199)

File: `scripts/push-to-confluence.mjs`, lines 197-199.

Before:
```js
	// Strategy 3: append (no markers found) — FOOT-GUN: doubles content on each run
	return existingBody + "\n" + newHtml;
```

After:
```js
	// Strategy 3: no markers found
	if (replaceAll) {
		const safePageId = pageId ?? "unknown-page";
		const safeVersion = version ?? "unknown-version";
		const backupDir = path.join(os.homedir(), ".unic-confluence", "backups");
		mkdirSync(backupDir, { recursive: true });
		const backupPath = path.join(backupDir, `${safePageId}-v${safeVersion}.html`);
		writeFileSync(backupPath, existingBody, "utf8");
		console.log(`Backup saved to ${backupPath}`);
		return newHtml;
	}
	console.error(
		`No [AUTO_INSERT_START:label] / [AUTO_INSERT_END:label] markers found on page "${title}". ` +
		`Add markers to the Confluence page, or use --replace-all to overwrite the full body.`
	);
	process.exit(1);
```

### Step 4 — Update `main()` to parse `--replace-all`

File: `scripts/push-to-confluence.mjs`, `main()` starting at line 388.

Locate the top of `main()`. The current arg parsing reads:

```js
	const args = process.argv.slice(2);
	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--ping") { ... }   // added in spec 01
	if (args[0] === "--verify") { await runVerify(); return; }
	if (args.length < 2) { console.error("Usage: npm run confluence -- {pageId} {file.md}"); process.exit(1); }
	const [pageArg, filePath] = args;
```

Replace the positional-arg extraction portion (the last two lines shown) with:

```js
	const replaceAll = args.includes("--replace-all");
	const positionalArgs = args.filter(a => !a.startsWith("--"));
	if (positionalArgs.length < 2) {
		console.error("Usage: node scripts/push-to-confluence.mjs [--replace-all] {pageId} {file.md}");
		process.exit(1);
	}
	const [pageArg, filePath] = positionalArgs;
```

> Note: If spec 04 (`--dry-run`) has already landed when Ralph picks up this ticket, `dryRun` will already be parsed here. In that case, add `replaceAll` to the existing flags block rather than replacing it. The positional-args filter already handles multiple flags.

### Step 5 — Update the `injectContent` call site

File: `scripts/push-to-confluence.mjs`, approximately line 469 (inside `main()`, after the GET response is parsed to get `existingBody`, `version`, and after `html` is prepared from the Markdown conversion).

Before:
```js
	const newBody = injectContent(existingBody, html, title);
```

After:
```js
	const newBody = injectContent(existingBody, html, title, { replaceAll, pageId, version });
```

> Ralph: `pageId` and `version` are resolved earlier in `main()` (pageId from `resolvePageId(pageArg)` around line 394; version from the GET response body — look for `page.version.number` or equivalent in the response parsing block). Confirm the exact variable names by reading lines 394-469 of the script.

### Step 6 — Update `commands/unic-confluence.md`

File: `commands/unic-confluence.md`.

In step 2 (the pre-flight check description), add a note about `--replace-all` after the existing setup hint:

Before (step 2 body, as updated by spec 01):
```markdown
### 2. Check credentials (quick auth probe)
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --ping

Performs a single HTTP GET to verify credentials are valid. If credentials are missing or rejected, instruct user to run --setup.
```

After:
```markdown
### 2. Check credentials (quick auth probe)
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --ping

Performs a single HTTP GET to verify credentials are valid. If credentials are missing or rejected, instruct user to run --setup.

If the publish step fails with "No markers found", the target Confluence page needs [AUTO_INSERT_START:label] / [AUTO_INSERT_END:label] markers. To overwrite the full page body instead, pass --replace-all as part of $ARGUMENTS.
```

> Note: If spec 01 has NOT yet landed, the step 2 text above will differ. In that case locate the `--verify` text and add the `--replace-all` note below it rather than below `--ping`.

### Step 7 — Version bump

File: `.claude-plugin/plugin.json`

Before:
```json
{
  "author": { "name": "Unic" },
  "commands": ["./commands/unic-confluence.md"],
  "description": "Publish markdown files to Confluence pages via the Confluence v2 API.",
  "name": "unic-confluence",
  "version": "1.0.2"
}
```

After:
```json
{
  "author": { "name": "Unic" },
  "commands": ["./commands/unic-confluence.md"],
  "description": "Publish markdown files to Confluence pages via the Confluence v2 API.",
  "name": "unic-confluence",
  "version": "2.0.0"
}
```

File: `.claude-plugin/marketplace.json`

Locate `"version": "1.0.2"` inside the `plugins` array entry and change to `"version": "2.0.0"`. Also update any top-level `version` field if present.

> Note: Spec 06 will introduce a sync script that derives versions automatically. Until then, update both files manually.

## Test cases

| Scenario | Command | Expected stderr | Expected stdout | Exit code |
|---|---|---|---|---|
| Page has valid marker pair | `node scripts/push-to-confluence.mjs <id> file.md` | (none) | `Published …` or similar success message | 0 |
| Page has no markers, no `--replace-all` | `node scripts/push-to-confluence.mjs <id> file.md` | `No [AUTO_INSERT_START:label] / [AUTO_INSERT_END:label] markers found on page "…". Add markers to the Confluence page, or use --replace-all to overwrite the full body.` | (none) | 1 |
| Page has no markers, `--replace-all` | `node scripts/push-to-confluence.mjs --replace-all <id> file.md` | (none) | `Backup saved to ~/.unic-confluence/backups/<id>-v<version>.html` | 0 (then PUT proceeds) |
| `--replace-all` with marker page | `node scripts/push-to-confluence.mjs --replace-all <id> file.md` | (none) | Normal publish success | 0 |
| Mismatched labels | `node scripts/push-to-confluence.mjs <id> file.md` | `Marker label mismatch on page "…"` (unchanged) | (none) | 1 |
| Backup directory check | After `--replace-all` run | — | `~/.unic-confluence/backups/<id>-v<N>.html` exists with original page HTML | — |

## Acceptance criteria

- Strategy 3 no longer silently appends.
- A page with no markers and no `--replace-all` exits 1 with an error message containing both "Add markers" and "--replace-all".
- A page with no markers and `--replace-all` creates a backup at `~/.unic-confluence/backups/{pageId}-v{version}.html` and returns the new HTML as the full page body.
- A page with valid markers is unaffected by the `--replace-all` flag.
- `mkdirSync` is imported from `fs` (no new top-level imports added).
- `injectContent` remains a synchronous function.
- The call site at approximately line 469 passes `{ replaceAll, pageId, version }`.
- `.claude-plugin/plugin.json` version is `2.0.0`.
- `.claude-plugin/marketplace.json` version is `2.0.0`.
- Lint passes.
- Slash command `/unic-confluence` still works end-to-end for a page that has markers.

## Verification

```sh
# 1. Confirm mkdirSync is imported
grep "mkdirSync" scripts/push-to-confluence.mjs | head -3

# 2. Confirm Strategy 3 no longer has the append
grep -n "existingBody.*newHtml\|newHtml.*existingBody" scripts/push-to-confluence.mjs
# Expected: no match (the append line is gone)

# 3. Confirm error message text is present
grep -n "Add markers to the Confluence page" scripts/push-to-confluence.mjs

# 4. Confirm replaceAll is parsed in main()
grep -n "replaceAll" scripts/push-to-confluence.mjs

# 5. Confirm version bump
grep '"version"' .claude-plugin/plugin.json
grep '"version"' .claude-plugin/marketplace.json
# Both should show "2.0.0"

# 6. Confirm injectContent call site passes options
grep -n "injectContent(" scripts/push-to-confluence.mjs
# Expected: call includes replaceAll, pageId, version

# 7. Manual test — no-markers case (requires a real page ID or mock):
# CONFLUENCE_URL=... CONFLUENCE_USER=... CONFLUENCE_TOKEN=... \
# node scripts/push-to-confluence.mjs <page-without-markers> file.md
# Expected: exit 1, "No markers found" error
```

## Out of scope

- Do not add a `--dry-run` flag (spec 04).
- Do not add `--check-auth` (spec 07).
- Do not modify the anchor-macro (Strategy 2) detection logic.
- Do not modify `handleHttpError`, `httpsRequest`, or credential loading.
- No new npm/pnpm dependencies.
- No test framework (tests are manual CLI invocations as listed above).
- Do not implement multiple marker pairs per page.

## Follow-ups

- Ralph: confirm the exact variable names for `pageId` and `version` at the `injectContent` call site (around line 469) and verify the version is the current page version number from the GET response, not the plugin version.
- Consider a `--replace-all --force` to skip the backup for power users who know what they are doing (deferred).
- After spec 06 (version sync script) lands, remove manual version bump instructions from this spec's implementation steps.
- Update README (spec 02) "What happens without markers" paragraph to reflect the new error + `--replace-all` behaviour once this spec lands.

_Ralph: append findings here._
