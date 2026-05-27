// @ts-check

/**
 * @typedef {'info' | 'warning'} NoticeSeverity
 * @typedef {'doc-context' | 'diff-range' | 'work-items' | 'iterations' | 'default-branch' | 'partial-run-check' | 'thread-match' | 'thread-classify' | 'thread-fetch' | 'inline-post' | 'summary-post' | 'patch-to-fixed' | 'diff-parse' | 'delta-reply' | 'completion-marker'} NoticeKind
 * @typedef {{ severity: NoticeSeverity, kind: NoticeKind, message: string }} Notice
 * @typedef {'first-review' | 're-review' | 'pre-pr' | 'dry-run-first' | 'aborted'} TrailerMode
 * @typedef {{ critical: number, important: number, minor: number }} FindingCounts
 */

const SEVERITY_EMOJI = {
	info: 'ℹ️',
	warning: '⚠',
}

/**
 * Creates a Notice object with the canonical shape.
 *
 * @param {NoticeSeverity} severity
 * @param {NoticeKind} kind
 * @param {string} message
 * @returns {Notice}
 */
export function createNotice(severity, kind, message) {
	return { severity, kind, message }
}

/**
 * Merges multiple Notice arrays, deduplicating by `kind` (first wins).
 *
 * @param {...Notice[]} sources
 * @returns {Notice[]}
 */
export function mergeNotices(...sources) {
	const seen = new Set()
	const out = []
	for (const list of sources) {
		for (const notice of list ?? []) {
			if (seen.has(notice.kind)) continue
			seen.add(notice.kind)
			out.push(notice)
		}
	}
	return out
}

/**
 * Renders Notices as a markdown block for the ADO Review Summary content.
 * Heading stays bare so mixed info/warning lists are not misrepresented;
 * each item carries its own per-severity emoji prefix.
 * Returns an empty string when there are no notices.
 *
 * @param {Notice[]} notices
 * @returns {string}
 */
export function formatNoticesAsSummaryBlock(notices) {
	if (!notices || notices.length === 0) return ''
	const lines = ['## Notices', '']
	for (const n of notices) {
		lines.push(`${SEVERITY_EMOJI[n.severity]} ${n.message}`)
	}
	return lines.join('\n')
}

/**
 * Renders Notices as a preamble block for Pre-PR mode output in the Claude
 * interface — same per-item shape as the Summary block, without the heading.
 * Returns an empty string when there are no notices.
 *
 * @param {Notice[]} notices
 * @returns {string}
 */
export function formatNoticesAsPrePrPreamble(notices) {
	if (!notices || notices.length === 0) return ''
	return notices.map((n) => `${SEVERITY_EMOJI[n.severity]} ${n.message}`).join('\n')
}

/**
 * Renders the mandatory end-of-run Trailer line for the Claude interface.
 * Carries findings counts (with severity breakdown), notice counts by severity,
 * and (for ADO modes) the PR URL.
 * Minor findings are excluded from the parenthetical breakdown to keep the
 * trailer concise; only critical and important counts are surfaced inline.
 *
 * @param {object} input
 * @param {TrailerMode} input.mode
 * @param {FindingCounts} [input.findings]
 * @param {Notice[]} [input.notices]
 * @param {string} [input.prUrl]
 * @param {number} [input.plannedActions]
 * @param {string} [input.abortKind]
 * @param {string} [input.abortReason]
 * @returns {string}
 */
export function formatTrailer(input) {
	if (input.mode === 'aborted') {
		const kind = input.abortKind ?? 'unknown'
		return input.abortReason ? `❌ Review aborted: ${kind} — ${input.abortReason}` : `❌ Review aborted: ${kind}`
	}
	const findings = input.findings ?? { critical: 0, important: 0, minor: 0 }
	const notices = input.notices ?? []
	const total = findings.critical + findings.important + findings.minor
	const warnings = notices.filter((n) => n.severity === 'warning').length
	const infos = notices.filter((n) => n.severity === 'info').length
	const findingsPart = `${total} ${plural(total, 'finding')} (${findings.critical} critical, ${findings.important} important)`
	const warnPart = `${warnings} ${plural(warnings, 'warning notice')}`
	const infoPart = `${infos} ${plural(infos, 'info notice')}`
	if (input.mode === 'pre-pr') {
		return `✅ Pre-PR review complete: ${findingsPart} · ${warnPart}`
	}
	if (input.mode === 'dry-run-first') {
		const planned = input.plannedActions ?? 0
		const plannedPart = `${planned} ${plural(planned, 'planned thread action')}`
		const url = input.prUrl ?? ''
		return `🔍 Dry-run complete: ${findingsPart} · ${plannedPart} · ${warnPart} · would have posted to ${url}`
	}
	const url = input.prUrl ?? ''
	return `✅ Review posted: ${findingsPart} · ${warnPart} · ${infoPart} → ${url}`
}

/**
 * @param {number} n
 * @param {string} word
 */
function plural(n, word) {
	return n === 1 ? word : `${word}s`
}
