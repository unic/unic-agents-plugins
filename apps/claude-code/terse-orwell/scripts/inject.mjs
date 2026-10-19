// @ts-check

// The plugin's only hook. It reads the hook payload on stdin and answers by
// `hook_event_name`:
//
// - SessionStart: the Shared setup rules, plus the unslop skill when installed.
// - SubagentStart: the output style and the same rules, because a subagent
//   never sees the output style or a plugin's SessionStart context.
// - UserPromptSubmit: one line naming the chat and artefact languages from the
//   Personal layer, because long runs of artefacts make the chat drift.
//
// It exits 0 on every path. A hook that fails must not block a session, a
// prompt or a subagent spawn.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
const START_MARKER = '<!-- >>> terse-orwell >>> -->'
const END_MARKER = '<!-- <<< terse-orwell <<< -->'

/** @param {string} path */
function readOrEmpty(path) {
	try {
		return readFileSync(path, 'utf8')
	} catch {
		return ''
	}
}

/** @param {string} text */
function stripFrontmatter(text) {
	return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

/** @returns {string | null} the Personal layer, or null when `/setup` has not run */
function readPersonalLayer() {
	const text = readOrEmpty(join(CONFIG_DIR, 'CLAUDE.md'))
	const start = text.indexOf(START_MARKER)
	const end = text.indexOf(END_MARKER)
	if (start === -1 || end < start) return null
	return text.slice(start + START_MARKER.length, end)
}

const unslopPath = join(CONFIG_DIR, 'skills', 'unslop', 'SKILL.md')

function sharedRules() {
	const rules = stripFrontmatter(readOrEmpty(join(PLUGIN_ROOT, 'context', 'shared-setup.md')))
	const unslop = stripFrontmatter(readOrEmpty(unslopPath))
	return unslop ? `${rules}\n\n${unslop}` : rules
}

/**
 * @param {string} hookEventName
 * @param {string} additionalContext
 * @param {string} [systemMessage]
 */
function respond(hookEventName, additionalContext, systemMessage) {
	/** @type {Record<string, unknown>} */
	const output = { hookSpecificOutput: { hookEventName, additionalContext } }
	if (systemMessage) output.systemMessage = systemMessage
	process.stdout.write(JSON.stringify(output))
}

function sessionStart() {
	const warnings = []
	if (readPersonalLayer() === null) {
		warnings.push('terse-orwell: no Personal layer yet. Run /terse-orwell:setup.')
	}
	if (!existsSync(unslopPath)) {
		warnings.push(`terse-orwell: unslop skill not found at ${unslopPath}. /terse-orwell:setup shows how to install it.`)
	}
	respond('SessionStart', sharedRules(), warnings.join('\n'))
}

function subagentStart() {
	const style = stripFrontmatter(readOrEmpty(join(PLUGIN_ROOT, 'output-styles', 'terse-orwell.md')))
	respond('SubagentStart', `Write every piece of prose you return in this style.\n\n${style}\n\n${sharedRules()}`)
}

function userPromptSubmit() {
	const layer = readPersonalLayer() ?? ''
	const chat = layer.match(/^- Chat language: *(.+?) *$/m)?.[1]
	const artefact = layer.match(/^- Artefact language: *(.+?) *$/m)?.[1]
	if (!chat || !artefact || chat.toLowerCase() === artefact.toLowerCase()) return
	respond('UserPromptSubmit', `Reply to the user in ${chat}; artefacts stay ${artefact}.`)
}

/** @type {Record<string, () => void>} */
const HANDLERS = {
	SessionStart: sessionStart,
	SubagentStart: subagentStart,
	UserPromptSubmit: userPromptSubmit,
}

try {
	const payload = JSON.parse(readFileSync(0, 'utf8') || '{}')
	HANDLERS[payload.hook_event_name]?.()
} catch {
	// A bad payload gets no context, never a blocked session.
}
process.exit(0)
