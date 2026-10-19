// @ts-check

// Writes the Personal layer into `~/.claude/CLAUDE.md` (or `$CLAUDE_CONFIG_DIR/CLAUDE.md`).
// The block body arrives on stdin. A run replaces the block between the
// terse-orwell markers and keeps every byte outside them. With no block yet, it
// appends one. `/terse-orwell:setup` is the only caller.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const START_MARKER = '<!-- >>> terse-orwell >>> -->'
const END_MARKER = '<!-- <<< terse-orwell <<< -->'

const path = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'CLAUDE.md')
const body = readFileSync(0, 'utf8').trim()
if (!body) {
	process.stderr.write('terse-orwell: empty Personal layer on stdin, nothing written.\n')
	process.exit(1)
}

let text = ''
try {
	text = readFileSync(path, 'utf8')
} catch {
	// No CLAUDE.md yet: the block becomes the whole file.
}

const block = `${START_MARKER}\n${body}\n${END_MARKER}`
const start = text.indexOf(START_MARKER)
const end = text.indexOf(END_MARKER)
let next
if (start !== -1 && end > start) {
	next = text.slice(0, start) + block + text.slice(end + END_MARKER.length)
} else if (start !== -1 || end !== -1) {
	process.stderr.write(
		`terse-orwell: ${path} holds one terse-orwell marker without its pair. Fix it by hand, then rerun.\n`
	)
	process.exit(1)
} else {
	next = text ? `${text.replace(/\s*$/, '')}\n\n${block}\n` : `${block}\n`
}

mkdirSync(dirname(path), { recursive: true })
writeFileSync(path, next)
process.stdout.write(`terse-orwell: wrote the Personal layer to ${path}\n`)
