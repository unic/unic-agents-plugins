// @ts-check

/**
 * @typedef {{ line: number }} LinePos
 * @typedef {{ id: number, threadContext?: { filePath?: string, rightFileStart?: LinePos | null, rightFileEnd?: LinePos | null } | null, comments?: Array<{ content?: string }>, status?: string | number }} RawADOThread
 * @typedef {{ threadId: number, filePath: string | null, start: LinePos | null, end: LinePos | null, comments: Array<{ content?: string }>, status: string | number, isSummaryThread: boolean }} PriorThread
 */

/**
 * Processes an already-fetched ADO thread list to identify prior Claude Code
 * review threads, tag the summary thread, and parse the prior iteration ID.
 * Makes no network calls — receives raw ADO data as input.
 *
 * @param {{ threads: RawADOThread[], signaturePrefix: string }} input
 * @returns {{ isRereview: boolean, priorThreads: PriorThread[], summaryThread: PriorThread | null, priorIterationId: number | null }}
 */
export function detectPriorReview({ threads, signaturePrefix }) {
	const botRaw = threads.filter((t) => (t.comments ?? []).some((c) => (c.content ?? '').includes(signaturePrefix)))

	const candidates = botRaw.map((t) => {
		const filePath = t.threadContext?.filePath ?? null
		return {
			threadId: t.id,
			filePath,
			start: t.threadContext?.rightFileStart ?? null,
			end: t.threadContext?.rightFileEnd ?? null,
			comments: t.comments ?? [],
			status: t.status ?? 'active',
			isSummaryCandidate: filePath === null && (t.comments?.[0]?.content ?? '').startsWith('## PR Review Summary'),
		}
	})

	const maxSummaryId = candidates
		.filter((c) => c.isSummaryCandidate)
		.reduce((max, c) => Math.max(max, c.threadId), -Infinity)

	/** @type {PriorThread[]} */
	const priorThreads = candidates.map(({ isSummaryCandidate, ...t }) => ({
		...t,
		isSummaryThread: isSummaryCandidate && t.threadId === maxSummaryId,
	}))

	// Last "Iteration N" seen across all bot comments in thread order
	let priorIterationId = null
	for (const t of priorThreads) {
		for (const c of t.comments) {
			const match = (c.content ?? '').match(/Iteration ([0-9]+)/)
			if (match) priorIterationId = Number(match[1])
		}
	}

	return {
		isRereview: priorThreads.length > 0,
		priorThreads,
		summaryThread: priorThreads.find((t) => t.isSummaryThread) ?? null,
		priorIterationId,
	}
}
