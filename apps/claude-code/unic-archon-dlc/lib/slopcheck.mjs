// @ts-check

/**
 * @typedef {{ [name: string]: string }} DepsMap
 * @typedef {{ name: string, assumed: boolean }} PackageVerdict
 * @typedef {((name: string) => Promise<boolean>) | null | undefined} RegistryFn
 */

/**
 * Compare two dependency maps and return the names that are in `next` but not in `prev`.
 * Both arguments are plain objects mapping package name → version specifier.
 * @param {DepsMap | null | undefined} prev
 * @param {DepsMap | null | undefined} next
 * @returns {string[]}
 */
export function parseNewPackages(prev, next) {
	const prevKeys = new Set(Object.keys(prev ?? {}))
	return Object.keys(next ?? {}).filter((k) => !prevKeys.has(k))
}

/**
 * Classify package names as assumed (unverifiable) or confirmed (registry check passed).
 * Falls back to assumed when:
 *   - no registryFn is provided
 *   - the registryFn returns false
 *   - the registryFn throws
 * @param {string[]} names
 * @param {RegistryFn} registryFn
 * @returns {Promise<PackageVerdict[]>}
 */
export async function classifyPackages(names, registryFn) {
	if (!registryFn) return names.map((name) => ({ name, assumed: true }))

	return Promise.all(
		names.map(async (name) => {
			try {
				const exists = await registryFn(name)
				return { name, assumed: !exists }
			} catch {
				return { name, assumed: true }
			}
		})
	)
}
