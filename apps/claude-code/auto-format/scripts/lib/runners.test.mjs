// @ts-check
import { ok, strictEqual } from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runFormatter } from './runners.mjs'

/**
 * Writes a stub Node.js script to a temp directory and returns its path.
 * Caller is responsible for rmSync(dir) in a finally block.
 *
 * @param {string} script - Body of the stub (executed by node).
 * @returns {{ binPath: string, dir: string }}
 */
function makeStub(script) {
	const dir = mkdtempSync(join(tmpdir(), 'runners-test-'))
	const binPath = join(dir, 'stub.mjs')
	writeFileSync(binPath, script)
	return { binPath, dir }
}

/**
 * Intercepts process.stderr.write for the duration of fn, returns captured lines.
 *
 * @param {() => void} fn
 * @returns {string[]}
 */
function captureStderr(fn) {
	/** @type {string[]} */
	const lines = []
	const orig = process.stderr.write.bind(process.stderr)
	process.stderr.write = (/** @type {string} */ s) => {
		lines.push(String(s))
		return true
	}
	try {
		fn()
	} finally {
		process.stderr.write = orig
	}
	return lines
}

test('silent when binary is missing and warnIfMissing is false (or omitted)', () => {
	const lines = captureStderr(() => {
		runFormatter({ name: 'fake', bin: '/nonexistent/bin/fake', args: (f) => [f] }, '/some/file.ts', '/tmp', 5_000)
	})
	strictEqual(lines.length, 0)
})

test('warns when binary is missing and warnIfMissing is true', () => {
	const lines = captureStderr(() => {
		runFormatter(
			{ name: 'fake', bin: '/nonexistent/bin/fake', args: (f) => [f], warnIfMissing: true },
			'/some/file.ts',
			'/tmp',
			5_000
		)
	})
	strictEqual(lines.length, 1)
	ok(lines[0].includes('binary not found'), `expected "binary not found" in: ${lines[0]}`)
})

test('reports timeout when process exceeds timeoutMs', () => {
	const { binPath, dir } = makeStub('setInterval(() => {}, 999)')
	try {
		const lines = captureStderr(() => {
			runFormatter({ name: 'slow', bin: binPath, args: (f) => [f] }, '/some/file.ts', dir, 50)
		})
		strictEqual(lines.length, 1)
		ok(lines[0].includes('timed out'), `expected "timed out" in: ${lines[0]}`)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('silent for exit codes in toleratedStatuses', () => {
	const { binPath, dir } = makeStub('process.exit(1)')
	try {
		const lines = captureStderr(() => {
			runFormatter(
				{ name: 'eslint', bin: binPath, args: (f) => [f], toleratedStatuses: [1] },
				'/some/file.ts',
				dir,
				5_000
			)
		})
		strictEqual(lines.length, 0)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('reports failure for non-tolerated non-zero exit code', () => {
	const { binPath, dir } = makeStub('process.exit(2)')
	try {
		const lines = captureStderr(() => {
			runFormatter({ name: 'biome', bin: binPath, args: (f) => [f] }, '/some/file.ts', dir, 5_000)
		})
		strictEqual(lines.length, 1)
		ok(lines[0].includes('failed (exit 2)'), `expected "failed (exit 2)" in: ${lines[0]}`)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('reports args error and never throws when args() throws', () => {
	const { binPath, dir } = makeStub('')
	try {
		const lines = captureStderr(() => {
			runFormatter(
				{
					name: 'bad-args',
					bin: binPath,
					args: () => {
						throw new Error('cannot compute args')
					},
				},
				'/some/file.ts',
				dir,
				5_000
			)
		})
		strictEqual(lines.length, 1)
		ok(lines[0].includes('args error'), `expected "args error" in: ${lines[0]}`)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('passes args(filePath) to the subprocess', () => {
	const { binPath, dir } = makeStub(
		`import { writeFileSync } from 'node:fs'\nwriteFileSync(process.argv[2] + '.called', '1')\n`
	)
	const targetFile = join(dir, 'target.ts')
	writeFileSync(targetFile, '')
	try {
		captureStderr(() => {
			runFormatter({ name: 'sentinel', bin: binPath, args: (f) => [f] }, targetFile, dir, 5_000)
		})
		ok(existsSync(`${targetFile}.called`), 'stub should have written the sentinel file')
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
