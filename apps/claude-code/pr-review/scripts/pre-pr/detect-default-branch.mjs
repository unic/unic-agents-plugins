// @ts-check

/** @typedef {import('../ado/notices.mjs').Notice} Notice */
/** @typedef {{ branch: string | null, source: 'remote-show' | 'develop-fallback' | 'main-fallback' | 'master-fallback' | 'none', notice?: Notice }} DetectResult */

/**
 * Detects the default branch via a prioritized fallback chain.
 *
 * Chain order:
 * 1. remoteHeadBranch (non-empty) — parsed from `git remote show origin` HEAD branch line
 * 2. 'develop' checked via branchExists
 * 3. 'main' checked via branchExists
 * 4. 'master' checked via branchExists
 * 5. none — returns { branch: null, source: 'none' }
 *
 * Emits a warning Notice for every fallback level (levels 2–5). Level 1 is
 * considered authoritative so no notice is emitted. Level 5 also emits a
 * warning notice; the caller is expected to abort on branch: null.
 *
 * @param {{ branchExists: (name: string) => boolean, remoteHeadBranch: string }} input
 * @returns {DetectResult}
 */
export function detectDefaultBranch({ branchExists, remoteHeadBranch }) {
	if (remoteHeadBranch?.trim()) {
		return { branch: remoteHeadBranch.trim(), source: 'remote-show' }
	}

	/** @type {Array<[string, 'develop-fallback' | 'main-fallback' | 'master-fallback']>} */
	const fallbacks = [
		['develop', 'develop-fallback'],
		['main', 'main-fallback'],
		['master', 'master-fallback'],
	]

	for (const [name, source] of fallbacks) {
		if (branchExists(name)) {
			return {
				branch: name,
				source,
				notice: {
					severity: 'warning',
					kind: 'default-branch',
					message: `Default branch not detected via remote-show; computed diff against origin/${name} (${source}).`,
				},
			}
		}
	}

	return {
		branch: null,
		source: 'none',
		notice: {
			severity: 'warning',
			kind: 'default-branch',
			message:
				'Could not detect a default branch: remote-show failed and no develop/main/master branch found locally. Pre-PR run aborted.',
		},
	}
}
