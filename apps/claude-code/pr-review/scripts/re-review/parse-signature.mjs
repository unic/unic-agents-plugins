// @ts-check
const SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'

/**
 * Extracts the iteration ID from a canonical bot comment signature.
 * Returns null for legacy bot comments (no iteration suffix) and non-bot comments.
 *
 * @param {string} commentBody
 * @returns {{ iterationId: number } | null}
 */
export function parseSignature(commentBody) {
	if (!commentBody.includes(SIGNATURE_PREFIX)) return null
	const match = commentBody.match(/Iteration ([0-9]+)/)
	if (!match) return null
	return { iterationId: Number(match[1]) }
}
