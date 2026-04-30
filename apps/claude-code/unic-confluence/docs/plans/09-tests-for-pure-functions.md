# 09. Tests for Pure Functions
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** M
**Depends on:** spec 08 (tightened `stripFrontmatter` — extract the updated version, not the old one); spec 05 (if `postProcessHtml` is to be tested here, it needs to be written first; it can be added in a follow-up)
**Touches:** `scripts/lib/inject.mjs` (new), `scripts/lib/frontmatter.mjs` (new), `scripts/lib/resolve.mjs` (new), `scripts/lib/inject.test.mjs` (new), `scripts/lib/frontmatter.test.mjs` (new), `scripts/lib/resolve.test.mjs` (new), `scripts/push-to-confluence.mjs`, `package.json`

## Context

Three functions in `push-to-confluence.mjs` are pure (or near-pure) and critical to correctness: `stripFrontmatter` (lines 113–117), `injectContent` (lines 126–199), and `resolvePageId` (lines 207–252). They are untested. The P2 refactors planned in specs 12, 13, and 15 will touch `injectContent` directly (adding error on missing markers) and `resolvePageId` (replacing `process.exit` with a `CliError` class). Before those changes land, these functions need a test harness so regressions are caught immediately rather than at manual test time.

This spec extracts the three functions into a `scripts/lib/` module directory and introduces a `node --test` suite covering the documented behaviours. No new test framework (vitest, jest, mocha) is added — `node:test` is available in Node 18+ and is sufficient for synchronous pure-function tests.

The extraction also resolves a secondary concern: `push-to-confluence.mjs` uses `const require = createRequire(import.meta.url)` solely to `require("marked")`. `marked` 17.0.5 ships with an ESM-compatible entry point in its `exports` field. Switching to `import { marked } from "marked"` removes the CommonJS shim entirely, making the file a clean ESM module.

## Current behaviour

All three functions are defined inline in `scripts/push-to-confluence.mjs`:

- `stripFrontmatter` — lines 113–117
- `injectContent` (plus `TEXT_START_RE`, `TEXT_END_RE`) — lines 121–199
- `isNumericId`, `resolvePageId` — lines 203–252

The `createRequire` shim is at lines 11, 24–25:

```js
import { createRequire } from "module";   // line 11 (in the import block)
// ...
const require = createRequire(import.meta.url);  // line 24
const { marked } = require("marked");            // line 25
```

There is no `scripts/lib/` directory. There is no `test` script in `package.json`.

## Target behaviour

After this spec:

1. `scripts/lib/inject.mjs` exports `injectContent`, `TEXT_START_RE`, `TEXT_END_RE`.
2. `scripts/lib/frontmatter.mjs` exports `stripFrontmatter`.
3. `scripts/lib/resolve.mjs` exports `resolvePageId`, `isNumericId`.
4. `scripts/push-to-confluence.mjs` imports from `./lib/*.mjs` and removes the inline definitions.
5. The `createRequire` / `require("marked")` shim is replaced with `import { marked } from "marked"`.
6. Three `*.test.mjs` files exist under `scripts/lib/` and run with `node --test`.
7. `package.json` has a `"test"` script that runs all three test files.
8. All tests pass with `pnpm test` (or `npm test`).

## Implementation steps

### Step 1 — Verify `marked` v17 ESM export

Before removing `createRequire`, confirm that `marked` 17.0.5 exports an ESM entry point:

```sh
node -e "import('marked').then(m => console.log(Object.keys(m)))"
```

Expected output includes `"marked"`. If the import resolves correctly, proceed. If it throws, `marked` in this version does not have an ESM entry and `createRequire` must be kept.

Check the package exports field:

```sh
node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('node_modules/marked/package.json','utf8'));console.log(JSON.stringify(pkg.exports,null,2))"
```

Look for an `"import"` condition under `"."` or `"./src/marked.js"`. `marked` has had ESM exports since v4 — v17 should be fine.

### Step 2 — Create `scripts/lib/` directory and module files

The `scripts/lib/` directory does not need to be explicitly created — writing the files is sufficient. Proceed directly to writing the files.

#### `scripts/lib/frontmatter.mjs`

Copy from `push-to-confluence.mjs`. Use the **updated** version from spec 08 (with the `{0,50}` cap), not the original with the `s` flag.

```js
// SPDX-License-Identifier: LGPL-3.0-or-later

/**
 * Strips YAML frontmatter from the start of a Markdown string.
 *
 * The opening --- must be at byte 0. Frontmatter is capped at 50 lines to
 * prevent runaway matches on unclosed blocks. See spec 08 for full rationale.
 *
 * @param {string} content
 * @returns {string}
 */
export function stripFrontmatter(content) {
	return content.replace(
		/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/,
		"",
	);
}
```

#### `scripts/lib/inject.mjs`

Copy `TEXT_START_RE`, `TEXT_END_RE`, and `injectContent` verbatim from `push-to-confluence.mjs` lines 121–199. Add the `export` keyword before each declaration.

```js
// SPDX-License-Identifier: LGPL-3.0-or-later

export const TEXT_START_RE =
	/(?:<p>\s*)?\[AUTO_INSERT_START:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
export const TEXT_END_RE =
	/(?:<p>\s*)?\[AUTO_INSERT_END:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;

/**
 * Injects newHtml into existingBody using one of three strategies:
 *   1. Plain-text markers ([AUTO_INSERT_START: label] / [AUTO_INSERT_END: label])
 *   2. Anchor macros (md-start / md-end)
 *   3. Append (no markers — deprecated; spec 03 will change this to an error)
 *
 * Calls process.exit(1) on mismatched or unpaired markers.
 *
 * @param {string} existingBody — Confluence storage-format HTML
 * @param {string} newHtml — HTML to inject
 * @param {string} title — page title, used in error messages only
 * @returns {string}
 */
export function injectContent(existingBody, newHtml, title) {
	const hasStart = TEXT_START_RE.test(existingBody);
	const hasEnd = TEXT_END_RE.test(existingBody);

	// Strategy 1: plain-text markers
	if (hasStart || hasEnd) {
		if (hasStart !== hasEnd) {
			console.error(
				`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END] on page "${title}" — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		const startMatch = TEXT_START_RE.exec(existingBody);
		const startLabel = startMatch[1].trim();
		const afterStart = startMatch.index + startMatch[0].length;

		const escapedLabel = startLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const labelEndRe = new RegExp(
			`(?:<p>\\s*)?\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\](?:\\s*<\\/p>)?`,
		);
		const endMatch = labelEndRe.exec(existingBody.slice(afterStart));

		if (!endMatch) {
			console.error(
				`Marker label mismatch on page "${title}": [AUTO_INSERT_START:${startLabel}] has no matching [AUTO_INSERT_END:${startLabel}] — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		return (
			existingBody.slice(0, afterStart) +
			"\n" +
			newHtml +
			"\n" +
			existingBody.slice(afterStart + endMatch.index)
		);
	}

	// Strategy 2: anchor macros (legacy fallback)
	const anchorStartRe =
		/<ac:structured-macro[^>]*ac:name="anchor"[^>]*>\s*<ac:parameter[^>]*>md-start<\/ac:parameter>\s*<\/ac:structured-macro>/;
	const anchorEndRe =
		/<ac:structured-macro[^>]*ac:name="anchor"[^>]*>\s*<ac:parameter[^>]*>md-end<\/ac:parameter>\s*<\/ac:structured-macro>/;
	const hasAnchorStart = anchorStartRe.test(existingBody);
	const hasAnchorEnd = anchorEndRe.test(existingBody);

	if (hasAnchorStart || hasAnchorEnd) {
		if (hasAnchorStart !== hasAnchorEnd) {
			console.error(
				`Found md-start anchor without md-end (or vice versa) on page "${title}" — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		const startMatch = anchorStartRe.exec(existingBody);
		const endMatch = anchorEndRe.exec(existingBody);

		return (
			existingBody.slice(0, startMatch.index + startMatch[0].length) +
			"\n" +
			newHtml +
			"\n" +
			existingBody.slice(endMatch.index)
		);
	}

	// Strategy 3: append (no markers found)
	return existingBody + "\n" + newHtml;
}
```

#### `scripts/lib/resolve.mjs`

Copy `isNumericId` and `resolvePageId` from lines 203–252. The function reads `confluence-pages.json` from `process.cwd()` — this coupling to cwd is a known issue (spec 15 will address it). Copy verbatim for now.

```js
// SPDX-License-Identifier: LGPL-3.0-or-later
import { existsSync, readFileSync } from "fs";
import path from "path";

/**
 * Returns true if arg is a non-empty string of decimal digits.
 * @param {string} arg
 * @returns {boolean}
 */
export function isNumericId(arg) {
	return /^\d+$/.test(arg);
}

/**
 * Resolves a page ID from either a numeric string or a key in confluence-pages.json.
 *
 * Calls process.exit(1) on all error conditions. Spec 15 will replace these
 * with CliError throws.
 *
 * @param {string} arg — numeric page ID or key name from confluence-pages.json
 * @returns {number} — positive integer page ID
 */
export function resolvePageId(arg) {
	if (isNumericId(arg)) {
		const id = parseInt(arg, 10);
		if (!Number.isInteger(id) || id <= 0) {
			console.error(`Invalid page ID: ${arg}`);
			process.exit(1);
		}
		return id;
	}

	const pagesPath = path.join(process.cwd(), "confluence-pages.json");
	if (!existsSync(pagesPath)) {
		console.error(
			"confluence-pages.json not found — create it or pass a page ID directly",
		);
		process.exit(1);
	}

	let pages;
	try {
		pages = JSON.parse(readFileSync(pagesPath, "utf8"));
	} catch {
		console.error("invalid JSON in confluence-pages.json — check syntax");
		process.exit(1);
	}

	if (!(arg in pages)) {
		const keys = Object.keys(pages)
			.filter((k) => k !== "_comment")
			.join(", ");
		console.error(
			`'${arg}' not found in confluence-pages.json — available keys: ${keys}`,
		);
		process.exit(1);
	}

	const id = pages[arg];
	if (!Number.isInteger(id) || id <= 0) {
		console.error(
			`Invalid page ID for key '${arg}': ${id} — must be a positive integer`,
		);
		process.exit(1);
	}

	return id;
}
```

### Step 3 — Update `push-to-confluence.mjs`

Three changes to `push-to-confluence.mjs`:

#### 3a — Replace `createRequire` shim with ESM import

**Before** (lines 11, 24–25):

```js
import { createRequire } from "module";
// ... (other imports)
const require = createRequire(import.meta.url);
const { marked } = require("marked");
```

**After:**

```js
import { marked } from "marked";
// ... (other imports)
// (remove both createRequire lines entirely)
```

Remove `createRequire` from the `import { createRequire } from "module"` line. If `createRequire` was the only named import from `"module"`, remove the entire import statement. If other names were imported from `"module"`, retain the import and remove only `createRequire`.

#### 3b — Remove inline function definitions

Remove the following from `push-to-confluence.mjs` (the functions are now in `scripts/lib/`):

- Lines 113–117: `function stripFrontmatter(...)` — remove entirely.
- Lines 121–125: `const TEXT_START_RE = ...` and `const TEXT_END_RE = ...` — remove.
- Lines 126–199: `function injectContent(...)` — remove entirely.
- Lines 203–205: `function isNumericId(...)` — remove entirely.
- Lines 207–252: `function resolvePageId(...)` — remove entirely.

Also remove the section comment headers that no longer have function bodies:
- `// ── YAML frontmatter stripping ────...` (before `stripFrontmatter`)
- `// ── Content injection strategies ─────...` (before `TEXT_START_RE`)
- `// ── Page ID resolution ──────...` (before `isNumericId`)

#### 3c — Add imports at the top of `push-to-confluence.mjs`

After the existing import block, add:

```js
import { injectContent } from "./lib/inject.mjs";
import { stripFrontmatter } from "./lib/frontmatter.mjs";
import { resolvePageId } from "./lib/resolve.mjs";
```

The `isNumericId` function is used only inside `resolvePageId` in the original code — if it is not called directly in `push-to-confluence.mjs`, do not import it.

### Step 4 — Create test files

#### `scripts/lib/frontmatter.test.mjs`

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripFrontmatter } from "./frontmatter.mjs";

describe("stripFrontmatter", () => {
	it("returns content unchanged when no frontmatter", () => {
		const input = "# Hello\n\nSome content.\n";
		assert.strictEqual(stripFrontmatter(input), input);
	});

	it("strips a minimal 1-field frontmatter block", () => {
		const input = "---\ntitle: Foo\n---\nBody\n";
		assert.strictEqual(stripFrontmatter(input), "Body\n");
	});

	it("strips a 2-field frontmatter block", () => {
		const input = "---\ntitle: My Doc\ndate: 2026-01-01\n---\n# Hello\n\nContent.\n";
		assert.strictEqual(stripFrontmatter(input), "# Hello\n\nContent.\n");
	});

	it("strips CRLF frontmatter", () => {
		const input = "---\r\ntitle: Doc\r\ndate: 2026\r\n---\r\nBody\n";
		assert.strictEqual(stripFrontmatter(input), "Body\n");
	});

	it("preserves --- HR in body after valid frontmatter", () => {
		const input = "---\ntitle: Doc\n---\n# Section 1\n\nText.\n\n---\n\n# Section 2\n";
		assert.strictEqual(
			stripFrontmatter(input),
			"# Section 1\n\nText.\n\n---\n\n# Section 2\n",
		);
	});

	it("does not strip when frontmatter has no closing ---", () => {
		// No --- anywhere after the opening
		const input = "---\ntitle: Doc\ndate: 2026\n\n# Body\n\nContent here.\n";
		assert.strictEqual(stripFrontmatter(input), input);
	});

	it("does not strip when frontmatter exceeds 50 fields (cap exceeded)", () => {
		const fields = Array.from({ length: 51 }, (_, i) => `key${i}: value${i}`).join("\n");
		const input = `---\n${fields}\n---\nBody\n`;
		assert.strictEqual(stripFrontmatter(input), input);
	});

	it("strips frontmatter with exactly 50 fields", () => {
		const fields = Array.from({ length: 50 }, (_, i) => `key${i}: value${i}`).join("\n");
		const input = `---\n${fields}\n---\nBody\n`;
		assert.strictEqual(stripFrontmatter(input), "Body\n");
	});

	it("returns empty string when frontmatter covers whole content", () => {
		const input = "---\ntitle: Only Frontmatter\n---\n";
		assert.strictEqual(stripFrontmatter(input), "");
	});
});
```

#### `scripts/lib/inject.test.mjs`

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { injectContent } from "./inject.mjs";

describe("injectContent — strategy 1: plain-text markers", () => {
	it("replaces content between matching markers", () => {
		const body =
			"<p>[AUTO_INSERT_START: docs]</p>\n<p>old content</p>\n<p>[AUTO_INSERT_END: docs]</p>";
		const result = injectContent(body, "<p>new content</p>", "Test Page");
		assert.ok(result.includes("<p>new content</p>"), "new content present");
		assert.ok(!result.includes("old content"), "old content removed");
		assert.ok(result.includes("[AUTO_INSERT_START: docs]"), "start marker preserved");
		assert.ok(result.includes("[AUTO_INSERT_END: docs]"), "end marker preserved");
	});

	it("preserves content outside the markers", () => {
		const body =
			"<p>before</p>\n<p>[AUTO_INSERT_START: docs]</p>\n<p>old</p>\n<p>[AUTO_INSERT_END: docs]</p>\n<p>after</p>";
		const result = injectContent(body, "<p>new</p>", "Test");
		assert.ok(result.includes("<p>before</p>"), "content before marker preserved");
		assert.ok(result.includes("<p>after</p>"), "content after marker preserved");
	});

	it("handles markers without surrounding <p> tags", () => {
		const body = "[AUTO_INSERT_START: raw]\nold\n[AUTO_INSERT_END: raw]";
		const result = injectContent(body, "new", "Test");
		assert.ok(result.includes("new"), "new content present");
		assert.ok(!result.includes("old"), "old content removed");
	});

	// Mismatched label test is skipped until spec 15 replaces process.exit with CliError.
	// Once CliError is in place, rewrite as:
	//   assert.throws(() => injectContent(body, html, title), /label mismatch/);
	it.skip("exits 1 on mismatched marker labels — enable after spec 15 CliError", () => {});
});

describe("injectContent — strategy 2: anchor macros", () => {
	const anchorStart =
		'<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">md-start</ac:parameter></ac:structured-macro>';
	const anchorEnd =
		'<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">md-end</ac:parameter></ac:structured-macro>';

	it("replaces content between anchor macros", () => {
		const body = `<p>before</p>${anchorStart}<p>old</p>${anchorEnd}<p>after</p>`;
		const result = injectContent(body, "<p>new</p>", "Test");
		assert.ok(result.includes("<p>new</p>"), "new content present");
		assert.ok(!result.includes("<p>old</p>"), "old content removed");
		assert.ok(result.includes("<p>before</p>"), "before preserved");
		assert.ok(result.includes("<p>after</p>"), "after preserved");
	});

	it("preserves the anchor macros themselves", () => {
		const body = `${anchorStart}<p>old</p>${anchorEnd}`;
		const result = injectContent(body, "<p>new</p>", "Test");
		assert.ok(result.includes("md-start"), "start anchor macro preserved");
		assert.ok(result.includes("md-end"), "end anchor macro preserved");
	});
});

describe("injectContent — strategy 3: append fallback", () => {
	it("appends new content when no markers are present", () => {
		const body = "<p>existing</p>";
		const result = injectContent(body, "<p>new</p>", "Test");
		assert.ok(result.includes("<p>existing</p>"), "existing content preserved");
		assert.ok(result.includes("<p>new</p>"), "new content appended");
		// Verify order: existing before new
		assert.ok(
			result.indexOf("<p>existing</p>") < result.indexOf("<p>new</p>"),
			"existing content comes before new content",
		);
	});

	it("appends to empty body", () => {
		const result = injectContent("", "<p>only</p>", "Test");
		assert.ok(result.includes("<p>only</p>"), "content present in empty body");
	});
});
```

#### `scripts/lib/resolve.test.mjs`

Testing `resolvePageId` error paths is complicated by its `process.exit` calls. For those paths, write a small wrapper script to disk and invoke it with `node --input-type=module` via Node's `child_process.spawnSync`. This is the standard pattern for testing `process.exit` in `node:test` without a mock framework.

**Note on `spawnSync` safety**: The test uses `spawnSync` with a hardcoded command (`process.execPath`, i.e., the Node binary), not `exec`. No user input is passed to a shell — the `input` option pipes a hardcoded inline script. There is no shell interpolation and no injection surface. `spawnSync` with an explicit argv array is safe here.

```js
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { resolvePageId, isNumericId } from "./resolve.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testPagesPath = path.join(process.cwd(), "confluence-pages.json");
const testPagesBackup = path.join(process.cwd(), "confluence-pages.json.bak");

describe("isNumericId", () => {
	it("returns true for a numeric string", () => {
		assert.strictEqual(isNumericId("12345"), true);
	});

	it("returns false for a key name", () => {
		assert.strictEqual(isNumericId("my-page"), false);
	});

	it("returns false for empty string", () => {
		assert.strictEqual(isNumericId(""), false);
	});

	it("returns false for a string with letters", () => {
		assert.strictEqual(isNumericId("123abc"), false);
	});
});

describe("resolvePageId — numeric input", () => {
	it("returns a positive integer for a valid numeric string", () => {
		const result = resolvePageId("98765");
		assert.strictEqual(result, 98765);
	});
});

describe("resolvePageId — key lookup", () => {
	// Set up a temporary confluence-pages.json in cwd for these tests.
	// These tests must run from the repo root (where pnpm test is invoked from).

	before(() => {
		if (existsSync(testPagesPath)) {
			writeFileSync(testPagesBackup, readFileSync(testPagesPath, "utf8"));
		}
		writeFileSync(
			testPagesPath,
			JSON.stringify({ "_comment": "test", "my-page": 11111, "other": 22222 }, null, 2),
			"utf8",
		);
	});

	after(() => {
		unlinkSync(testPagesPath);
		if (existsSync(testPagesBackup)) {
			writeFileSync(testPagesPath, readFileSync(testPagesBackup, "utf8"));
			unlinkSync(testPagesBackup);
		}
	});

	it("returns the page ID for a valid key", () => {
		const result = resolvePageId("my-page");
		assert.strictEqual(result, 11111);
	});

	it("returns the page ID for another valid key", () => {
		const result = resolvePageId("other");
		assert.strictEqual(result, 22222);
	});
});

describe("resolvePageId — error paths (via subprocess)", () => {
	// These error paths call process.exit(1). We test them by spawning a child
	// Node process with a hardcoded inline script via --input-type=module.
	// spawnSync is used (not exec) — the command is always process.execPath
	// (the Node binary) with a hardcoded argv array; there is no shell and no
	// injection surface.

	it("exits 1 for missing confluence-pages.json when using a key", () => {
		// Run in /tmp which has no confluence-pages.json
		const resolvePath = path.join(__dirname, "resolve.mjs");
		const script = `import {resolvePageId} from ${JSON.stringify(resolvePath)}; resolvePageId("missing-key")`;
		const result = spawnSync(process.execPath, ["--input-type=module"], {
			input: script,
			cwd: "/tmp",
			encoding: "utf8",
		});
		assert.strictEqual(result.status, 1, `expected exit 1, got ${result.status}\n${result.stderr}`);
		assert.ok(
			result.stderr.includes("confluence-pages.json not found"),
			`expected error message in stderr:\n${result.stderr}`,
		);
	});

	it("exits 1 with available keys message for unknown key", () => {
		const tmpDir = "/tmp";
		const tmpPages = path.join(tmpDir, "confluence-pages.json");
		writeFileSync(tmpPages, JSON.stringify({ "known-page": 99999 }, null, 2));

		const resolvePath = path.join(__dirname, "resolve.mjs");
		const script = `import {resolvePageId} from ${JSON.stringify(resolvePath)}; resolvePageId("unknown-key")`;
		const result = spawnSync(process.execPath, ["--input-type=module"], {
			input: script,
			cwd: tmpDir,
			encoding: "utf8",
		});

		unlinkSync(tmpPages);

		assert.strictEqual(result.status, 1, `expected exit 1, got ${result.status}\n${result.stderr}`);
		assert.ok(
			result.stderr.includes("not found in confluence-pages.json"),
			`expected not-found message:\n${result.stderr}`,
		);
		assert.ok(
			result.stderr.includes("known-page"),
			`expected available keys listed in error message:\n${result.stderr}`,
		);
	});
});
```

### Step 5 — Add `test` script to `package.json`

**Before** (the `scripts` block after spec 06 lands, or add `"test"` to the existing object):

```json
"scripts": {
  "confluence": "node scripts/push-to-confluence.mjs",
  "sync-version": "node scripts/sync-version.mjs",
  "release": "..."
}
```

**After:**

```json
"scripts": {
  "confluence": "node scripts/push-to-confluence.mjs",
  "sync-version": "node scripts/sync-version.mjs",
  "release": "...",
  "test": "node --test scripts/lib/frontmatter.test.mjs scripts/lib/inject.test.mjs scripts/lib/resolve.test.mjs"
}
```

Use explicit file paths rather than a glob for the `test` script. Node's `--test` accepts glob patterns since Node 21 via the `--test-glob` flag, but explicit paths are portable across Node 18+.

## Test cases

### TC-01: All tests pass

```sh
pnpm test
# Expected: all tests pass, exit code 0
# Expected output format (node --test TAP output):
# ok 1 - stripFrontmatter > returns content unchanged when no frontmatter
# ok 2 - stripFrontmatter > strips a minimal 1-field frontmatter block
# ...
# # tests N
# # pass N
# # fail 0
```

### TC-02: Import smoke test — push-to-confluence.mjs still loads

```sh
node --check scripts/push-to-confluence.mjs
# Expected: no syntax errors, exits 0
```

### TC-03: ESM import of marked works

```sh
node -e "import('marked').then(m => console.log(typeof m.marked))"
# Expected: "function"
```

### TC-04: No inline definitions remain in push-to-confluence.mjs

```sh
grep -n "function stripFrontmatter\|function injectContent\|function resolvePageId\|function isNumericId" scripts/push-to-confluence.mjs
# Expected: no output (all definitions removed)
```

### TC-05: createRequire is gone

```sh
grep -n "createRequire" scripts/push-to-confluence.mjs
# Expected: no output (or only comments, not live code)
```

### TC-06: Regression — publish still works end-to-end

```sh
node scripts/push-to-confluence.mjs test-page /tmp/test.md
# Expected: publishes without error, exits 0
```

## Acceptance criteria

- `scripts/lib/frontmatter.mjs`, `scripts/lib/inject.mjs`, and `scripts/lib/resolve.mjs` exist and export the named functions.
- `pnpm test` exits 0 with all tests passing.
- No test uses `vitest`, `jest`, or any third-party test library — only `node:test` and `node:assert/strict`.
- `push-to-confluence.mjs` no longer contains inline definitions of the three extracted functions.
- `push-to-confluence.mjs` no longer uses `createRequire` or `require("marked")`.
- The publish flow (`node scripts/push-to-confluence.mjs pageId file.md`) still works correctly after the extraction.
- `--setup`, `--verify`, and `--check-auth` (if spec 07 landed) still work correctly.

## Verification

```sh
# Run the test suite:
pnpm test

# Confirm no inline function definitions remain:
grep -n "^function stripFrontmatter\|^function injectContent\|^function resolvePageId" scripts/push-to-confluence.mjs

# Confirm imports are present:
grep -n "from.*lib/" scripts/push-to-confluence.mjs

# Confirm marked is imported via ESM:
grep -n 'import.*marked.*from.*"marked"' scripts/push-to-confluence.mjs

# Confirm createRequire is gone:
grep -n "createRequire" scripts/push-to-confluence.mjs

# Syntax check all new files:
node --check scripts/lib/frontmatter.mjs
node --check scripts/lib/inject.mjs
node --check scripts/lib/resolve.mjs
node --check scripts/lib/frontmatter.test.mjs
node --check scripts/lib/inject.test.mjs
node --check scripts/lib/resolve.test.mjs
```

## Out of scope

- Do not test `httpsRequest`, `runSetup`, `runVerify`, or `main()` — these require network or interactive I/O and belong in integration tests or e2e tests.
- Do not add vitest, jest, mocha, or any other test framework.
- Do not add code coverage tooling.
- Do not test `loadCredentials` — it reads from the filesystem and environment, making it an integration concern.
- Do not add `postProcessHtml` (spec 05) to this test suite — add it in a follow-up once spec 05 is implemented.
- Do not change the runtime behaviour of any extracted function — copy verbatim, export, and import.

## Deviations

- **`injectContent` signature**: The spec template shows a simple `injectContent(existingBody, newHtml, title)` signature (strategy 3 = append fallback). The actual code has evolved through specs 03 and 04 to `injectContent(existingBody, newHtml, title, { replaceAll, dryRun, pageId, version })` where strategy 3 is now an error (no markers) or a full replace (`replaceAll=true`). The lib module exports the actual current implementation verbatim. The strategy-3 tests in `inject.test.mjs` are updated to test the `replaceAll=true, dryRun=true` path instead of the old append path.

## Follow-ups

- **`postProcessHtml` tests**: Once spec 05 lands, extract `postProcessHtml` to `scripts/lib/html.mjs` and add `scripts/lib/html.test.mjs` with the TC-01 through TC-06 cases from spec 05.
- **Spec 15 — `CliError`**: When `process.exit` calls are replaced with `CliError` throws, the skipped test in `inject.test.mjs` (mismatched labels) and the subprocess tests in `resolve.test.mjs` can be rewritten as direct `assert.throws` calls.
- **`resolvePageId` cwd coupling**: The function reads `confluence-pages.json` from `process.cwd()`. This makes tests fragile (they depend on cwd or must write temp files). Spec 15 should add an optional `pagesFilePath` parameter so tests can pass an explicit path without cwd manipulation.
- **CI integration**: Add `pnpm test` to the GitHub Actions workflow (if one exists) so tests run on every push.
