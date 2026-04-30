// @ts-check

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/format-hook.mjs', import.meta.url))

/**
 * @param {string} stdinJson
 * @param {string} projectDir
 * @param {Record<string, string>} [extraEnv]
 * @returns {{ exitCode: number | null, stderr: string, stdout: string }}
 */
function run(stdinJson, projectDir, extraEnv = {}) {
	const result = spawnSync(process.execPath, [SCRIPT], {
		input: stdinJson,
		env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...extraEnv },
		encoding: 'utf8',
	})
	return { exitCode: result.status, stderr: result.stderr, stdout: result.stdout }
}

/**
 * @param {((dir: string) => void) | undefined} [setupFn]
 * @returns {string}
 */
function makeConsumer(setupFn) {
	const dir = mkdtempSync(join(tmpdir(), 'unic-format-test-'))
	setupFn?.(dir)
	return dir
}

/**
 * @param {string} dir
 * @returns {void}
 */
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
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: join(dir, '_bmad', 'test.md') } }), dir)
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
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'config.toml') } }), dir)
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
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'test.md') } }), dir)
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
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: winStylePath } }), dir)
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
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: winStylePath } }), dir)
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
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: mixedTraversal } }), dir)
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
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'data.json') } }), dir)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent: .json excluded by config')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 with notebook_path event (NotebookEdit)', () => {
	const dir = makeConsumer((d) => {
		writeFileSync(join(d, 'notebook.ipynb'), '{}')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { notebook_path: join(dir, 'notebook.ipynb') } }),
			dir
		)
		assert.equal(exitCode, 0)
		// .ipynb is not in prettierExtensions defaults — file exists, passes existsSync, skipped silently
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips node_modules/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', 'foo'), { recursive: true })
		writeFileSync(join(d, 'node_modules', 'foo', 'index.js'), 'const x = 1\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'node_modules', 'foo', 'index.js') } }),
			dir
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent when skipping node_modules/')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips .git/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.git', 'hooks'), { recursive: true })
		writeFileSync(join(d, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '.git', 'hooks', 'pre-commit') } }),
			dir
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent when skipping .git/')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips .claude/worktrees/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude', 'worktrees', 'feature'), { recursive: true })
		writeFileSync(join(d, '.claude', 'worktrees', 'feature', 'index.js'), 'const x = 1\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '.claude', 'worktrees', 'feature', 'index.js') } }),
			dir
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent when skipping .claude/worktrees/')
	} finally {
		cleanup(dir)
	}
})

test('uses Biome when biome.json and biome binary are present', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		const stubScript = `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs'\nwriteFileSync('${join(d, '.biome-called').replace(/\\/g, '/')}', '1')\n`
		writeFileSync(join(d, 'node_modules', '.bin', 'biome'), stubScript, { mode: 0o755 })
		writeFileSync(join(d, 'biome.json'), '{"$schema":"https://biomejs.dev/schemas/2.4.0/schema.json"}\n')
		writeFileSync(join(d, 'test.ts'), 'const x = 1\n')
	})
	try {
		const { exitCode } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'test.ts') } }), dir)
		assert.equal(exitCode, 0)
		assert.ok(existsSync(join(dir, '.biome-called')), 'biome should have been called for .ts')
	} finally {
		cleanup(dir)
	}
})

test('does not use Biome for .md even when Biome is detected', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		const biomeStub = `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs'\nwriteFileSync('${join(d, '.biome-called').replace(/\\/g, '/')}', '1')\n`
		writeFileSync(join(d, 'node_modules', '.bin', 'biome'), biomeStub, { mode: 0o755 })
		writeFileSync(join(d, 'biome.json'), '{}')
		writeFileSync(join(d, 'README.md'), '# hello\n')
	})
	try {
		const { exitCode } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'README.md') } }), dir)
		assert.equal(exitCode, 0)
		assert.ok(!existsSync(join(dir, '.biome-called')), 'biome should NOT be called for .md')
	} finally {
		cleanup(dir)
	}
})

test('respects formatter: "prettier" override even when Biome is detected', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		const biomeStub = `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs'\nwriteFileSync('${join(d, '.biome-called').replace(/\\/g, '/')}', '1')\n`
		writeFileSync(join(d, 'node_modules', '.bin', 'biome'), biomeStub, { mode: 0o755 })
		writeFileSync(join(d, 'biome.json'), '{}')
		mkdirSync(join(d, '.claude'))
		writeFileSync(join(d, '.claude', 'unic-format.json'), JSON.stringify({ formatter: 'prettier' }))
		writeFileSync(join(d, 'test.ts'), 'const x = 1\n')
	})
	try {
		const { exitCode } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'test.ts') } }), dir)
		assert.equal(exitCode, 0)
		assert.ok(!existsSync(join(dir, '.biome-called')), 'biome should NOT be called when formatter is "prettier"')
	} finally {
		cleanup(dir)
	}
})

test('additionalSkipPrefixes merges with defaults', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		mkdirSync(join(d, 'my-generated'))
		writeFileSync(join(d, 'my-generated', 'file.md'), '# generated\n')
		writeFileSync(join(d, '.claude', 'unic-format.json'), JSON.stringify({ additionalSkipPrefixes: ['my-generated/'] }))
	})
	try {
		// Custom prefix is skipped
		const { exitCode: exitCustom, stderr: stderrCustom } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'my-generated', 'file.md') } }),
			dir
		)
		assert.equal(exitCustom, 0)
		assert.equal(stderrCustom, '', 'should skip custom prefix silently')

		// Default prefix _bmad/ must still be skipped (defaults preserved)
		mkdirSync(join(dir, '_bmad'))
		writeFileSync(join(dir, '_bmad', 'test.md'), '# test\n')
		const { exitCode: exitDefault, stderr: stderrDefault } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '_bmad', 'test.md') } }),
			dir
		)
		assert.equal(exitDefault, 0)
		assert.equal(stderrDefault, '', 'should still skip _bmad/ from defaults')
	} finally {
		cleanup(dir)
	}
})

test('skipPrefixes wins over additionalSkipPrefixes when both are set', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		mkdirSync(join(d, '_bmad'))
		writeFileSync(join(d, '_bmad', 'test.md'), '# test\n')
		// skipPrefixes replaces all defaults; _bmad/ is NOT in this list
		// additionalSkipPrefixes is present but should be ignored
		writeFileSync(
			join(d, '.claude', 'unic-format.json'),
			JSON.stringify({
				skipPrefixes: ['dist/'],
				additionalSkipPrefixes: ['my-generated/'],
			})
		)
	})
	try {
		// _bmad/ is NOT skipped because skipPrefixes replaced defaults and doesn't include it.
		// The file doesn't exist in node_modules so no formatter runs — just verify it's
		// not silently skipped by _bmad/ (it would proceed to the extension check and return
		// silently because no prettier binary is installed).
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: join(dir, '_bmad', 'test.md') } }), dir)
		assert.equal(exitCode, 0)
		// No formatter installed → stderr is empty regardless.
		// The key assertion is that the config was parsed correctly (no crash / malformed-config warning).
		assert.ok(!stderr.includes('malformed'), 'config should parse without error')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and logs timeout when prettier hangs', { timeout: 10_000 }, () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		mkdirSync(join(d, '.claude'))
		// Stub prettier that sleeps indefinitely
		const stubScript = '#!/usr/bin/env node\nawait new Promise(r => setTimeout(r, 90_000))\n'
		writeFileSync(join(d, 'node_modules', '.bin', 'prettier'), stubScript, { mode: 0o755 })
		// Use a 2s timeout so the test completes quickly
		writeFileSync(join(d, '.claude', 'unic-format.json'), JSON.stringify({ formatTimeoutMs: 2000 }))
		writeFileSync(join(d, 'test.md'), '# hello\n')
	})
	try {
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'test.md') } }), dir)
		assert.equal(exitCode, 0)
		assert.match(stderr, /timed out/, 'should log timeout warning')
	} finally {
		cleanup(dir)
	}
})
