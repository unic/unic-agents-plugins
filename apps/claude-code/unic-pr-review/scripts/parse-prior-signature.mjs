// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * parse-prior-signature.mjs — executable wrapper around parseSignature.
 *
 * Reads a JSON array of SignatureThread objects from stdin, calls parseSignature,
 * and writes the result (ParsedSignature | null) to stdout as JSON.
 *
 * Usage (from ADO Fetcher agent):
 *   echo "$FILTERED_THREADS_JSON" | node scripts/parse-prior-signature.mjs
 *
 * The bot-identity filtering (keeping only threads where comments[0].author.id
 * matches IDENTITY.id) must be done by the caller BEFORE piping here.
 */

import { createInterface } from 'node:readline'
import { parseSignature } from './lib/signature.mjs'

const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })
const chunks = []
for await (const line of rl) {
	chunks.push(line)
}

/** @type {import('./lib/signature.mjs').SignatureThread[]} */
let threads
try {
	threads = JSON.parse(chunks.join('\n'))
} catch (err) {
	process.stderr.write(
		`parse-prior-signature: stdin is not valid JSON — ${err instanceof Error ? err.message : String(err)}\n`
	)
	process.exit(1)
}

if (!Array.isArray(threads)) {
	process.stderr.write(`parse-prior-signature: expected a JSON array, got ${typeof threads}\n`)
	process.exit(1)
}

process.stdout.write(`${JSON.stringify(parseSignature(threads))}\n`)
