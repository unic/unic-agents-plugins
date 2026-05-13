// @ts-check

import { detectPriorReview } from './re-review/detect-prior-review.mjs'

/**
 * @typedef {{
 *   mode: 'first-review' | 're-review',
 *   isRereview: boolean,
 *   priorIterationId: string,
 *   summaryThreadId: string,
 * }} ModeDetectionResult
 */

/**
 * Classifies a PR as `first-review` or `re-review` from its already-fetched
 * thread list. Wraps `detectPriorReview` and stringifies the optional numeric
 * fields so the orchestrator can consume them via plain shell.
 *
 * Pure function. No I/O.
 *
 * @param {{ threads: unknown[], signaturePrefix: string }} input
 * @returns {ModeDetectionResult}
 */
export function detectMode({ threads, signaturePrefix }) {
	const r = detectPriorReview({
		// detect-prior-review accepts the raw ADO thread shape; the orchestrator
		// passes whatever `az repos pr thread list` returned, untouched.
		// @ts-expect-error -- runtime-validated by detectPriorReview's own guards
		threads: Array.isArray(threads) ? threads : [],
		signaturePrefix,
	})
	return {
		mode: r.isRereview ? 're-review' : 'first-review',
		isRereview: r.isRereview,
		priorIterationId: r.priorIterationId != null ? String(r.priorIterationId) : '',
		summaryThreadId: r.summaryThread != null ? String(r.summaryThread.threadId) : '',
	}
}

/**
 * Formats a `ModeDetectionResult` as four newline-separated shell-friendly
 * lines, intended to be eval-captured by the orchestrator:
 *
 *     MODE=first-review
 *     IS_REREVIEW=false
 *     PRIOR_ITERATION_ID=
 *     SUMMARY_THREAD_ID=
 *
 * @param {ModeDetectionResult} result
 * @returns {string}
 */
export function formatModeEnv(result) {
	return [
		`MODE=${result.mode}`,
		`IS_REREVIEW=${result.isRereview ? 'true' : 'false'}`,
		`PRIOR_ITERATION_ID=${result.priorIterationId}`,
		`SUMMARY_THREAD_ID=${result.summaryThreadId}`,
	].join('\n')
}
