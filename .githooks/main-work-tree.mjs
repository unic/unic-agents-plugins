// @ts-check
// Shared by `.githooks/set-hooks-path.mjs` and `.claude/hooks/block-nda-terms.mjs`, which both need the
// `.githooks` that `core.hooksPath` should point at.

/**
 * The first entry of `git worktree list --porcelain`, which is normally the main work tree, or ''
 * for a bare repository. With `--separate-git-dir`, git lists the git directory there instead, and
 * this returns that directory. It holds no `.githooks`, so each caller finds no hooks there.
 * @param {string} porcelain
 */
export function findMainWorkTree(porcelain) {
	const [first = ''] = porcelain.split(/\r?\n\r?\n/)
	if (/^bare$/m.test(first)) return ''
	return first.match(/^worktree (.+)$/m)?.[1] ?? ''
}
