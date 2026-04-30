# 22. Auto-populate `confluence-pages.json` aliases
**Status: done — 2026-04-27**

**Priority:** P1
**Effort:** M
**Version impact:** minor
**Depends on:** spec 09 (Vitest harness), spec 15 (`CliError` class), spec 19 (`pnpm bump`), spec 20 (`pnpm verify:changelog`)
**Touches:** `scripts/push-to-confluence.mjs`, `scripts/lib/slug.mjs` (create), `scripts/lib/pages-file.mjs` (create), `scripts/lib/slug.test.mjs` (create), `scripts/lib/pages-file.test.mjs` (create), `commands/unic-confluence.md`, `README.md`, `CHANGELOG.md`, `docs/plans/README.md`, `package.json` (extend `test` script)

## Context

A Confluence page is addressable two ways: by a key looked up in `confluence-pages.json` (e.g. `spec-42410`) or by a raw numeric page ID (e.g. `804848595`). The lookup file lives at `process.cwd()/confluence-pages.json` and is read by `resolvePageId()` in `scripts/lib/resolve.mjs:24-59`. Today nothing writes to it — users who publish by raw ID either re-type the ID forever or hand-edit the file. There is also no built-in way to list configured aliases short of `cat confluence-pages.json`.

This spec closes both gaps:

1. After a successful publish-by-numeric-ID, the CLI slugifies the Confluence page's `title` and writes it as a new alias into `confluence-pages.json` at `cwd`, telling the user `✓ Saved alias "<slug>" → <id>`.
2. A new `--list` flag prints the configured aliases as a sorted two-column table.

Both entry points (the `node scripts/push-to-confluence.mjs` npm path and the `/unic-confluence` slash command) benefit because `commands/unic-confluence.md` is a thin pass-through that shells out to the same script. The on-disk schema stays `key → integer`, keeping this a **minor** bump and avoiding the "richer record" path explicitly flagged as out-of-scope in `CLAUDE.md` "Do not add" (lines 74-76).

## Current behaviour

- `scripts/push-to-confluence.mjs:386-388`: `pageArg = positionalArgs[0]; … const pageId = resolvePageId(pageArg);` — once `resolvePageId` returns, the script no longer knows whether the original arg was numeric.
- `scripts/lib/resolve.mjs:12-14`: `isNumericId(arg)` exists and is reusable.
- `confluence-pages.json` is purely read-only: only read sites are `resolve.mjs:41` and `runVerify` at `push-to-confluence.mjs:188`. Zero write sites.
- `runVerify` already filters the `_comment` key (`push-to-confluence.mjs:193,199`) — same convention applies here.
- `commands/unic-confluence.md:49-52` shells out to `node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" <page-key-or-id> <markdown-file>`. CLI changes are inherited.
- No slug helper anywhere (`grep -r slug scripts/ commands/` → 0 hits).
- The script's only `writeFileSync` is the credentials write at `push-to-confluence.mjs:322` (chmod 600). `confluence-pages.json` must NOT be chmod'd — it is checked into consumer repos.
- Test suite: `scripts/lib/resolve.test.mjs` backs up `confluence-pages.json` around runs (lines 48-65) and spawns subprocesses with `cwd: "/tmp"` (lines 88-92, 107-111). The new auto-save logic must only fire on the publish code path so these tests remain green untouched.
- `package.json` `test` script lists test files explicitly:
  ```json
  "test": "node --test scripts/lib/frontmatter.test.mjs scripts/lib/inject.test.mjs scripts/lib/resolve.test.mjs"
  ```

## Target behaviour

### A. Auto-save alias after publish-by-numeric-ID

Triggers iff **all** are true:
- `isNumericId(pageArg)` was true (capture this before `resolvePageId` normalizes it).
- `--dry-run` was not passed.
- `--no-save` (new flag) was not passed.
- The PUT succeeded (i.e. control reached the `✓ Published` log at line 476).

Then, immediately before the `✓ Published` log:

1. Compute `pagesPath = path.join(process.cwd(), "confluence-pages.json")`.
2. Load the file via `readPagesFile(cwd)` — returns `{ pages: object | null, path }`. If absent, treat `pages` as `{}`.
3. Reverse-lookup via `findAliasForId(pages, pageId)`. If non-null → log `ℹ Page ${pageId} already aliased as "${existing}"` and return without writing.
4. Otherwise compute `baseSlug = slugify(title)`. Compute `alias = pickAvailableAlias(pages, baseSlug, pageId)` (resolves collisions and empty-slug fallback).
5. `writePagesFile(pagesPath, appendAlias(pages, alias, pageId))`.
6. Log `✓ Saved alias "${alias}" → ${pageId} in confluence-pages.json`.

Any thrown error from steps 1-5 is non-fatal: catch and log `⚠ Could not save alias: ${err.message}`. The publish itself already succeeded — exit code stays 0.

### B. New flag: `--list`

Dispatched at the top of `main()` alongside `--setup` / `--check-auth` / `--verify`.

- Reads `confluence-pages.json` from `process.cwd()`.
- Missing file → `console.log("No confluence-pages.json in " + process.cwd())`; exit 0.
- Empty or only `_comment` → `console.log("No aliases configured yet.")`; exit 0.
- Otherwise prints a two-column table sorted alphabetically by alias, `_comment` filtered:
  ```
  alias                                     page id
  ────────────────────────────────────────  ──────────────
  profile-features                          804848595
  spec-42410                                912345678
  ```
- No auth needed; no network call.

### C. New flag: `--no-save`

Opt-out for §A. Detected via `args.includes("--no-save")` next to `--dry-run` (`push-to-confluence.mjs:378-379`).

### D. Slugification rules (`slugify(title)`)

1. `String(title ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")` — strip combining diacritics.
2. `.toLowerCase()`.
3. Replace any `[^a-z0-9]+` run with `"-"`.
4. Trim leading and trailing `-`.
5. Truncate to 60 chars; re-trim trailing `-` after truncation.
6. Return `""` if nothing remains. Caller substitutes `page-${pageId}`.

### E. Collision rules (`pickAvailableAlias(pages, baseSlug, pageId)`)

- If `baseSlug === ""` → start from `page-${pageId}`.
- If the candidate is not a key in `pages` → use it.
- Else append `-2`, `-3`, … until free. (`page-<id>-2` is acceptable in the empty-slug fallback path.)

### F. Slash command (`commands/unic-confluence.md`)

- Step 3 flag list (lines 55-57): add `--no-save — skip auto-saving the alias when publishing by numeric page ID`.
- New short Step 5 documenting `node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --list`.
- Step 4 "Report result" (lines 59-62): if the script's stdout contains `✓ Saved alias` or `ℹ Page … already aliased`, surface that line verbatim to the user.

No logic is duplicated — the command remains a pass-through.

## Affected files

| File | Change |
|---|---|
| `scripts/lib/slug.mjs` | Create — single export `slugify(title)`. |
| `scripts/lib/pages-file.mjs` | Create — pure helpers: `readPagesFile`, `findAliasForId`, `pickAvailableAlias`, `appendAlias`, `writePagesFile`, `listAliases`. |
| `scripts/lib/slug.test.mjs` | Create — Node test runner cases for slugifier. |
| `scripts/lib/pages-file.test.mjs` | Create — Node test runner cases for pure helpers. |
| `scripts/push-to-confluence.mjs` | Wire `--list`, `--no-save`, and the post-PUT auto-save block. |
| `commands/unic-confluence.md` | Document `--list`, `--no-save`, surface save-confirmation lines. |
| `README.md` | New "Auto-aliasing" subsection; document `--list` and `--no-save`; note known concurrency limitation. |
| `CHANGELOG.md` | Three bullets under `## [Unreleased]` → `### Added` (auto-save, `--list`, `--no-save`). |
| `docs/plans/README.md` | Append row 22 to the execution table. |
| `package.json` | Append the two new test files to the `test` script. |

## Implementation steps

### Step 1 — Create `scripts/lib/slug.mjs`

```js
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later

const MAX_LEN = 60;

/**
 * Slugify a Confluence page title into a safe alias key for confluence-pages.json.
 * Returns "" when the title produces no slug characters; caller substitutes a fallback.
 *
 * @param {unknown} title
 * @returns {string}
 */
export function slugify(title) {
	const raw = String(title ?? "")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!raw) return "";
	return raw.slice(0, MAX_LEN).replace(/-+$/, "");
}
```

### Step 2 — Create `scripts/lib/pages-file.mjs`

```js
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FILENAME = "confluence-pages.json";

/**
 * @param {string} cwd
 * @returns {{ pages: Record<string, unknown>, path: string, existed: boolean }}
 */
export function readPagesFile(cwd) {
	const p = path.join(cwd, FILENAME);
	if (!existsSync(p)) return { pages: {}, path: p, existed: false };
	const pages = /** @type {Record<string, unknown>} */ (
		JSON.parse(readFileSync(p, "utf8"))
	);
	return { pages, path: p, existed: true };
}

/**
 * @param {Record<string, unknown>} pages
 * @param {number} pageId
 * @returns {string | null}
 */
export function findAliasForId(pages, pageId) {
	for (const [k, v] of Object.entries(pages)) {
		if (k === "_comment") continue;
		if (typeof v === "number" && v === pageId) return k;
	}
	return null;
}

/**
 * @param {Record<string, unknown>} pages
 * @param {string} baseSlug
 * @param {number} pageId
 * @returns {string}
 */
export function pickAvailableAlias(pages, baseSlug, pageId) {
	const start = baseSlug || `page-${pageId}`;
	if (!(start in pages)) return start;
	for (let i = 2; ; i++) {
		const candidate = `${start}-${i}`;
		if (!(candidate in pages)) return candidate;
	}
}

/**
 * Returns a new object with the alias appended, preserving existing key order.
 *
 * @param {Record<string, unknown>} pages
 * @param {string} alias
 * @param {number} pageId
 * @returns {Record<string, unknown>}
 */
export function appendAlias(pages, alias, pageId) {
	return { ...pages, [alias]: pageId };
}

/**
 * @param {string} filePath
 * @param {Record<string, unknown>} pages
 */
export function writePagesFile(filePath, pages) {
	writeFileSync(filePath, `${JSON.stringify(pages, null, 2)}\n`, "utf8");
}

/**
 * @param {Record<string, unknown>} pages
 * @returns {Array<[string, number]>}
 */
export function listAliases(pages) {
	const out = /** @type {Array<[string, number]>} */ ([]);
	for (const [k, v] of Object.entries(pages)) {
		if (k === "_comment") continue;
		if (typeof v === "number") out.push([k, v]);
	}
	out.sort(([a], [b]) => a.localeCompare(b));
	return out;
}
```

### Step 3 — Create `scripts/lib/slug.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug.mjs";

test("plain ASCII title", () => assert.equal(slugify("My Page Title"), "my-page-title"));
test("strips diacritics", () => assert.equal(slugify("Perfil de l'usuari"), "perfil-de-l-usuari"));
test("collapses repeated separators", () => assert.equal(slugify("a   b///c"), "a-b-c"));
test("trims leading/trailing dashes", () => assert.equal(slugify("--Hello--"), "hello"));
test("CJK only returns empty", () => assert.equal(slugify("漢字"), ""));
test("emoji only returns empty", () => assert.equal(slugify("🚀✨"), ""));
test("null returns empty", () => assert.equal(slugify(null), ""));
test("undefined returns empty", () => assert.equal(slugify(undefined), ""));
test("truncates at 60 chars", () => {
	const out = slugify("a".repeat(80));
	assert.equal(out.length, 60);
	assert.ok(!out.endsWith("-"));
});
test("no trailing dash after truncation at word boundary", () => {
	const out = slugify("x".repeat(58) + "    " + "y".repeat(10));
	assert.ok(!out.endsWith("-"));
	assert.ok(out.length <= 60);
});
```

### Step 4 — Create `scripts/lib/pages-file.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
	appendAlias,
	findAliasForId,
	listAliases,
	pickAvailableAlias,
	readPagesFile,
	writePagesFile,
} from "./pages-file.mjs";

test("findAliasForId skips _comment and non-numbers", () => {
	const pages = { _comment: "x", foo: 111, bar: "not-a-number", baz: 222 };
	assert.equal(findAliasForId(pages, 222), "baz");
	assert.equal(findAliasForId(pages, 999), null);
});

test("pickAvailableAlias returns base when free", () => {
	assert.equal(pickAvailableAlias({}, "foo", 42), "foo");
});

test("pickAvailableAlias appends -2 then -3 on collision", () => {
	const pages = { foo: 1, "foo-2": 2 };
	assert.equal(pickAvailableAlias(pages, "foo", 9), "foo-3");
});

test("pickAvailableAlias falls back to page-<id> on empty slug", () => {
	assert.equal(pickAvailableAlias({}, "", 555), "page-555");
});

test("appendAlias preserves _comment-first ordering", () => {
	const pages = { _comment: "x", a: 1, b: 2 };
	const out = appendAlias(pages, "c", 3);
	assert.deepEqual(Object.keys(out), ["_comment", "a", "b", "c"]);
	assert.equal(out["c"], 3);
});

test("writePagesFile produces 2-space indent with trailing newline", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "pages-"));
	const p = path.join(dir, "confluence-pages.json");
	writePagesFile(p, { foo: 1 });
	assert.equal(readFileSync(p, "utf8"), '{\n  "foo": 1\n}\n');
	rmSync(dir, { recursive: true, force: true });
});

test("readPagesFile returns existed=false when absent", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "pages-"));
	const out = readPagesFile(dir);
	assert.equal(out.existed, false);
	assert.deepEqual(out.pages, {});
	rmSync(dir, { recursive: true, force: true });
});

test("listAliases sorts alphabetically and filters _comment and non-numbers", () => {
	const pages = { _comment: "x", zoo: 3, alpha: 1, beta: "no" };
	assert.deepEqual(listAliases(pages), [["alpha", 1], ["zoo", 3]]);
});
```

### Step 5 — Wire the CLI in `scripts/push-to-confluence.mjs`

a. Add imports after the existing `./lib/*` import block:

```js
import { isNumericId } from "./lib/resolve.mjs";
import { slugify } from "./lib/slug.mjs";
import {
	appendAlias,
	findAliasForId,
	listAliases,
	pickAvailableAlias,
	readPagesFile,
	writePagesFile,
} from "./lib/pages-file.mjs";
```

b. Add a `runList()` helper near the other top-level helpers (before `main()`):

```js
function runList() {
	let res;
	try {
		res = readPagesFile(process.cwd());
	} catch (err) {
		throw new CliError(
			`invalid JSON in confluence-pages.json — ${/** @type {Error} */ (err).message}`,
		);
	}
	if (!res.existed) {
		console.log(`No confluence-pages.json in ${process.cwd()}`);
		return;
	}
	const rows = listAliases(res.pages);
	if (rows.length === 0) {
		console.log("No aliases configured yet.");
		return;
	}
	const aliasW = Math.max(5, ...rows.map(([k]) => k.length));
	console.log(`${"alias".padEnd(aliasW)}  page id`);
	console.log(`${"─".repeat(aliasW)}  ──────────────`);
	for (const [k, v] of rows) console.log(`${k.padEnd(aliasW)}  ${v}`);
}
```

c. In `main()`, add `--list` dispatch after the `--verify` branch (~line 376):

```js
if (args[0] === "--list") {
	runList();
	return;
}
```

d. Extend flag parsing at line ~378:

```js
const dryRun = args.includes("--dry-run");
const replaceAll = args.includes("--replace-all");
const noSave = args.includes("--no-save");
```

e. Capture `wasNumericArg` right after `pageArg` is read (~line 386), before `resolvePageId`:

```js
const pageArg = positionalArgs[0] ?? "";
const wasNumericArg = isNumericId(pageArg);
```

f. Update the usage string in the `positionalArgs.length < 2` error at line 383:

```
"Usage: node scripts/push-to-confluence.mjs [--dry-run] [--replace-all] [--no-save] {pageId} {file.md}"
```

g. Insert the auto-save block immediately before the `✓ Published` log at line 476:

```js
if (wasNumericArg && !dryRun && !noSave) {
	try {
		const { pages, path: pagesPath } = readPagesFile(process.cwd());
		const existing = findAliasForId(pages, pageId);
		if (existing) {
			console.log(`ℹ Page ${pageId} already aliased as "${existing}"`);
		} else {
			const alias = pickAvailableAlias(pages, slugify(title), pageId);
			writePagesFile(pagesPath, appendAlias(pages, alias, pageId));
			console.log(`✓ Saved alias "${alias}" → ${pageId} in confluence-pages.json`);
		}
	} catch (err) {
		console.error(`⚠ Could not save alias: ${/** @type {Error} */ (err).message}`);
	}
}
```

### Step 6 — Update `commands/unic-confluence.md`

In Step 3 flag list (after `--replace-all`), append:

```markdown
- `--no-save` — skip auto-saving the alias when publishing by numeric page ID
```

In Step 4 "Report result", append a sentence:

```markdown
If stdout includes `✓ Saved alias` or `ℹ Page <id> already aliased as`, surface that line verbatim to the user.
```

After Step 4, add a new Step 5:

```markdown
### 5. List configured aliases

To list all configured aliases in the current repo:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --list
```

Prints a two-column table of `alias → page id` from `confluence-pages.json`. Reports a friendly message if the file is missing or has no aliases.
```

### Step 7 — README "Auto-aliasing" subsection

Add after the CLI usage block in the "Usage" section:

```markdown
### Auto-aliasing

Publishing by raw numeric page ID auto-saves a slugified alias derived from the Confluence page's title into `confluence-pages.json` at the current working directory. Subsequent publishes can reference the page by its alias.

- The slug is lowercased, ASCII-only, dash-separated, max 60 chars.
- If the slug collides with another alias, `-2`, `-3`, … is appended.
- If the page ID is already aliased, no write happens (the existing alias is reported).
- Pass `--no-save` to skip auto-saving for a single run.

List all aliases:

```sh
node scripts/push-to-confluence.mjs --list
```

**Known limitation:** the file write is not atomic. Two concurrent publishes against the same `confluence-pages.json` may race; one update will be lost.
```

### Step 8 — CHANGELOG

Under `## [Unreleased]` → `### Added`, replace `- (none)` with:

```markdown
- Auto-saves a slugified alias into `confluence-pages.json` after publishing by raw numeric page ID; reports the new alias to the user.
- `--list` flag prints configured aliases as a sorted two-column table.
- `--no-save` flag opts out of alias auto-saving.
```

### Step 9 — `package.json` test script

Replace the `"test"` entry value:

```json
"test": "node --test scripts/lib/frontmatter.test.mjs scripts/lib/inject.test.mjs scripts/lib/resolve.test.mjs scripts/lib/slug.test.mjs scripts/lib/pages-file.test.mjs"
```

### Step 10 — Update `docs/plans/README.md`

Append after the spec 21 row in the execution table:

```markdown
| 22 | [Auto-populate confluence-pages.json aliases](./22-auto-populate-aliases.md) | P1 | — |
```

### Step 11 — Bump and verify

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm bump minor
pnpm verify:changelog
git add -A
git commit -m "feat(spec-22): auto-populate confluence-pages.json aliases (vX.Y.Z)"
```

## Test cases

| Scenario | Action | Expected outcome |
|---|---|---|
| First publish by numeric ID, no file | `node push-to-confluence.mjs 12345 doc.md` (cwd has no `confluence-pages.json`) | After PUT: `confluence-pages.json` created with `{ "<slug>": 12345 }`; stdout includes `✓ Saved alias`. |
| First publish by numeric ID, existing file with `_comment` | Same, but file pre-populated with `{ "_comment": "x", "other": 999 }` | New key appended after `other`; `_comment` still first; stdout includes `✓ Saved alias`. |
| Slug collision | File already has `{ "my-page": 111 }`; publish ID 222 whose title slugifies to `my-page` | New entry `"my-page-2": 222`; stdout reports the `-2` alias. |
| Page ID already aliased | File has `{ "alpha": 12345 }`; publish 12345 again | No write; stdout: `ℹ Page 12345 already aliased as "alpha"`. |
| Empty slug fallback | Title is `🚀✨`; publish ID 777 | Alias becomes `page-777`. |
| `--dry-run` with numeric ID | `--dry-run 12345 doc.md` | No write; no `✓ Saved alias` log; existing dry-run block runs. |
| `--no-save` with numeric ID | `--no-save 12345 doc.md` | PUT succeeds; file untouched; no save log. |
| Publish by KEY (not numeric) | `node push-to-confluence.mjs spec-1 doc.md` | No auto-save attempted; existing behaviour unchanged. |
| `--list` with no file | `--list` in clean cwd | Prints `No confluence-pages.json in <cwd>`; exit 0. |
| `--list` with only `_comment` | `--list` against `{ "_comment": "x" }` | Prints `No aliases configured yet.`; exit 0. |
| `--list` populated | `--list` against three entries | Prints alphabetised table; `_comment` filtered. |
| Save failure non-fatal | Make `confluence-pages.json` read-only, publish numeric | PUT succeeds; stderr has `⚠ Could not save alias`; exit code is still 0. |
| Malformed JSON | Existing file is invalid JSON, publish numeric | Stderr `⚠ Could not save alias: …`; exit 0; file untouched. |

## Verification

```sh
# 1. Pure-function tests
pnpm test
# Expected: all new slug + pages-file cases pass; existing suite green.

# 2. Type + lint
pnpm typecheck && pnpm lint

# 3. Manual --list (no auth needed)
mkdir -p /tmp/confl-list-test && cd /tmp/confl-list-test
node /path/to/scripts/push-to-confluence.mjs --list
# Expected: "No confluence-pages.json in /tmp/confl-list-test"

echo '{"_comment":"x","spec-1":111,"alpha":222}' > confluence-pages.json
node /path/to/scripts/push-to-confluence.mjs --list
# Expected: two-row table sorted (alpha, spec-1).

# 4. End-to-end auto-save (requires real Confluence creds + test page)
mkdir -p /tmp/confl-save-test && cd /tmp/confl-save-test
node /path/to/scripts/push-to-confluence.mjs <real-test-page-id> /path/to/some.md
cat confluence-pages.json
# Expected: file contains a slugified alias → <real-test-page-id>.

# Run again:
node /path/to/scripts/push-to-confluence.mjs <real-test-page-id> /path/to/some.md
# Expected: stdout has "ℹ Page <id> already aliased as ..."

# 5. Changelog gate
pnpm verify:changelog
# Expected: passes.
```

## Acceptance criteria

- [ ] `docs/plans/README.md` execution table includes a row for spec 22.
- [ ] `scripts/lib/slug.mjs` + `scripts/lib/pages-file.mjs` created, JSDoc-typed, `// @ts-check`'d.
- [ ] `pnpm test` runs the two new test files; all cases pass; existing tests still pass.
- [ ] `--list` prints sorted aliases with `_comment` filtered; handles missing/empty file gracefully.
- [ ] Publishing by numeric ID without `--dry-run`/`--no-save` writes a slugified alias and logs `✓ Saved alias …`.
- [ ] Publishing by numeric ID when the page is already aliased logs `ℹ Page <id> already aliased as "<key>"` and does NOT rewrite the file.
- [ ] Publishing by KEY (non-numeric) does NOT write the file.
- [ ] `--dry-run` and `--no-save` paths do NOT write the file.
- [ ] Save failures are non-fatal: warning on stderr, exit code 0.
- [ ] `_comment` key (if present) stays first in `confluence-pages.json` after writes.
- [ ] `commands/unic-confluence.md` documents `--list` and `--no-save`; the command remains a pass-through.
- [ ] `README.md` has the "Auto-aliasing" subsection with the known-concurrency limitation noted.
- [ ] `CHANGELOG.md` `[Unreleased]` has the three `### Added` bullets.
- [ ] `pnpm bump minor` lands the version bump; `pnpm verify:changelog` passes.

## Out of scope

- Writing `confluence-pages.json` on publish-by-key (already aliased by definition).
- Any schema change beyond `key → integer` (titles, timestamps, nested objects). Explicitly forbidden by `CLAUDE.md` lines 74-76 without maintainer sign-off.
- Renaming or deleting aliases via CLI — hand-edit the file.
- Atomic file writes / cross-process locking. The known concurrency limitation is documented; not fixed.
- A `package.json` `confluence:list` shortcut. Consumer repos add their own per `CLAUDE.md` line 23.
- Any change to the slash command behaviour beyond documentation — the command stays a pure pass-through.
- Slug locale customisation (no `localeCompare` collation, no per-language stemming). The slug is ASCII-stripped Unicode normalisation, full stop.

_Ralph: append findings here._
