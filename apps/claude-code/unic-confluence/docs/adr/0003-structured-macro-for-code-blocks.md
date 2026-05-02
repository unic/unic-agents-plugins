# 0003. ac:structured-macro for code blocks instead of <pre>

**Status:** Accepted (2025-04)

## Context

Confluence Storage Format supports both `<pre>` (plain preformatted text) and `ac:structured-macro name="code"` (the native Confluence Code macro). The Code macro provides syntax highlighting, a copy button, and a collapse option; `<pre>` provides none of these and loses formatting on Confluence editor reload.

## Decision

All fenced code blocks in Markdown are converted to `ac:structured-macro name="code"` elements in the Confluence Storage Format output. The language attribute is mapped to the macro's `language` parameter.

## Consequences

- Published code blocks look and behave like natively-authored Confluence code blocks.
- The conversion must handle unknown language identifiers gracefully (fall back to `text`).
- `<pre>` is never emitted by the converter.
