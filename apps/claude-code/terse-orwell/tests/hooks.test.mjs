// @ts-check

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
 * the temporary profile. The home directory points there too, so the fallback
 * to `~/.claude` never reads the developer's own files.
 *
 * @param {string} script
 * @param {string} stdin
 * @param {string[]} [args]
 */
function run(script, stdin, args = []) {
	const result = spawnSync(process.execPath, [script, ...args], {
		input: stdin,
		encoding: 'utf8',
		env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, HOME: configDir, USERPROFILE: configDir },
	})
	return { exitCode: result.status, stdout: result.stdout }
}

/**
 * @param {string} hookEventName
 * @param {string} part
 */
function hook(hookEventName, part) {
	const { stdout } = run(INJECT, JSON.stringify({ hook_event_name: hookEventName }), [part])
	return stdout ? JSON.parse(stdout) : null
}

/**
 * @param {string} hookEventName
 * @param {string} part
 */
function context(hookEventName, part) {
	return hook(hookEventName, part).hookSpecificOutput.additionalContext
}

/**
 * Saves the body to a file and passes its path, as `/terse-orwell:setup` does.
 *
 * @param {string} body
 */
function writeLayer(body) {
	const source = join(configDir, 'layer.md')
	writeFileSync(source, body)
	return run(WRITE_LAYER, '', [source])
}

function claudeMd() {
	return readFileSync(join(configDir, 'CLAUDE.md'), 'utf8')
}

/**
 * @param {string} [dir] the config directory to install into
 * @param {string} [text] the skill text after its frontmatter
 */
function installUnslop(dir = configDir, text = '# Unslop marker text') {
	mkdirSync(join(dir, 'skills', 'unslop'), { recursive: true })
	writeFileSync(join(dir, 'skills', 'unslop', 'SKILL.md'), `---\nname: unslop\n---\n\n${text}\n`)
}

test('the rules part sends the Shared setup rules', () => {
	assert.match(context('SessionStart', 'rules'), /## Source accuracy and drafting/)
})

test('SessionStart warns until /setup has written the Personal layer', () => {
	assert.match(hook('SessionStart', 'rules').systemMessage, /Run \/terse-orwell:setup/)
})

test('SessionStart stops warning once the Personal layer and unslop exist', () => {
	writeLayer(LAYER)
	installUnslop()
	assert.equal(hook('SessionStart', 'rules').systemMessage, undefined)
})

test('SessionStart names the missing unslop skill', () => {
	assert.match(hook('SessionStart', 'rules').systemMessage, /unslop skill not found/)
})

test('SubagentStart sends no setup warning', () => {
	assert.equal(hook('SubagentStart', 'rules').systemMessage, undefined)
})

test('the unslop part sends the skill text without its frontmatter', () => {
	installUnslop()
	assert.equal(context('SessionStart', 'unslop'), '# Unslop marker text')
})

test('the unslop part sends nothing when unslop is missing', () => {
	assert.equal(hook('SessionStart', 'unslop'), null)
})

test('the style part sends the output style without its frontmatter', () => {
	assert.match(
		context('SubagentStart', 'style'),
		/^Write every piece of prose you return in this style\.\n\nYou are pairing/
	)
})

test('the rules part stays under the 10,000-character context cap', () => {
	assert.ok(context('SessionStart', 'rules').length < 10_000)
})

test('the style part stays under the 10,000-character context cap', () => {
	assert.ok(context('SubagentStart', 'style').length < 10_000)
})

const LONG_UNSLOP = Array.from({ length: 15 }, (_, n) => `${n} ${'x'.repeat(998)}`).join('\n\n')

test('the first unslop part of a text over the cap stays under the cap', () => {
	installUnslop(configDir, LONG_UNSLOP)
	assert.ok(context('SessionStart', 'unslop').length < 10_000)
})

test('the second unslop part of a text over the cap stays under the cap', () => {
	installUnslop(configDir, LONG_UNSLOP)
	assert.ok(context('SessionStart', 'unslop-2').length < 10_000)
})

test('the two unslop parts together hold the whole text', () => {
	installUnslop(configDir, LONG_UNSLOP)
	assert.equal(`${context('SubagentStart', 'unslop')}\n\n${context('SubagentStart', 'unslop-2')}`, LONG_UNSLOP)
})

test('the second unslop part sends nothing for a text under the cap', () => {
	installUnslop()
	assert.equal(hook('SessionStart', 'unslop-2'), null)
})

test('SessionStart warns when the unslop text needs more than two parts', () => {
	installUnslop(configDir, 'x'.repeat(25_000))
	assert.match(hook('SessionStart', 'rules').systemMessage, /more than 2 parts/)
})

test('the unslop part falls back to ~/.claude when the config directory has none', () => {
	installUnslop(join(configDir, '.claude'))
	assert.equal(context('SessionStart', 'unslop'), '# Unslop marker text')
})

test('the language part names both languages when they differ', () => {
	writeLayer(LAYER)
	assert.equal(context('UserPromptSubmit', 'language'), 'Reply to the user in Spanish; artefacts stay English.')
})

test('the language part injects nothing when both languages match', () => {
	writeLayer('- Chat language: English\n- Artefact language: english')
	assert.equal(hook('UserPromptSubmit', 'language'), null)
})

test('the language part injects nothing without a Personal layer', () => {
	assert.equal(hook('UserPromptSubmit', 'language'), null)
})

test('the hook exits 0 on a payload that is not JSON', () => {
	assert.equal(run(INJECT, 'not json', ['rules']).exitCode, 0)
})

test('write-layer appends a block after existing content', () => {
	writeFileSync(join(configDir, 'CLAUDE.md'), '# Mine\n')
	writeLayer(LAYER)
	assert.equal(claudeMd(), `# Mine\n\n<!-- >>> terse-orwell >>> -->\n${LAYER}\n<!-- <<< terse-orwell <<< -->\n`)
})

test('write-layer keeps the trailing whitespace of the existing file', () => {
	writeFileSync(join(configDir, 'CLAUDE.md'), '# Mine\n\n\n')
	writeLayer(LAYER)
	assert.ok(claudeMd().startsWith('# Mine\n\n\n\n<!-- >>> terse-orwell >>> -->'))
})

test('write-layer replaces the block and keeps the text around it', () => {
	writeFileSync(
		join(configDir, 'CLAUDE.md'),
		'before\n<!-- >>> terse-orwell >>> -->\nold\n<!-- <<< terse-orwell <<< -->\nafter\n'
	)
	writeLayer('new')
	assert.equal(claudeMd(), 'before\n<!-- >>> terse-orwell >>> -->\nnew\n<!-- <<< terse-orwell <<< -->\nafter\n')
})

test('write-layer deletes the source file after writing', () => {
	writeLayer(LAYER)
	assert.equal(existsSync(join(configDir, 'layer.md')), false)
})

test('write-layer refuses a CLAUDE.md it cannot read', () => {
	mkdirSync(join(configDir, 'CLAUDE.md'))
	assert.notEqual(writeLayer(LAYER).exitCode, 0)
})

test('write-layer refuses a file with one marker and leaves it unchanged', () => {
	writeFileSync(join(configDir, 'CLAUDE.md'), 'mine\n<!-- >>> terse-orwell >>> -->\n')
	writeLayer('new')
	assert.equal(claudeMd(), 'mine\n<!-- >>> terse-orwell >>> -->\n')
})
