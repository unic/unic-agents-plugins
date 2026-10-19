// @ts-check

// Writes the Personal layer into `~/.claude/CLAUDE.md` (or `$CLAUDE_CONFIG_DIR/CLAUDE.md`).
// The block body comes from the file named by the first argument, so the caller
// needs no shell syntax. A run replaces the block between the terse-orwell
// markers and keeps every byte outside them. With no block yet, it appends one.
// `/terse-orwell:setup` is the only caller.

import { readFileSync, writeFileSync } from 'node:fs'

import { CLAUDE_MD, END_MARKER, findMarkers, START_MARKER } from './personal-layer.mjs'

const source = process.argv[2]
if (!source) {
	process.stderr.write('terse-orwell: usage: write-layer.mjs <file with the Personal layer>\n')
	process.exit(1)
}
const body = readFileSync(source, 'utf8').trim()
if (!body) {
	process.stderr.write(`terse-orwell: ${source} is empty, nothing written.\n`)
	process.exit(1)
}

let text = ''
try {
	text = readFileSync(CLAUDE_MD, 'utf8')
} catch {
	// No CLAUDE.md yet: the block becomes the whole file.
}

const block = `${START_MARKER}\n${body}\n${END_MARKER}`
const { start, end } = findMarkers(text)
let next
if (start !== -1 && end > start) {
	next = text.slice(0, start) + block + text.slice(end + END_MARKER.length)
} else if (start !== -1 || end !== -1) {
	process.stderr.write(
		`terse-orwell: ${CLAUDE_MD} holds one terse-orwell marker without its pair. Fix it by hand, then rerun.\n`
	)
	process.exit(1)
} else if (text) {
	next = `${text}${text.endsWith('\n') ? '\n' : '\n\n'}${block}\n`
} else {
	next = `${block}\n`
}

writeFileSync(CLAUDE_MD, next)
process.stdout.write(`terse-orwell: wrote the Personal layer to ${CLAUDE_MD}\n`)
