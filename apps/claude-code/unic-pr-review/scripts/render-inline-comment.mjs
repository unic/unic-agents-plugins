#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * render-inline-comment.mjs — CLI bridge between the ADO Writer agent and the
 * Inline Comment renderer.
 *
 * Reads a single Finding from the `INLINE_COMMENT_JSON` environment variable,
 * renders the Inline Comment markdown (including the Bot Signature footer, which
 * `renderInlineComment` obtains from `signature.mjs` — never inlined here), and
 * writes it to stdout.
 *
 * Required fields: `severity`, `title`, `body`, `iteration`.
 * Optional field: `suggestion` (a ```suggestion block is emitted only when this
 * is a non-empty string — the renderer enforces this).
 *
 * Exposed as a standalone script so the agent can shell out cross-platform
 * (Windows cmd / PowerShell / bash) without an inline `node -e` snippet whose
 * quoting rules differ per shell.
 */

import { renderInlineComment } from './lib/inline-comment-renderer.mjs'

const raw = process.env.INLINE_COMMENT_JSON
if (!raw) {
	process.stderr.write('render-inline-comment: INLINE_COMMENT_JSON environment variable is required\n')
	process.exit(1)
}

let ctx
try {
	ctx = JSON.parse(raw)
} catch (err) {
	process.stderr.write(
		`render-inline-comment: INLINE_COMMENT_JSON is not valid JSON — ${err instanceof Error ? err.message : String(err)}\n`
	)
	process.exit(1)
}

if (!ctx || typeof ctx !== 'object') {
	process.stderr.write('render-inline-comment: INLINE_COMMENT_JSON must be an object\n')
	process.exit(1)
}

for (const field of ['severity', 'title', 'body', 'iteration']) {
	if (!(field in ctx)) {
		process.stderr.write(`render-inline-comment: missing required field "${field}"\n`)
		process.exit(1)
	}
}

process.stdout.write(
	renderInlineComment({
		severity: ctx.severity,
		title: ctx.title,
		body: ctx.body,
		suggestion: typeof ctx.suggestion === 'string' ? ctx.suggestion : undefined,
		iteration: ctx.iteration,
	})
)
