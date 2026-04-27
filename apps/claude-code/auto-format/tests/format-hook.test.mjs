import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/format-hook.mjs', import.meta.url))

function run(stdinJson, projectDir, extraEnv = {}) {
	const result = spawnSync(process.execPath, [SCRIPT], {
		input: stdinJson,
		env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...extraEnv },
		encoding: 'utf8',
	})
	return { exitCode: result.status, stderr: result.stderr, stdout: result.stdout }
}

function makeConsumer(setupFn) {
	const dir = mkdtempSync(join(tmpdir(), 'unic-format-test-'))
	setupFn?.(dir)
	return dir
}

function cleanup(dir) {
	rmSync(dir, { recursive: true, force: true })
}

test('exits 0 with empty stdin', () => {
	const dir = makeConsumer()
	try {
		const { exitCode } = run('', dir)
		assert.equal(exitCode, 0)
	} finally {
		cleanup(dir)
	}
})

test('exits 0 with empty JSON {}', () => {
	const dir = makeConsumer()
	try {
		const { exitCode } = run('{}', dir)
		assert.equal(exitCode, 0)
	} finally {
		cleanup(dir)
	}
})

test('exits 0 when file does not exist', () => {
	const dir = makeConsumer()
	try {
		const { exitCode } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'nonexistent.md') } }), dir)
		assert.equal(exitCode, 0)
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips _bmad/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '_bmad'))
		writeFileSync(join(d, '_bmad', 'test.md'), '# test\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '_bmad', 'test.md') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent when skipping')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips path-traversal (../)', () => {
	const dir = makeConsumer()
	const outsidePath = join(dir, '..', 'something.md')
	try {
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: outsidePath } }), dir)
		assert.equal(exitCode, 0)
		// Either the file doesn't exist (exits silently) or the path-traversal guard fires silently
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips unsupported extension (.toml)', () => {
	const dir = makeConsumer((d) => {
		writeFileSync(join(d, 'config.toml'), '[tool]\nname = "test"\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'config.toml') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 with malformed config file and logs warning', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		writeFileSync(join(d, '.claude', 'unic-format.json'), 'NOT JSON')
		writeFileSync(join(d, 'test.md'), '# test\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'test.md') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.match(stderr, /malformed/, 'should warn about malformed config')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips Windows-style _bmad\\ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '_bmad'))
		writeFileSync(join(d, '_bmad', 'test.md'), '# test\n')
	})
	try {
		// Simulate a Windows absolute path: replace the forward-slash separator
		// with backslash inside the subdir portion. After toPosix(), this should
		// still resolve to a _bmad/ prefix and be skipped.
		const winStylePath = join(dir, '_bmad', 'test.md').replace(/_bmad\//, '_bmad\\')
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: winStylePath } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent when skipping Windows-style path')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips Windows-style node_modules\\ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', 'foo'), { recursive: true })
		writeFileSync(join(d, 'node_modules', 'foo', 'index.md'), '# test\n')
	})
	try {
		const winStylePath = join(dir, 'node_modules', 'foo', 'index.md').replace(/node_modules\//, 'node_modules\\')
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: winStylePath } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 with mixed-separator traversal path (..\\\\..\\\\)', () => {
	const dir = makeConsumer()
	const mixedTraversal = join(dir, 'sub', '..', '..', 'outside.md').replace(/\//g, '\\')
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: mixedTraversal } }),
			dir,
		)
		assert.equal(exitCode, 0)
		// Either the file doesn't exist or path-traversal guard fires — both exit 0 silently
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('respects prettierExtensions override from config', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		// Only allow .md; .json should be skipped
		writeFileSync(join(d, '.claude', 'unic-format.json'), JSON.stringify({ prettierExtensions: ['.md'] }))
		writeFileSync(join(d, 'data.json'), '{"key":"value"}')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'data.json') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent: .json excluded by config')
	} finally {
		cleanup(dir)
	}
})
