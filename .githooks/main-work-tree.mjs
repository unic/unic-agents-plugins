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
	const [first] = listWorktrees(porcelain)
	return !first || first.isBare ? '' : first.path
}

/**
 * Every entry of `git worktree list --porcelain`, in its order. In a JavaScript regex `.` stops at
 * `\r` and a multiline `$` matches before it, so a `\r\n` line end leaves no `\r` in a field.
 * @param {string} porcelain
 * @returns {{ path: string, isBare: boolean, isPrunable: boolean }[]}
 */
export function listWorktrees(porcelain) {
	return porcelain
		.split(/\r?\n\r?\n/)
		.filter((entry) => entry.trim() !== '')
		.map((entry) => ({
			path: entry.match(/^worktree (.+)$/m)?.[1] ?? '',
			isBare: /^bare$/m.test(entry),
			isPrunable: /^prunable\b/m.test(entry),
		}))
}
