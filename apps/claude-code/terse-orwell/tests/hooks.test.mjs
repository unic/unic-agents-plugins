// @ts-check

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const INJECT = fileURLToPath(new URL('../scripts/inject.mjs', import.meta.url))
const WRITE_LAYER = fileURLToPath(new URL('../scripts/write-layer.mjs', import.meta.url))
const LAYER = '- Chat language: Spanish\n- Artefact language: English'

/** @type {string} */
let configDir

beforeEach(() => {
	configDir = mkdtempSync(join(tmpdir(), 'terse-orwell-test-'))
})

afterEach(() => {
	rmSync(configDir, { recursive: true, force: true })
})

/**
 * Runs a script as Claude Code does, with stdin and `CLAUDE_CONFIG_DIR` set to
 * the temporary profile.
 *
 * @param {string} script
 * @param {string} stdin
 */
function run(script, stdin) {
	const result = spawnSync(process.execPath, [script], {
		input: stdin,
		encoding: 'utf8',
		env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
	})
	return { exitCode: result.status, stdout: result.stdout }
}

/** @param {string} hookEventName */
function hook(hookEventName) {
	const { stdout } = run(INJECT, JSON.stringify({ hook_event_name: hookEventName }))
	return stdout ? JSON.parse(stdout) : null
}

/** @param {string} body */
function writeLayer(body) {
	return run(WRITE_LAYER, body)
}

function claudeMd() {
	return readFileSync(join(configDir, 'CLAUDE.md'), 'utf8')
}

function installUnslop() {
	mkdirSync(join(configDir, 'skills', 'unslop'), { recursive: true })
	writeFileSync(join(configDir, 'skills', 'unslop', 'SKILL.md'), '---\nname: unslop\n---\n\n# Unslop marker text\n')
}

test('SessionStart sends the Shared setup rules', () => {
	assert.match(hook('SessionStart').hookSpecificOutput.additionalContext, /## Source accuracy and drafting/)
})

test('SessionStart warns until /setup has written the Personal layer', () => {
	assert.match(hook('SessionStart').systemMessage, /Run \/terse-orwell:setup/)
})

test('SessionStart stops the setup warning once the Personal layer exists', () => {
	writeLayer(LAYER)
	installUnslop()
	assert.equal(hook('SessionStart').systemMessage, undefined)
})

test('SessionStart names the missing unslop skill', () => {
	assert.match(hook('SessionStart').systemMessage, /unslop skill not found/)
})

test('SessionStart appends the unslop text without its frontmatter', () => {
	installUnslop()
	assert.match(hook('SessionStart').hookSpecificOutput.additionalContext, /\n\n# Unslop marker text$/)
})

test('SubagentStart sends the output style without its frontmatter', () => {
	assert.match(
		hook('SubagentStart').hookSpecificOutput.additionalContext,
		/^Write every piece of prose you return in this style\.\n\nYou are pairing/
	)
})

test('SubagentStart sends the Shared setup rules after the style', () => {
	assert.match(
		hook('SubagentStart').hookSpecificOutput.additionalContext,
		/## Orwell's six rules[\s\S]*## Source accuracy and drafting/
	)
})

test('UserPromptSubmit names both languages when they differ', () => {
	writeLayer(LAYER)
	assert.equal(
		hook('UserPromptSubmit').hookSpecificOutput.additionalContext,
		'Reply to the user in Spanish; artefacts stay English.'
	)
})

test('UserPromptSubmit injects nothing when both languages match', () => {
	writeLayer('- Chat language: English\n- Artefact language: english')
	assert.equal(hook('UserPromptSubmit'), null)
})

test('UserPromptSubmit injects nothing without a Personal layer', () => {
	assert.equal(hook('UserPromptSubmit'), null)
})

test('the hook exits 0 on a payload that is not JSON', () => {
	assert.equal(run(INJECT, 'not json').exitCode, 0)
})

test('write-layer appends a block after existing content', () => {
	writeFileSync(join(configDir, 'CLAUDE.md'), '# Mine\n')
	writeLayer(LAYER)
	assert.equal(claudeMd(), `# Mine\n\n<!-- >>> terse-orwell >>> -->\n${LAYER}\n<!-- <<< terse-orwell <<< -->\n`)
})

test('write-layer replaces the block and keeps the text around it', () => {
	writeFileSync(
		join(configDir, 'CLAUDE.md'),
		'before\n<!-- >>> terse-orwell >>> -->\nold\n<!-- <<< terse-orwell <<< -->\nafter\n'
	)
	writeLayer('new')
	assert.equal(claudeMd(), 'before\n<!-- >>> terse-orwell >>> -->\nnew\n<!-- <<< terse-orwell <<< -->\nafter\n')
})

test('write-layer refuses a file with one marker and leaves it unchanged', () => {
	writeFileSync(join(configDir, 'CLAUDE.md'), 'mine\n<!-- >>> terse-orwell >>> -->\n')
	writeLayer('new')
	assert.equal(claudeMd(), 'mine\n<!-- >>> terse-orwell >>> -->\n')
})
