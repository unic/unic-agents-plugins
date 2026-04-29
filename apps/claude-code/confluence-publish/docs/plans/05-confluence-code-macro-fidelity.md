# 05. Confluence Code Macro Fidelity
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** none
**Touches:** `scripts/push-to-confluence.mjs`

## Context

`marked` with default settings converts fenced code blocks to `<pre><code class="language-xxx">…</code></pre>`. When Confluence ingests this HTML via the storage format, it renders the block as monospace plain text — no syntax highlighting, no copy button, no collapse widget. Confluence has its own first-class code block component: the `ac:structured-macro ac:name="code"` element. Any storage-format HTML that uses this macro instead of raw `<pre><code>` gets full syntax highlighting (using Confluence's built-in Prism theme), the copy-to-clipboard button, and the optional title/linenumbers features. This spec adds a `postProcessHtml` function that rewrites `marked`'s `<pre><code>` output into the Confluence macro format immediately after conversion, before the HTML is injected into the page body.

## Current behaviour

**File:** `scripts/push-to-confluence.mjs`, lines 420–423

```js
const rawContent = readFileSync(resolvedPath, "utf8");
const stripped = stripFrontmatter(rawContent);
const html = marked(stripped);                     // line 423 — default options
```

`marked` emits the following for a fenced JavaScript block:

```html
<pre><code class="language-javascript">console.log(&quot;hi&quot;);\n</code></pre>
```

- The `class="language-xxx"` attribute carries the language hint but Confluence's storage-format parser ignores HTML `class` attributes on `<pre>` / `<code>` elements.
- Characters like `<`, `>`, `&`, `"` inside the fenced block are HTML-entity-encoded by `marked` (`&lt;`, `&gt;`, `&amp;`, `&quot;`). Confluence's CDATA section expects raw text, not HTML entities — if entities are left in place, Confluence will double-escape them and the page will display literal `&amp;lt;` strings.
- Unlabelled fenced blocks (no language specified) produce `<pre><code>content</code></pre>` with no `class` attribute.

**File:** `package.json`, `dependencies`:

```json
"marked": "17.0.5"
```

`marked` v17 ships with GFM mode **on by default** (`marked.defaults.gfm === true`). No explicit option is required.

## Target behaviour

After this spec lands:

1. Every fenced code block — labelled or unlabelled — is rendered as a Confluence `ac:structured-macro` in the storage format.
2. The language parameter is included only when a language was specified in the fence.
3. HTML entities inside the code content are decoded back to raw text before being placed inside the CDATA section, so Confluence renders literal `<`, `>`, and `&` characters correctly.
4. Non-code HTML produced by `marked` (paragraphs, headings, tables, lists, inline code spans) is unchanged.

**Labelled fence** (e.g. ` ```javascript … ``` `):

```xml
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:plain-text-body><![CDATA[console.log("hi");
]]></ac:plain-text-body>
</ac:structured-macro>
```

**Unlabelled fence** (` ``` … ``` ` with no language):

```xml
<ac:structured-macro ac:name="code">
  <ac:plain-text-body><![CDATA[plain text content
]]></ac:plain-text-body>
</ac:structured-macro>
```

### Edge cases

- A code block whose content contains `]]>` would break the CDATA section. This is vanishingly rare in practice but Ralph should note: Confluence itself escapes `]]>` as `]]]]><![CDATA[>` when round-tripping storage format. For now, the implementation does **not** handle this — add a comment noting it as a known limitation. A follow-up spec can address it if it surfaces in practice.
- Inline code spans (`<code>` not wrapped in `<pre>`) must **not** be transformed. The regex is anchored to `<pre><code` so inline `<code>` elements are unaffected.
- Nested backticks inside a fenced block are handled correctly by `marked` before `postProcessHtml` sees the output — no special handling needed here.

## Implementation steps

### Step 1 — Verify GFM default in marked v17

Before adding any `marked.use()` call, verify that GFM is already enabled:

```js
// Temporary diagnostic — remove before committing
console.log("marked GFM default:", marked.defaults.gfm);
```

Run `node -e "const {createRequire}=require('module');const r=createRequire(import.meta.url);const {marked}=r('marked');console.log(marked.defaults.gfm)"` — if it prints `true`, no `marked.use()` call is needed. If it prints `false` or `undefined`, add `marked.use({ gfm: true })` at module initialisation time (after line 25). In practice, `marked` ≥ 1.0 defaults `gfm: true`, so this step is expected to be a no-op.

### Step 2 — Add `postProcessHtml` function

Insert the following function in `scripts/push-to-confluence.mjs` immediately after the `stripFrontmatter` function (after line 117, before the `// ── Content injection strategies` comment block at line 119):

```js
// ── HTML post-processing ───────────────────────────────────────────────────────

/**
 * Rewrites <pre><code> blocks emitted by `marked` into Confluence storage-format
 * `ac:structured-macro ac:name="code"` elements so that syntax highlighting
 * and the copy-to-clipboard button work in Confluence.
 *
 * Known limitation: code blocks whose content contains the CDATA close sequence
 * `]]>` are not handled — this is exceptionally rare and can be addressed in a
 * follow-up if it surfaces.
 *
 * @param {string} html — HTML string as emitted by `marked`
 * @returns {string} — HTML with <pre><code> blocks replaced by Confluence macros
 */
function postProcessHtml(html) {
	function decodeEntities(str) {
		return str
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&amp;/g, "&")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");
	}

	return html.replace(
		/<pre><code(?:\s+class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g,
		(_, lang, code) => {
			const rawCode = decodeEntities(code);
			const langParam = lang
				? `\n  <ac:parameter ac:name="language">${lang}</ac:parameter>`
				: "";
			return `<ac:structured-macro ac:name="code">${langParam}\n  <ac:plain-text-body><![CDATA[${rawCode}]]></ac:plain-text-body>\n</ac:structured-macro>`;
		},
	);
}
```

### Step 3 — Call `postProcessHtml` after `marked`

Change lines 422–423 from:

```js
const stripped = stripFrontmatter(rawContent);
const html = marked(stripped);
```

to:

```js
const stripped = stripFrontmatter(rawContent);
const rawHtml = marked(stripped);
const html = postProcessHtml(rawHtml);
```

This is a two-line change: rename the `marked()` result to `rawHtml` and add a `postProcessHtml` call. The `html` variable used downstream (line 469 `injectContent`, line 424 empty-check) remains the same name and type.

### Step 4 — Verify the empty-HTML guard still works

Line 424 currently reads:

```js
if (!html || !html.trim()) {
```

After step 3, `html` is the post-processed string. A document with only fenced code blocks will produce non-empty HTML (the macro markup), so the guard remains correct. No change needed.

## Test cases

All tests below are manual until spec 09 adds the test harness. The expected output can be verified by pushing to a test Confluence page and inspecting the rendered result.

### TC-01: Labelled code block

**Input markdown:**

````markdown
```javascript
const x = 1;
console.log(x);
```
````

**Expected Confluence storage output (in page body):**

```xml
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:plain-text-body><![CDATA[const x = 1;
console.log(x);
]]></ac:plain-text-body>
</ac:structured-macro>
```

**Expected Confluence render:** syntax-highlighted JavaScript block with copy button.

### TC-02: Unlabelled code block

**Input markdown:**

````markdown
```
plain text
no language
```
````

**Expected Confluence storage output:**

```xml
<ac:structured-macro ac:name="code">
  <ac:plain-text-body><![CDATA[plain text
no language
]]></ac:plain-text-body>
</ac:structured-macro>
```

No `<ac:parameter ac:name="language">` line should be present.

### TC-03: HTML special characters in code block

**Input markdown:**

````markdown
```html
<div class="foo">bar & baz</div>
```
````

`marked` emits: `<pre><code class="language-html">&lt;div class=&quot;foo&quot;&gt;bar &amp; baz&lt;/div&gt;\n</code></pre>`

**Expected CDATA content:** `<div class="foo">bar & baz</div>` — raw characters, no entities.

**Verification:** Inspect raw page storage via `GET /wiki/api/v2/pages/{id}?body-format=storage` and confirm the CDATA section contains `<`, `>`, and `&` not `&lt;`, `&gt;`, `&amp;`.

### TC-04: Inline code span — must not be transformed

**Input markdown:**

```markdown
Use `console.log()` to debug.
```

**Expected output:** `<p>Use <code>console.log()</code> to debug.</p>` — the inline `<code>` is **not** wrapped in a macro.

### TC-05: Mixed document — code blocks and prose

**Input markdown:**

````markdown
## Setup

Run the following:

```bash
npm install
```

Then edit `config.json`.
````

**Expected output:** One macro for the bash block; prose paragraphs and the inline `config.json` code span are unchanged.

### TC-06: Exit code on empty file

Push an empty Markdown file → process exits with code 1 and message "Markdown converted to empty HTML — check the source file is not empty". `postProcessHtml("")` returns `""`, the guard on line 424 fires correctly.

## Acceptance criteria

- A fenced code block with a language label renders with syntax highlighting in Confluence after publishing.
- A fenced code block without a language label renders as a plain code block (no highlighting, no error).
- HTML special characters (`<`, `>`, `&`, `"`) inside code blocks appear correctly in Confluence — not double-escaped.
- Inline `<code>` spans (not inside `<pre>`) are unaffected.
- The rest of the page (headings, paragraphs, tables, lists) is unaffected.
- `postProcessHtml("")` returns `""` without throwing.
- `postProcessHtml` is a pure function — no side effects, no I/O.

## Verification

```sh
# 1. Confirm postProcessHtml is exported (after spec 09 moves it) or inline-testable:
node -e "
import('./scripts/push-to-confluence.mjs').catch(() => {});
" 2>&1 | head -5

# 2. Manual smoke test — push a file with a fenced JS block to a test page:
node scripts/push-to-confluence.mjs test-page /tmp/test-code.md

# 3. Inspect the resulting page storage:
# GET https://{base}/wiki/api/v2/pages/{id}?body-format=storage
# Verify ac:structured-macro is present and CDATA contains raw characters.

# 4. Regression — push a file with only prose (no code blocks):
node scripts/push-to-confluence.mjs test-page /tmp/test-prose.md
# Verify the page renders correctly with no macro elements.
```

## Out of scope

- Do not change table rendering.
- Do not add a `marked` Renderer extension or custom token for code blocks — the post-process regex approach is simpler and avoids coupling to `marked` internals.
- Do not upgrade the `marked` version.
- Do not add `ac:parameter ac:name="title"` or `ac:parameter ac:name="linenumbers"` — those are follow-up enhancements.
- Do not handle the `]]>` CDATA escape edge case in this spec (noted as a known limitation in the function JSDoc).
- Do not change how inline code spans (`backtick` in prose) are rendered.

## Follow-ups

- **CDATA `]]>` escape**: If any code blocks in the wild contain `]]>`, the macro will produce malformed XML. Fix: split the CDATA on `]]>` and rejoin with `]]]]><![CDATA[>`. Defer until it surfaces in practice.
- **Code block title and line numbers**: Confluence supports `<ac:parameter ac:name="title">…</ac:parameter>` and `<ac:parameter ac:name="linenumbers">true</ac:parameter>`. A future spec could parse extended fence info strings (e.g., ` ```js title="server.js" linenumbers `) to populate these.
- **Spec 09 test coverage**: Once `postProcessHtml` is extracted to `scripts/lib/html.mjs`, add unit tests for TC-01 through TC-06 as automated `node --test` cases.
