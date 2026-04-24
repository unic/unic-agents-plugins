# 13. Normalise `<p>`-Wrapping on Injection Markers

**Priority:** P1
**Effort:** M
**Depends on:** none (self-contained change to `injectContent` and its regexes)
**Touches:** `scripts/push-to-confluence.mjs`

## Context

`injectContent` (Strategy 1, lines 121–165) handles `[AUTO_INSERT_START:label]` and `[AUTO_INSERT_END:label]` markers that users place in Confluence page body HTML. Confluence's rich-text editor wraps free-standing text nodes in `<p>` elements, so a marker typed into the Confluence editor often arrives in storage format as `<p>[AUTO_INSERT_START:label]</p>` rather than the bare `[AUTO_INSERT_START:label]`. The current regexes handle this by making both the leading `<p>` and the trailing `</p>` optional on each match:

```js
const TEXT_START_RE =
    /(?:<p>\s*)?\[AUTO_INSERT_START:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
```

This has a subtle structural flaw. When the marker is `<p>`-wrapped, the slice `existingBody.slice(afterStart + endMatch.index)` begins at the `[AUTO_INSERT_END:…]` text, not at the `<p>` that precedes it. That `<p>` was inside the "content to replace" zone and gets discarded, but the paired `</p>` after the marker text is preserved — producing a dangling `</p>` in the output. Confluence re-renders this as invalid storage HTML, occasionally producing a validation warning or extra whitespace on the page.

The fix is to use separate regex patterns for the `<p>`-wrapped and bare cases, detecting which form is present and applying the correct one consistently across both START and END markers, so the full `<p>marker</p>` block is consumed symmetrically.

## Current behaviour

**File:** `scripts/push-to-confluence.mjs`

**Lines 121–124 — marker regexes:**
```js
const TEXT_START_RE =
	/(?:<p>\s*)?\[AUTO_INSERT_START:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
const TEXT_END_RE =
	/(?:<p>\s*)?\[AUTO_INSERT_END:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
```

Both regexes make `<p>` and `</p>` independently optional via `(?:…)?`. The optional groups are NOT paired: the regex can match `<p>[AUTO_INSERT_START:label]` without a trailing `</p>`, or `[AUTO_INSERT_START:label]</p>` without a leading `<p>`. In practice Confluence always emits matched pairs, but the regex does not enforce this — and the slice logic that follows does not account for the wrapper being part of the match.

**Lines 159–165 — the defective return slice:**
```js
return (
	existingBody.slice(0, afterStart) +
	"\n" +
	newHtml +
	"\n" +
	existingBody.slice(afterStart + endMatch.index)
);
```

When the END marker is `<p>[AUTO_INSERT_END:label]</p>`, `endMatch.index` points to `[AUTO_INSERT_END:…]`, not to the `<p>` before it. That `<p>` is included in the discarded content zone, but the `</p>` after the marker text is preserved, producing:

```html
<p>[AUTO_INSERT_START:label]</p>
[injected HTML]
[AUTO_INSERT_END:label]</p>   ← dangling </p>
```

**Line 148 — the label-specific END regex also uses optional groups:**
```js
const labelEndRe = new RegExp(
	`(?:<p>\\s*)?\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\](?:\\s*<\\/p>)?`,
);
```
Same problem: `(?:<p>\\s*)?` and `(?:\\s*<\\/p>)?` are both optional and independently matchable.

## Target behaviour

Strategy 1 must consume markers and their `<p>` wrappers symmetrically:

1. Detect whether markers are `<p>`-wrapped by testing `_P_RE` patterns first.
2. If `<p>`-wrapped: use regex patterns that require the full `<p>…</p>` pair (no optional groups). Both START and END patterns consume the entire `<p>marker</p>` block.
3. If bare (no `<p>`): use patterns that match only the bare marker text.
4. Wrapping style must be consistent between START and END on the same page. Mismatch → log error + `process.exit(1)`.
5. The return value preserves both markers verbatim and replaces only the content between them.
6. Strategy 2 (anchor macros, lines 168–195) and Strategy 3 (append, lines 197–199) are unchanged.

## Implementation steps

### Step 1 — Replace the two module-level regex constants

**File:** `scripts/push-to-confluence.mjs`, lines 121–124

Before:
```js
const TEXT_START_RE =
	/(?:<p>\s*)?\[AUTO_INSERT_START:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
const TEXT_END_RE =
	/(?:<p>\s*)?\[AUTO_INSERT_END:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
```

After (4 named constants replacing 2):
```js
// Bare markers — no surrounding <p> tags
const TEXT_START_BARE_RE = /\[AUTO_INSERT_START:\s*([^\]]+?)\s*\]/;
const TEXT_END_BARE_RE   = /\[AUTO_INSERT_END:\s*([^\]]+?)\s*\]/;
// Full <p>-wrapped markers — both opening and closing tags required, no optional groups
const TEXT_START_P_RE    = /<p>\s*\[AUTO_INSERT_START:\s*([^\]]+?)\s*\]\s*<\/p>/;
const TEXT_END_P_RE      = /<p>\s*\[AUTO_INSERT_END:\s*([^\]]+?)\s*\]\s*<\/p>/;
```

Design notes:
- `BARE_RE`: no `<p>` at all, match only the bracket syntax.
- `P_RE`: both `<p>` and `</p>` are required. No `?` quantifier on either wrapper.
- `\s*` inside `<p>\s*[…` and `…]\s*<\/p>` allows for whitespace between the tag and the bracket (Confluence occasionally adds a non-breaking space or newline inside the `<p>`).
- The capture group `([^\]]+?)` extracts the label in all four patterns.

### Step 2 — Rewrite the Strategy 1 block inside `injectContent`

Replace lines 126–165 (the opening of `injectContent` through the end of the Strategy 1 return). Strategy 2 (lines 168–195) and Strategy 3 (lines 197–199) are NOT changed.

New function opening and Strategy 1 block:

```js
function injectContent(existingBody, newHtml, title) {
	// ── Strategy 1: plain-text markers ────────────────────────────────────────

	const hasPWrappedStart = TEXT_START_P_RE.test(existingBody);
	const hasBareStart     = TEXT_START_BARE_RE.test(existingBody);
	const hasPWrappedEnd   = TEXT_END_P_RE.test(existingBody);
	const hasBareEnd       = TEXT_END_BARE_RE.test(existingBody);

	const hasStart = hasPWrappedStart || hasBareStart;
	const hasEnd   = hasPWrappedEnd   || hasBareEnd;

	if (hasStart || hasEnd) {
		// Must have both or neither
		if (hasStart !== hasEnd) {
			console.error(
				`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END] on page "${title}" — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		// Wrapping style must be consistent across START and END
		const startIsWrapped = hasPWrappedStart;
		const endIsWrapped   = hasPWrappedEnd;

		if (startIsWrapped !== endIsWrapped) {
			console.error(
				`Marker wrapping mismatch on page "${title}": START is ${startIsWrapped ? "<p>-wrapped" : "bare"} but END is ${endIsWrapped ? "<p>-wrapped" : "bare"} — fix the Confluence page so both markers use the same format`,
			);
			process.exit(1);
		}

		const START_RE = startIsWrapped ? TEXT_START_P_RE : TEXT_START_BARE_RE;

		const startMatch = START_RE.exec(existingBody);
		const startLabel = startMatch[1].trim();

		// Build a label-specific END regex with the same wrapping style as START.
		// Escape special regex characters in the label before interpolating.
		const escapedLabel = startLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const labelEndRe = endIsWrapped
			? new RegExp(`<p>\\s*\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\]\\s*<\\/p>`)
			: new RegExp(`\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\]`);

		// Search for the END marker only in the content AFTER the START marker ends.
		// This avoids false label-mismatch errors when the page body contains
		// documentation examples of the marker syntax with different labels.
		const afterStart = startMatch.index + startMatch[0].length;
		const endMatch = labelEndRe.exec(existingBody.slice(afterStart));

		if (!endMatch) {
			console.error(
				`Marker label mismatch on page "${title}": [AUTO_INSERT_START:${startLabel}] has no matching [AUTO_INSERT_END:${startLabel}] — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		// Slice construction:
		//   prefix   — everything up to the start of the START marker (incl. its <p> if wrapped)
		//   suffix   — everything from the end of the END marker (incl. its </p> if wrapped)
		// The old content between markers is discarded. Both markers are re-inserted verbatim.
		const prefixEnd   = startMatch.index;                                 // start of START marker
		const suffixStart = afterStart + endMatch.index + endMatch[0].length; // end of END marker

		return (
			existingBody.slice(0, prefixEnd) +
			startMatch[0] +       // preserve START marker verbatim (with <p> wrapper if present)
			"\n" +
			newHtml +
			"\n" +
			endMatch[0] +         // preserve END marker verbatim (with <p> wrapper if present)
			existingBody.slice(suffixStart)
		);
	}

	// Strategy 2 and Strategy 3 follow here (unchanged) …
```

Key differences from the original:
- `prefixEnd = startMatch.index` (start of START marker, not end)
- `startMatch[0]` is explicitly re-inserted to preserve the START marker
- `endMatch[0]` is explicitly re-inserted to preserve the END marker
- `suffixStart = afterStart + endMatch.index + endMatch[0].length` (end of END marker including `</p>` if wrapped)
- No dangling `<p>` or `</p>` can appear because the full match — including wrapper tags — is accounted for in `startMatch[0]` and `endMatch[0]`

### Step 3 — Verify no remaining references to old regex names

```sh
grep -n "TEXT_START_RE\b\|TEXT_END_RE\b" scripts/push-to-confluence.mjs
```
Expected: 0 results. The two old names are fully replaced by the four new ones.

## Test cases

All test cases belong in `scripts/lib/inject.test.mjs` (created by spec 09).

### TC-01: bare markers — no `<p>` wrapping
```js
const result = injectContent(
  "<h1>Intro</h1>\n[AUTO_INSERT_START:overview]\n<p>old</p>\n[AUTO_INSERT_END:overview]\n<p>Footer</p>",
  "<p>new</p>",
  "Test Page",
);
// Expected:
// "<h1>Intro</h1>\n[AUTO_INSERT_START:overview]\n<p>new</p>\n[AUTO_INSERT_END:overview]\n<p>Footer</p>"
```
No dangling tags. Both markers preserved. Old content replaced.

### TC-02: `<p>`-wrapped markers — full pair consumed
```js
const result = injectContent(
  "<h1>Intro</h1>\n<p>[AUTO_INSERT_START:overview]</p>\n<p>old</p>\n<p>[AUTO_INSERT_END:overview]</p>\n<p>Footer</p>",
  "<p>new</p>",
  "Test Page",
);
// Expected:
// "<h1>Intro</h1>\n<p>[AUTO_INSERT_START:overview]</p>\n<p>new</p>\n<p>[AUTO_INSERT_END:overview]</p>\n<p>Footer</p>"
```
Both `<p>…</p>` wrappers preserved intact. No dangling tags.

### TC-03: `<p>`-wrapped with internal whitespace
```js
const result = injectContent(
  "<p>  [AUTO_INSERT_START:overview]  </p>\n<p>old</p>\n<p>  [AUTO_INSERT_END:overview]  </p>",
  "<p>new</p>",
  "Test Page",
);
// Expected: markers matched (whitespace-tolerant), full <p>  …  </p> blocks preserved verbatim
```

### TC-04: mismatch — START bare, END `<p>`-wrapped → error + exit 1
```
existingBody: "[AUTO_INSERT_START:overview]\n<p>old</p>\n<p>[AUTO_INSERT_END:overview]</p>"
Expected: process.exit(1), stderr contains "Marker wrapping mismatch"
```

### TC-05: mismatch — START `<p>`-wrapped, END bare → error + exit 1
```
existingBody: "<p>[AUTO_INSERT_START:overview]</p>\n<p>old</p>\n[AUTO_INSERT_END:overview]"
Expected: process.exit(1), stderr contains "Marker wrapping mismatch"
```

### TC-06: START without END → existing error path unchanged
```
existingBody: "[AUTO_INSERT_START:overview]\n<p>content</p>"
Expected: process.exit(1), stderr contains "Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END]"
```

### TC-07: label mismatch → existing error path unchanged
```
existingBody: "[AUTO_INSERT_START:overview]\n<p>content</p>\n[AUTO_INSERT_END:summary]"
Expected: process.exit(1), stderr contains "Marker label mismatch" and "overview"
```

### TC-08: no markers → Strategy 3 append (unchanged)
```js
injectContent("<p>existing</p>", "<p>appended</p>", "Test Page")
// Expected: "<p>existing</p>\n<p>appended</p>"
```

### TC-09: Strategy 2 anchor macros — no regression
Input `existingBody` contains `<ac:structured-macro ac:name="anchor">…md-start…</ac:structured-macro>` and `…md-end…`.
Expected: Strategy 2 path triggered, content replaced between anchors, no crash.

## Acceptance criteria

- `TEXT_START_RE` and `TEXT_END_RE` no longer exist in the file
- Four new constants defined: `TEXT_START_BARE_RE`, `TEXT_END_BARE_RE`, `TEXT_START_P_RE`, `TEXT_END_P_RE`
- `P_RE` patterns contain no `?` quantifier on the `<p>` or `</p>` portions (verified by inspection)
- TC-01 (bare): output has no dangling tags, both markers preserved
- TC-02 (`<p>`-wrapped): full `<p>marker</p>` blocks preserved, no dangling tags
- TC-03 (whitespace tolerance): `\s*` in P_RE patterns works
- TC-04 and TC-05 (wrapping mismatch): exit 1 with `"Marker wrapping mismatch"` in stderr
- TC-06 (START without END): exit 1, existing error message text unchanged
- TC-07 (label mismatch): exit 1, existing error message text unchanged
- TC-08 (Strategy 3 append): no regression
- TC-09 (Strategy 2 anchors): no regression
- `pnpm test` passes all cases

## Verification

```sh
# Confirm old regex names are gone
grep -c "TEXT_START_RE\b\|TEXT_END_RE\b" scripts/push-to-confluence.mjs
# Expected: 0

# Confirm four new names are defined
grep -n "TEXT_START_BARE_RE\|TEXT_END_BARE_RE\|TEXT_START_P_RE\|TEXT_END_P_RE" scripts/push-to-confluence.mjs
# Expected: 4 definition lines + usage lines inside injectContent

# Run tests
pnpm test
```

## Out of scope

- Do not touch Strategy 2 (anchor macros, lines 168–195).
- Do not touch Strategy 3 (append, lines 197–199).
- Do not change the `injectContent` function signature.
- Do not change the label-mismatch error message text (TC-07 path).
- Do not add support for multiple marker pairs on the same page.
- Do not change how `marked` generates HTML.
- Do not normalise Confluence storage format on fetch (a larger refactor deferred to post-spec-09).

## Follow-ups

- Add a `--validate-markers` flag to fetch a page and report marker wrapping style without pushing content.
- Post-spec-09: normalise markers on fetch by stripping `<p>` wrappers from bare text markers, so the script always writes bare markers back and never has to handle the `<p>`-wrapped case at runtime.
