// @ts-check

/**
 * Pure-function CLI inventory check.
 *
 * Scans source-file contents for `az` invocations and returns the ones not
 * registered in the inventory and not exempted by the allowlist. Knows nothing
 * about the filesystem — callers pass file contents in.
 */

/**
 * @typedef {{ path: string, content: string }} Source
 *
 * @typedef {{ kind: 'invoke', area: string, resource: string, command: string[], helpKeywordsRequired: string[] }} InvokeEntry
 * @typedef {{ kind: 'repos' | 'boards', command: string[], helpKeywordsRequired: string[] }} SubcommandEntry
 * @typedef {InvokeEntry | SubcommandEntry} InventoryEntry
 */

/**
 * Find every `az` command in `sources` that is neither in `inventory` nor
 * exempted by `allowlist`. Each returned entry reads
 * `"<command-shape> (<source-path>)"` so test failures point at the offending file.
 *
 * @param {{ sources: Source[], inventory: InventoryEntry[], allowlist: RegExp[] }} args
 * @returns {string[]}
 */
export function findUninventoriedCommands({ sources, inventory, allowlist }) {
	const out = []
	for (const { path, content } of sources) {
		for (const shape of extractAzShapes(content)) {
			if (matchesInventory(shape, inventory)) continue
			if (matchesAllowlist(shape, allowlist)) continue
			out.push(`${shape} (${path})`)
		}
	}
	return out
}

/**
 * Extract the normalized shape string for every `az` invocation in a source.
 *
 * Shape strings:
 * - `az repos pr show` (leading non-flag tokens)
 * - `az devops invoke --area git --resource pullRequestThreads` (invoke + area/resource flags)
 *
 * @param {string} content
 * @returns {string[]}
 */
function extractAzShapes(content) {
	const shapes = []
	const text = content.replace(/\r\n/g, '\n')
	// Delimiter class deliberately omits ` ' " — markdown inline code (`az ...`),
	// JS string literals ("az ..."), and prose quotes ('az ...') wrap references,
	// not real invocations. Real shell uses whitespace, $( ... ), &&, |, etc.
	const matches = text.matchAll(/(^|[\s(&|])az\s/g)
	for (const match of matches) {
		const start = (match.index ?? 0) + match[1].length
		if (insideShellCommentOrString(text, start)) continue
		const tokens = tokenize(text, start)
		if (tokens.length === 0) continue
		const head = leadingNonFlagTokens(tokens)
		if (head.length < 2) {
			// Root-flag forms like `az --version` — emit `az <first-flag>` so the
			// allowlist / inventory check still covers them.
			const firstFlag = tokens.find((t) => t.startsWith('--'))
			if (firstFlag) shapes.push(`az ${firstFlag}`)
			continue
		}
		const shape = head[1] === 'devops' && head[2] === 'invoke' ? withAreaResource(tokens, head) : head.join(' ')
		shapes.push(shape)
	}
	return shapes
}

/**
 * Return true when `position` falls inside a shell comment, a markdown inline
 * code span (`` `...` ``), or a quoted string (single or double) on the same line.
 *
 * Shell comments: a `#` preceded by start-of-line or whitespace before `position`.
 * Quoted strings / inline code: an odd count of the matching quote / backtick char
 * between the previous newline and `position`.
 *
 * @param {string} text
 * @param {number} position
 * @returns {boolean}
 */
function insideShellCommentOrString(text, position) {
	const lineStart = text.lastIndexOf('\n', position - 1) + 1
	const before = text.slice(lineStart, position)
	if (/(^|\s)#/.test(before)) return true
	for (const delim of ['"', "'", '`']) {
		let count = 0
		for (const ch of before) if (ch === delim) count++
		if (count % 2 === 1) return true
	}
	return false
}

/**
 * Read tokens starting at `start`, honouring shell backslash-newline continuations.
 *
 * @param {string} text
 * @param {number} start
 * @returns {string[]}
 */
function tokenize(text, start) {
	let i = start
	let buf = ''
	while (i < text.length) {
		const ch = text[i]
		if (ch === '\\' && text[i + 1] === '\n') {
			i += 2
			buf += ' '
			continue
		}
		if (ch === '\n' || ch === ';' || ch === '|') break
		buf += ch
		i++
	}
	return buf.split(/\s+/).filter(Boolean)
}

/**
 * Take leading tokens until we hit a `-flag` or value position.
 *
 * @param {string[]} tokens
 * @returns {string[]}
 */
function leadingNonFlagTokens(tokens) {
	const head = []
	for (const t of tokens) {
		if (t.startsWith('-')) break
		head.push(t)
	}
	return head
}

/**
 * For `az devops invoke`, capture `--area X --resource Y` so the shape uniquely
 * identifies the API endpoint. Missing values are surfaced as `<missing>`.
 *
 * @param {string[]} tokens
 * @param {string[]} head
 * @returns {string}
 */
function withAreaResource(tokens, head) {
	const area = valueFor(tokens, '--area') ?? '<missing>'
	const resource = valueFor(tokens, '--resource') ?? '<missing>'
	return `${head.join(' ')} --area ${area} --resource ${resource}`
}

/**
 * @param {string[]} tokens
 * @param {string} flag
 * @returns {string | undefined}
 */
function valueFor(tokens, flag) {
	const idx = tokens.indexOf(flag)
	if (idx === -1 || idx === tokens.length - 1) return undefined
	const next = tokens[idx + 1]
	return next.startsWith('-') ? undefined : next
}

/**
 * @param {string} shape
 * @param {InventoryEntry[]} inventory
 * @returns {boolean}
 */
function matchesInventory(shape, inventory) {
	for (const entry of inventory) {
		if (entry.kind === 'invoke') {
			if (shape === `${entry.command.join(' ')} --area ${entry.area} --resource ${entry.resource}`) return true
		} else if (shape === entry.command.join(' ')) {
			return true
		}
	}
	return false
}

/**
 * @param {string} shape
 * @param {RegExp[]} allowlist
 * @returns {boolean}
 */
function matchesAllowlist(shape, allowlist) {
	return allowlist.some((re) => re.test(shape))
}
