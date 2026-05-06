// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSignature } from '../scripts/re-review/parse-signature.mjs'

const SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'

describe('parseSignature', () => {
	it('extracts iterationId from current format', () => {
		const body = `Consider adding a null check here.\n---\n${SIGNATURE_PREFIX} — Iteration 3`
		const result = parseSignature(body)
		assert.deepEqual(result, { iterationId: 3 })
	})

	it('returns null for legacy format (signature present, no iteration suffix)', () => {
		const body = `Some comment.\n---\n${SIGNATURE_PREFIX}`
		const result = parseSignature(body)
		assert.equal(result, null)
	})

	it('returns null for human comment (no signature)', () => {
		const body = 'This is intentional — the caller contract guarantees a non-null value.'
		const result = parseSignature(body)
		assert.equal(result, null)
	})

	it('extracts iterationId = 1 from first review', () => {
		const body = `Finding text.\n---\n${SIGNATURE_PREFIX} — Iteration 1`
		const result = parseSignature(body)
		assert.deepEqual(result, { iterationId: 1 })
	})

	it('handles iterationId embedded in larger body', () => {
		const body = `Line one.\nLine two.\n---\n${SIGNATURE_PREFIX} — Iteration 42`
		const result = parseSignature(body)
		assert.deepEqual(result, { iterationId: 42 })
	})
})
