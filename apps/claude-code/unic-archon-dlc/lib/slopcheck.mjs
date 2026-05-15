// @ts-check

/**
 * A flat map of package name → version specifier (e.g. from package.json dependencies).
 * @typedef {{ [name: string]: string }} DepsMap
 */

/**
 * Result of classifying a single package name against a registry.
 * @typedef {Object} PackageVerdict
 * @property {string} name - npm package name
 * @property {boolean} assumed - true when existence could not be confirmed via registry
 */

/**
 * Optional async registry lookup function.
 * Returns true when the package is confirmed to exist in the registry.
 * Pass null or undefined to skip registry checks (all packages are assumed).
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
			} catch (err) {
				// Registry check failed (network error, timeout, etc.).
				// Log the reason so operators can distinguish transient failures
				// from legitimate "unknown package" verdicts.
				process.stderr.write(
					`[unic-archon-dlc] Warning: registry check failed for '${name}' — marking as [ASSUMED]. Reason: ${/** @type {Error} */ (err).message}\n`
				)
				return { name, assumed: true }
			}
		})
	)
}
