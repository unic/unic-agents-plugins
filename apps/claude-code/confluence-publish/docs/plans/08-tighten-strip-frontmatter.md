# 08. Tighten `stripFrontmatter` Regex
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** none
**Touches:** `scripts/push-to-confluence.mjs`

## Context

`stripFrontmatter` uses the `s` ("dotAll") flag, which makes `.` match newline characters. Combined with lazy `.*?`, the regex tries to find the shortest match for the content between the two `---` delimiters. In well-formed frontmatter this is correct: the regex matches from the opening `---` to the first subsequent `---` line and strips only the block. However, if a document's YAML frontmatter is never closed — the author forgot to write the closing `---` — the `.*?` with `s` will scan forward through the entire document until it finds the last `---` anywhere in the body, potentially matching and silently deleting real content. The `s` flag removes the natural line-boundary protection that makes frontmatter parsing safe. Capping the frontmatter block to a maximum of 50 lines provides defence-in-depth without breaking any legitimate use case (YAML front matter is never 50 key–value pairs in practice).

## Current behaviour

**File:** `scripts/push-to-confluence.mjs`, lines 113–117

```js
function stripFrontmatter(content) {
	// The opening --- must be at byte 0 to avoid treating a CommonMark HR in the body as frontmatter
	// \r?\n handles both LF and CRLF line endings
	return content.replace(/^---\r?\n.*?\r?\n---\s*\r?\n/s, "");
}
```

The regex: `/^---\r?\n.*?\r?\n---\s*\r?\n/s`

Breakdown:
- `^` — anchors to start of string (`String.prototype.replace` with `/^/` without `m` flag matches byte 0 only — correct).
- `---\r?\n` — matches opening `---` line.
- `.*?` — matches any characters (including newlines, because of `s` flag) lazily.
- `\r?\n---\s*\r?\n` — matches the closing `---` line.

**The failure scenario:**

Given this input:

```
---
title: My Document
(author forgot to add closing ---)

# Introduction

Some text with a horizontal rule below:

---

## Second Section
```

The regex will match from byte 0 to the `---` line above "## Second Section", consuming the entire "Introduction" section. The result is:

```

## Second Section
```

The "Introduction" section and everything up to the last `---` is silently deleted. No error is raised. The user pushes a truncated document to Confluence without realising it.

**The `.*?` laziness does not fully protect against this**: laziness means the engine prefers shorter matches, but it must still find a match. If the only `---` after the opening is in the document body, the engine will match to that `---` even though it is far from the opening. There is no maximum match length.

**Note on the "common" case**: A document whose body contains `---` used as a CommonMark horizontal rule (e.g., `\n---\n` between two paragraphs, not at the very beginning of a line after a blank line) is handled differently by different Markdown parsers, but the regex does not care about Markdown semantics — it just scans for the next `\r?\n---\s*\r?\n` pattern anywhere in the string.

## Target behaviour

After this spec, `stripFrontmatter` caps the frontmatter block to at most 50 lines using `(?:[^\n]*\r?\n){0,50}?` instead of `.*?` with the `s` flag.

**New function:**

```js
function stripFrontmatter(content) {
	// Match only if opening --- is at byte 0.
	// Allow up to 50 key:value lines inside the block — legitimate YAML frontmatter
	// is never 50 lines; this cap prevents runaway matches on unclosed frontmatter.
	// [^\n]*\r?\n matches one line (LF or CRLF) without crossing to the next.
	// The s flag is intentionally absent: [^\n] provides the same line-at-a-time
	// semantics without granting .* permission to range across the whole document.
	return content.replace(
		/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/,
		"",
	);
}
```

### Behaviour for all input categories

| Input | Old behaviour | New behaviour |
|-------|--------------|---------------|
| No frontmatter | Returns content unchanged | Returns content unchanged (no match) |
| Valid 2-field frontmatter | Strips correctly | Strips correctly |
| Valid 40-field frontmatter | Strips correctly | Strips correctly (within 50-line cap) |
| Frontmatter with `---` HR in body | May consume body up to last `---` | Strips only the frontmatter block |
| Unclosed frontmatter (no closing `---` within 50 lines) | Matches to last `---` in document | No match — returns content unchanged |
| Unclosed frontmatter with a `---` at line 55+ | Matches to that `---` | No match — cap of 50 lines prevents reaching it |
| CRLF frontmatter | Strips correctly | Strips correctly |
| Frontmatter where closing `---` is on line 51 | Strips correctly (no cap) | No match — returns content unchanged |

The 51-line case is an acceptable trade-off: a YAML front matter with 51 fields is malformed by any reasonable standard, and returning the content unchanged (rather than stripping a wrong block) is the safer failure mode.

### Regex mechanics

`/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/`

- `^` — start of string (no `m` or `s` flags, so `^` is byte 0).
- `---\r?\n` — opening delimiter, LF or CRLF.
- `(?:[^\n]*\r?\n){0,50}?` — match 0 to 50 lines, lazily. Each iteration consumes `[^\n]*` (any chars except LF) followed by `\r?\n` (the line terminator). The `?` after `{0,50}` makes the quantifier prefer fewer iterations — the engine tries to find a match with the fewest lines first, stopping as soon as the next token (`---`) can match.
- `---\s*\r?\n` — closing delimiter line.
- No `s` flag — `[^\n]` does not match `\n`, so each `[^\n]*` is bounded to a single line by construction.

**Why `[^\n]*` instead of `.` with `s`**: `[^\n]*` explicitly excludes the newline character. The `\r?\n` at the end of each non-capturing group consumes the line terminator. This means the alternation `[^\n]*\r?\n` matches exactly one line and cannot span multiple lines, regardless of flags.

**Why `{0,50}?` is lazy**: Without the `?`, `{0,50}` would greedily consume up to 50 lines before checking for `---`. With `?`, the engine tries 0 lines first (i.e., checks if the very next token is `---`), then 1 line, etc. For a 2-line frontmatter block this means 2 iterations before the engine finds the closing `---`, which is correct and efficient.

## Implementation steps

### Step 1 — Replace the function body

**File:** `scripts/push-to-confluence.mjs`

**Before** (lines 113–117):

```js
function stripFrontmatter(content) {
	// The opening --- must be at byte 0 to avoid treating a CommonMark HR in the body as frontmatter
	// \r?\n handles both LF and CRLF line endings
	return content.replace(/^---\r?\n.*?\r?\n---\s*\r?\n/s, "");
}
```

**After:**

```js
function stripFrontmatter(content) {
	// Match only if opening --- is at byte 0.
	// Allow up to 50 key:value lines inside the block — legitimate YAML frontmatter
	// is never 50 lines; this cap prevents runaway matches on unclosed frontmatter.
	// [^\n]*\r?\n matches one line (LF or CRLF) without crossing to the next.
	// The s flag is intentionally absent: [^\n] provides the same line-at-a-time
	// semantics without granting .* permission to range across the whole document.
	return content.replace(
		/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/,
		"",
	);
}
```

This is a single-function change with no other modifications required in this spec.

### Step 2 — Update `scripts/lib/frontmatter.mjs` if spec 09 has already landed

If spec 09 has already been implemented and `stripFrontmatter` was extracted to `scripts/lib/frontmatter.mjs`, apply the same change to that file instead of (or in addition to) the inline definition in `push-to-confluence.mjs`. If spec 09 has not landed yet, change only `push-to-confluence.mjs` — spec 09 will copy the updated version when it extracts the function.

## Test cases

These test cases are expressed as Node.js assertions for use with spec 09's `node --test` harness. For now they can be run manually.

### TC-01: No frontmatter — identity

```js
const input = "# Hello\n\nSome content.\n";
const result = stripFrontmatter(input);
assert.strictEqual(result, input);
```

**Expected:** content returned unchanged.

### TC-02: Valid 2-field frontmatter — stripped

```js
const input = "---\ntitle: My Doc\ndate: 2026-01-01\n---\n# Hello\n\nContent.\n";
const result = stripFrontmatter(input);
assert.strictEqual(result, "# Hello\n\nContent.\n");
```

**Expected:** frontmatter block removed, body intact.

### TC-03: Valid 1-field frontmatter (minimal)

```js
const input = "---\ntitle: Foo\n---\nBody\n";
const result = stripFrontmatter(input);
assert.strictEqual(result, "Body\n");
```

### TC-04: CRLF frontmatter — stripped

```js
const input = "---\r\ntitle: Doc\r\ndate: 2026\r\n---\r\nBody\n";
const result = stripFrontmatter(input);
assert.strictEqual(result, "Body\n");
```

**Expected:** CRLF line endings in frontmatter handled correctly; body is intact.

### TC-05: `---` horizontal rule in body after valid frontmatter — HR preserved

```js
const input = "---\ntitle: Doc\n---\n# Section 1\n\nText.\n\n---\n\n# Section 2\n";
const result = stripFrontmatter(input);
assert.strictEqual(result, "# Section 1\n\nText.\n\n---\n\n# Section 2\n");
```

**Expected:** Only the frontmatter `---` block is stripped. The `---` HR in the body is preserved. This is the key regression test — the old regex could incorrectly match this case if the body `---` came before the frontmatter closing `---` in the document.

**Note:** In this specific test the frontmatter is well-formed (has a closing `---` on the second line), so both old and new regexes produce the correct result. The test is included to guard against regressions if the regex is modified.

### TC-06: Unclosed frontmatter — no content stripped

```js
// No closing --- anywhere
const input = "---\ntitle: Doc\ndate: 2026\n\n# Body\n\nContent here.\n";
const result = stripFrontmatter(input);
assert.strictEqual(result, input);
```

**Expected:** content returned unchanged. The old regex also returns unchanged here because there is no second `---` at all, so neither regex matches. This test confirms the baseline.

### TC-07: Unclosed frontmatter with `---` in body — new behaviour

```js
// Closing --- missing; there IS a --- further down in the body
const input = "---\ntitle: Doc\n\n# Introduction\n\nSome content.\n\n---\n\n# Section 2\n";
const result = stripFrontmatter(input);
// Old regex: strips from byte 0 to the "---" before "# Section 2" — loses "Introduction" section
// New regex: no match — returns content unchanged
assert.strictEqual(result, input);
```

**Expected (new):** content returned unchanged. The regex requires a closing `---` within 50 lines of the opening `---`. The `---` in the body is at line 8 (counting from the opening `---`), so it is within 50 lines — BUT the laziness of `{0,50}?` means the engine first tries to match at line 2 (`\n` after `title: Doc`), then line 3 (empty line), then line 4 (`# Introduction\n`). At each step the next token must be `---`; only at line 8 does the body `---` appear. So the new regex WILL match this and strip "---\ntitle: Doc\n\n# Introduction\n\nSome content.\n\n" — stripping more than just the frontmatter.

**Correction**: The behaviour described above means the new regex does NOT fully fix this edge case when the body `---` is within 50 lines of the opening. The 50-line cap only helps when the body `---` is more than 50 lines away. This is an important limitation to document.

**Revised expected outcome for TC-07**: The new regex matches and strips from byte 0 to the first `---` it finds, which here is the body `---` at line 8. This is still wrong — the same as the old regex. The difference is only when the body `---` is more than 50 lines away from the opening `---`.

**Ralph's action**: Update the test to reflect the actual new behaviour. The correct assertion is:

```js
// The new regex still matches the body "---" if it is within 50 lines of the opening.
// The fix only helps for deeply-buried closing delimiters (50+ lines away).
// Document this as a known limitation; a proper fix requires a full YAML parser.
const result = stripFrontmatter(input);
// This will still incorrectly strip — include the test as a documentation of the limitation:
assert.notStrictEqual(result, input); // documents the known remaining issue
```

### TC-08: Frontmatter with 40 fields — stripped correctly

```js
const fields = Array.from({ length: 40 }, (_, i) => `key${i}: value${i}`).join("\n");
const input = `---\n${fields}\n---\nBody\n`;
const result = stripFrontmatter(input);
assert.strictEqual(result, "Body\n");
```

**Expected:** 40-field frontmatter stripped correctly (within the 50-line cap).

### TC-09: Frontmatter with 51 fields — no match (cap exceeded)

```js
const fields = Array.from({ length: 51 }, (_, i) => `key${i}: value${i}`).join("\n");
const input = `---\n${fields}\n---\nBody\n`;
const result = stripFrontmatter(input);
assert.strictEqual(result, input); // no change — cap exceeded
```

**Expected:** content returned unchanged. The closing `---` is at line 52, which exceeds the `{0,50}` cap.

## Acceptance criteria

- The `s` flag is removed from the regex.
- The function body uses `(?:[^\n]*\r?\n){0,50}?` for the inner match.
- TC-01 through TC-05 and TC-08 all pass.
- TC-09 passes (51-field frontmatter is not stripped).
- TC-07 is documented as a known limitation (the fix only applies when the spurious `---` is more than 50 lines from the opening).
- No change to the function signature or call sites.

## Verification

```sh
# 1. Confirm the s flag is gone:
grep -n "stripFrontmatter" scripts/push-to-confluence.mjs
# Inspect the nearby lines — should not contain /s flag at end of regex

# 2. Quick inline test of the happy path:
node -e "
function stripFrontmatter(content) {
  return content.replace(/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/, '');
}
const input = '---\ntitle: Test\ndate: 2026\n---\n# Hello\nContent.\n';
const result = stripFrontmatter(input);
console.log(JSON.stringify(result));
// Expected: '\"# Hello\nContent.\n\"'
"

# 3. Test the 51-field cap:
node -e "
function stripFrontmatter(content) {
  return content.replace(/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/, '');
}
const fields = Array.from({length:51},(_,i)=>'k'+i+': v'+i).join('\n');
const input = '---\n'+fields+'\n---\nBody\n';
const result = stripFrontmatter(input);
console.log(result === input ? 'PASS: no change for 51-field frontmatter' : 'FAIL: content was changed');
"

# 4. Smoke test — push a real file with frontmatter to a test page:
node scripts/push-to-confluence.mjs test-page /tmp/test-with-frontmatter.md
```

## Out of scope

- Do not add TOML (`+++`) or JSON (`{ }`) frontmatter support.
- Do not throw an error on malformed frontmatter — the silent no-op (returning content unchanged) is the correct behaviour. Crashing on malformed frontmatter would be surprising.
- Do not add a `--strict-frontmatter` flag.
- Do not integrate a full YAML parser (e.g., `js-yaml`) — the function's purpose is to strip the frontmatter block from the raw text, not parse it. YAML parsing is out of scope.
- Do not change the 50-line cap — it is a defence-in-depth measure and not intended to be configurable.

## Follow-ups

- **TC-07 known limitation**: The regex still incorrectly matches a body `---` that appears within 50 lines of an unclosed frontmatter opening. A robust fix requires either (a) a YAML parser that verifies the block is syntactically valid YAML before stripping, or (b) a stricter pattern that only accepts key–value lines (`/^[A-Za-z_][A-Za-z0-9_-]*:/`) inside the frontmatter block. Option (b) is achievable with a regex change and is worth a follow-up spec.
- **Spec 09 integration**: Once `stripFrontmatter` is extracted to `scripts/lib/frontmatter.mjs`, the test cases above become automated `node --test` cases. TC-07 should be included as a test documenting the known limitation (with a comment, not an assertion that it is fixed).
- **Strict key–value line pattern**: Replace `[^\n]*` with `[A-Za-z_][A-Za-z0-9_-]*:[^\n]*` to ensure only valid YAML scalar key lines are matched inside the block. A `---` that follows a blank line or a non-key line inside the "frontmatter" would not be matched, preventing the TC-07 case.
