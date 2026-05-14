// @ts-check

const OK_STATUSES = new Set([200, 201, 404, 409])
const ABORTED_STATUSES = new Set([401, 403])

/**
 * Maps an HTTP outcome to a Notice tier.
 *
 * @param {{ status?: number, body?: string, exitCode?: number }} input
 * @returns {{ tier: 'ok' | 'degraded' | 'aborted', kind: string, message: string }}
 */
export function classifyHttpError({ status = 0, body = '', exitCode = 0 } = {}) {
	// Network/process error: no usable HTTP status, non-zero exit
	if (!status && exitCode !== 0) {
		const detail = body ? `: ${body.slice(0, 200)}` : ''
		return { tier: 'degraded', kind: 'network', message: `Network error (exit ${exitCode})${detail}` }
	}

	if (OK_STATUSES.has(status)) {
		return { tier: 'ok', kind: 'ok', message: '' }
	}

	if (ABORTED_STATUSES.has(status)) {
		const detail = body ? ` — ${body.slice(0, 200)}` : ''
		return {
			tier: 'aborted',
			kind: 'auth',
			message: `HTTP ${status}: authentication/authorization failure${detail}. Try \`az devops login\` to re-authenticate.`,
		}
	}

	if (status >= 500 && status < 600) {
		const detail = body ? ` — ${body.slice(0, 200)}` : ''
		return { tier: 'degraded', kind: 'transient', message: `HTTP ${status}: server error${detail}` }
	}

	if (status >= 400 && status < 500) {
		const detail = body ? ` — ${body.slice(0, 200)}` : ''
		return { tier: 'degraded', kind: 'malformed-request', message: `HTTP ${status}: request error${detail}` }
	}

	// Non-zero exit with a status we don't recognise, or no status + zero exit (treat as ok)
	if (exitCode !== 0) {
		const detail = body ? `: ${body.slice(0, 200)}` : ''
		return { tier: 'degraded', kind: 'network', message: `Process exited with code ${exitCode}${detail}` }
	}

	return { tier: 'ok', kind: 'ok', message: '' }
}
