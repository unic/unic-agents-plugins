// @ts-check
// Shared by `.githooks/set-hooks-path.mjs` and `.claude/hooks/block-nda-terms.mjs`, which both need the
// `.githooks` that `core.hooksPath` should point at.

/**
 * The main work tree of a repository, from `git worktree list --porcelain`, or '' when it has none.
 * The first entry is normally the main work tree. A bare repository has none, and with
 * `--separate-git-dir` git lists the git directory there instead, which holds no `.githooks`.
 * @param {string} porcelain
 */
export function findMainWorkTree(porcelain) {
	const [first = ''] = porcelain.split(/\r?\n\r?\n/)
	if (/^bare$/m.test(first)) return ''
	return first.match(/^worktree (.+)$/m)?.[1] ?? ''
}
