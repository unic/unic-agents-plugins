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
 * Every entry of `git worktree list --porcelain`, in its order. It reads the `-z` form (git 2.36 and
 * later), where a NUL ends each line and a path may hold a newline, and the plain form, where a
 * `\r\n` line end leaves no `\r` in a field.
 * @param {string} porcelain
 * @returns {{ path: string, isBare: boolean, isPrunable: boolean }[]}
 */
export function listWorktrees(porcelain) {
	const isNul = porcelain.includes('\0')
	return porcelain
		.split(isNul ? '\0\0' : /\r?\n\r?\n/)
		.map((entry) => entry.split(isNul ? '\0' : /\r?\n/))
		.filter((lines) => lines.some((line) => line !== ''))
		.map((lines) => ({
			path: lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length) ?? '',
			isBare: lines.includes('bare'),
			isPrunable: lines.some((line) => line === 'prunable' || line.startsWith('prunable ')),
		}))
}
