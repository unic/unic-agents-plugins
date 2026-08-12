// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { inspectLocalOverrides, installMethods, verifyBundle, verifyLicence } from '../lib/methods-bundle.mjs'
import { METHODS_BUNDLE, METHODS_MANIFEST } from '../lib/methods-manifest.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-bundle-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

/**
 * Write a Local override `SKILL.md` and return the temp repo root it lives under.
 * @param {string} root
 * @param {string} name
 * @param {string} contents
 * @returns {string}
 */
function writeOverride(root, name, contents) {
	const dir = join(root, '.archon/methods.local', name)
	mkdirSync(dir, { recursive: true })
	const absolute = join(dir, 'SKILL.md')
	writeFileSync(absolute, contents)
	return absolute
}

// --- verifyBundle -----------------------------------------------------------------------------

/** Every file the manifest declares: one `SKILL.md` per entry, plus that entry's sub-files. */
const DECLARED_FILE_COUNT = METHODS_MANIFEST.reduce((total, entry) => total + 1 + entry.subFiles.length, 0)

test('verifyBundle passes when every declared file is present', () => {
	const bundleRoot = resolve('/bundle')
	const probed = []
	const existsFn = (/** @type {string} */ p) => {
		probed.push(p)
		return true
	}

	assert.deepEqual(verifyBundle({ bundleRoot, existsFn }), { ok: true })
	assert.equal(probed.length, DECLARED_FILE_COUNT, 'should probe every SKILL.md and every declared sub-file')
})

test('verifyBundle probes each declared sub-file, not just the SKILL.md', () => {
	// A Method reads its own companion files, so a bundle holding only SKILL.md is incomplete even
	// though every closure test would still pass — that scan reads what it finds, not a fixed list.
	const bundleRoot = resolve('/bundle')
	/** @type {string[]} */
	const probed = []
	verifyBundle({
		bundleRoot,
		existsFn: (p) => {
			probed.push(p)
			return true
		},
	})

	assert.ok(probed.includes(join(bundleRoot, 'skills/engineering/tdd/mocking.md')))
	assert.ok(probed.includes(join(bundleRoot, 'skills/engineering/triage/AGENT-BRIEF.md')))
})

test('verifyBundle reports a missing sub-file', () => {
	const bundleRoot = resolve('/bundle')
	const absent = 'skills/engineering/domain-modeling/ADR-FORMAT.md'
	const existsFn = (/** @type {string} */ p) => p !== join(bundleRoot, absent)

	assert.deepEqual(verifyBundle({ bundleRoot, existsFn }), { ok: false, missing: [absent] })
})

test('verifyBundle reports the upstreamPath of every missing Method', () => {
	const bundleRoot = resolve('/bundle')
	const absent = METHODS_MANIFEST[3].upstreamPath
	const existsFn = (/** @type {string} */ p) => p !== join(bundleRoot, absent)

	assert.deepEqual(verifyBundle({ bundleRoot, existsFn }), { ok: false, missing: [absent] })
})

test('verifyBundle probes the upstreamPath verbatim, so an upstream relocation is caught', () => {
	// Path derived from `resolve`, never a literal: the Windows CI runner's cwd is on `D:`.
	const bundleRoot = resolve('/bundle')
	/** @type {string[]} */
	const probed = []
	verifyBundle({
		bundleRoot,
		existsFn: (p) => {
			probed.push(p)
			return true
		},
	})

	assert.ok(probed.includes(join(bundleRoot, 'skills/engineering/to-spec/SKILL.md')))
	assert.ok(probed.includes(join(bundleRoot, 'skills/productivity/grilling/SKILL.md')))
})

test('the real vendored bundle satisfies the manifest closure', () => {
	// The one test here that reads the shipped files: it is what makes a forgotten re-vendor fail.
	const bundleRoot = resolve(import.meta.dirname, '..', 'vendor', 'mattpocock-skills')

	assert.deepEqual(verifyBundle({ bundleRoot }), { ok: true })
})

// --- verifyLicence ----------------------------------------------------------------------------

test('verifyLicence passes on the real vendored LICENSE', () => {
	const bundleRoot = resolve(import.meta.dirname, '..', 'vendor', 'mattpocock-skills')

	const result = verifyLicence({ bundleRoot })

	assert.equal(result.ok, true)
	assert.equal(/** @type {{ sha256: string }} */ (result).sha256, METHODS_BUNDLE.licenceSha256)
})

test('verifyLicence reports a missing LICENSE and tells the caller not to create one', () => {
	const bundleRoot = resolve('/bundle')

	const result = verifyLicence({
		bundleRoot,
		readFileFn: () => {
			throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
		},
	})

	assert.equal(result.ok, false)
	assert.equal(/** @type {{ code: string }} */ (result).code, 'missing')
	assert.match(/** @type {{ message: string }} */ (result).message, /never create a LICENSE file/)
})

test('verifyLicence reports code unreadable, not missing, for a non-ENOENT read failure', () => {
	const bundleRoot = resolve('/bundle')

	const result = verifyLicence({
		bundleRoot,
		readFileFn: () => {
			throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
		},
	})

	assert.equal(result.ok, false)
	assert.equal(/** @type {{ code: string }} */ (result).code, 'unreadable')
	assert.match(/** @type {{ message: string }} */ (result).message, /permissions or filesystem problem/)
})

test('verifyLicence reports a mismatch when the LICENSE has been edited', () => {
	const bundleRoot = resolve('/bundle')

	const result = verifyLicence({ bundleRoot, readFileFn: () => 'MIT License\n(tampered)\n' })

	assert.equal(result.ok, false)
	assert.equal(/** @type {{ code: string }} */ (result).code, 'mismatch')
	assert.match(/** @type {{ message: string }} */ (result).message, new RegExp(METHODS_BUNDLE.licenceSha256))
})

// --- installMethods ---------------------------------------------------------------------------

test('installMethods clean-replaces .archon/methods before copying', () => {
	const bundleRoot = resolve('/bundle')
	const repoRoot = resolve('/repo')
	/** @type {{ path: string, options: object }[]} */
	const removed = []
	/** @type {{ from: string, to: string, options: object }[]} */
	const copied = []

	const result = installMethods({
		bundleRoot,
		repoRoot,
		rmFn: (path, options) => removed.push({ path, options }),
		cpFn: (from, to, options) => copied.push({ from, to, options }),
	})

	assert.deepEqual(removed, [{ path: join(repoRoot, '.archon/methods'), options: { recursive: true, force: true } }])
	assert.deepEqual(result, { ok: true, installed: METHODS_MANIFEST.map((entry) => entry.name) })
	assert.equal(copied.length, METHODS_MANIFEST.length)
})

test('installMethods copies each Method from its upstream directory to a flat, name-keyed target', () => {
	const bundleRoot = resolve('/bundle')
	const repoRoot = resolve('/repo')
	/** @type {{ from: string, to: string, options: object }[]} */
	const copied = []

	installMethods({
		bundleRoot,
		repoRoot,
		rmFn: () => {},
		cpFn: (from, to, options) => copied.push({ from, to, options }),
	})

	assert.deepEqual(copied[0], {
		from: join(bundleRoot, 'skills/engineering/to-spec'),
		to: join(repoRoot, '.archon/methods', 'to-spec'),
		options: { recursive: true },
	})
	const grilling = copied.find((c) => c.to === join(repoRoot, '.archon/methods', 'grilling'))
	assert.deepEqual(grilling?.from, join(bundleRoot, 'skills/productivity/grilling'))
})

test('installMethods never touches the Local-override tier', () => {
	const bundleRoot = resolve('/bundle')
	const repoRoot = resolve('/repo')
	/** @type {string[]} */
	const touched = []

	installMethods({
		bundleRoot,
		repoRoot,
		rmFn: (path) => touched.push(path),
		cpFn: (from, to) => touched.push(from, to),
	})

	for (const path of touched) {
		assert.ok(!path.includes('methods.local'), `installMethods must not touch ${path}`)
	}
})

test('installMethods removes with force, so a first-ever install does not throw', () => {
	// `rmSync` defaults `force` to false — without it, a repo with no `.archon/methods/` yet fails.
	const bundleRoot = resolve('/bundle')
	const repoRoot = tempDir()

	const result = installMethods({ bundleRoot, repoRoot, cpFn: () => {} })

	assert.equal(result.ok, true)
})

test('installMethods reports a partial failure without throwing, naming which Method failed and which already landed', () => {
	const bundleRoot = resolve('/bundle')
	const repoRoot = resolve('/repo')
	const failAt = 2
	let calls = 0

	const result = installMethods({
		bundleRoot,
		repoRoot,
		rmFn: () => {},
		cpFn: () => {
			calls += 1
			if (calls === failAt + 1) throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' })
		},
	})

	assert.equal(result.ok, false)
	assert.deepEqual(
		/** @type {{ installed: string[] }} */ (result).installed,
		METHODS_MANIFEST.slice(0, failAt).map((entry) => entry.name)
	)
	assert.equal(/** @type {{ failed: string }} */ (result).failed, METHODS_MANIFEST[failAt].name)
	assert.match(/** @type {{ message: string }} */ (result).message, /EBUSY/)
	assert.match(/** @type {{ message: string }} */ (result).message, /re-run \/unic-archon-dlc:setup/)
})

test('installMethods names the install directory, not a bogus Method, when the clean itself fails', () => {
	// The clean runs before any copy, so it fails on a directory. Every other stage reports a Method
	// name in `failed`, and the message formats `failed` as one — so passing the raw value through
	// here printed an absolute path inside `Failed to install Method "…"`, which names no Method and
	// differs on every machine.
	const result = installMethods({
		bundleRoot: resolve('/bundle'),
		repoRoot: resolve('/repo'),
		rmFn: () => {
			throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
		},
		cpFn: () => {},
	})

	assert.equal(result.ok, false)
	assert.deepEqual(/** @type {{ installed: string[] }} */ (result).installed, [])
	assert.equal(/** @type {{ failed: string }} */ (result).failed, '.archon/methods')
	const message = /** @type {{ message: string }} */ (result).message
	assert.doesNotMatch(message, /Method "/, 'the clean failure must not be reported as a named Method')
	assert.match(message, /\.archon\/methods/)
	assert.match(message, /EACCES/)
	assert.match(message, /re-run \/unic-archon-dlc:setup/)
})

// --- inspectLocalOverrides --------------------------------------------------------------------

test('inspectLocalOverrides returns nothing when the Local tier does not exist', () => {
	assert.deepEqual(inspectLocalOverrides({ repoRoot: tempDir() }), [])
})

test('inspectLocalOverrides accepts an override forked from the bundled tag', () => {
	const repoRoot = tempDir()
	writeOverride(repoRoot, 'tdd', `---\nname: tdd\nforked_from: ${METHODS_BUNDLE.tag}\n---\n\n# tdd\n`)

	assert.deepEqual(inspectLocalOverrides({ repoRoot }), [
		{ name: 'tdd', forkedFrom: METHODS_BUNDLE.tag, matchesBundle: true },
	])
})

test('inspectLocalOverrides flags an override forked from an older tag', () => {
	const repoRoot = tempDir()
	writeOverride(repoRoot, 'tdd', '---\nname: tdd\nforked_from: v1.0.0\n---\n\n# tdd\n')

	assert.deepEqual(inspectLocalOverrides({ repoRoot }), [{ name: 'tdd', forkedFrom: 'v1.0.0', matchesBundle: false }])
})

test('inspectLocalOverrides flags an override with no forked_from rather than skipping it', () => {
	const repoRoot = tempDir()
	writeOverride(repoRoot, 'triage', '---\nname: triage\n---\n\n# triage\n')

	assert.deepEqual(inspectLocalOverrides({ repoRoot }), [{ name: 'triage', forkedFrom: null, matchesBundle: false }])
})

test('inspectLocalOverrides flags an override with no frontmatter at all', () => {
	const repoRoot = tempDir()
	writeOverride(repoRoot, 'triage', '# triage\n\nNo frontmatter here.\n')

	assert.deepEqual(inspectLocalOverrides({ repoRoot }), [{ name: 'triage', forkedFrom: null, matchesBundle: false }])
})

test('inspectLocalOverrides flags an override whose frontmatter is unparseable YAML', () => {
	const repoRoot = tempDir()
	writeOverride(repoRoot, 'triage', '---\nname: [unclosed\n---\n\n# triage\n')

	assert.deepEqual(inspectLocalOverrides({ repoRoot }), [{ name: 'triage', forkedFrom: null, matchesBundle: false }])
})

test('inspectLocalOverrides ignores a directory with no SKILL.md', () => {
	const repoRoot = tempDir()
	mkdirSync(join(repoRoot, '.archon/methods.local/scratch'), { recursive: true })
	writeOverride(repoRoot, 'tdd', `---\nforked_from: ${METHODS_BUNDLE.tag}\n---\n`)

	assert.deepEqual(
		inspectLocalOverrides({ repoRoot }).map((o) => o.name),
		['tdd']
	)
})

test('inspectLocalOverrides reads only the Local tier, never the installed bundle', () => {
	const repoRoot = resolve('/repo')
	/** @type {string[]} */
	const probed = []

	inspectLocalOverrides({
		repoRoot,
		existsFn: (p) => {
			probed.push(p)
			return false
		},
	})

	assert.deepEqual(probed, [join(repoRoot, '.archon/methods.local')])
})

test('inspectLocalOverrides tolerates a frontmatter value that is not a string', () => {
	const repoRoot = tempDir()
	writeOverride(repoRoot, 'tdd', '---\nforked_from: 110\n---\n')

	assert.deepEqual(inspectLocalOverrides({ repoRoot }), [{ name: 'tdd', forkedFrom: null, matchesBundle: false }])
})
