// @ts-check

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   acceptanceCriteria: string[],
 *   dependsOn: string[],
 *   status: 'pending',
 * }} Story
 */

/**
 * Parses one issue markdown file into a prd.json story.
 *
 * @param {string} content
 * @param {string} filename - e.g. '01-plugin-scaffold.md'
 * @returns {Story}
 */
export function parseIssueMarkdown(content, filename) {
	const normalized = content.replace(/\r\n/g, '\n')
	const id = filenameToId(filename)
	const title = extractTitle(normalized)
	const description = extractSection(normalized, 'What to build')
	const acceptanceCriteria = parseCheckboxList(extractSection(normalized, 'Acceptance criteria'))
	const dependsOn = parseBlockedBy(extractSection(normalized, 'Blocked by'))
	return {
		id,
		title,
		description,
		acceptanceCriteria,
		dependsOn,
		status: 'pending',
	}
}

/**
 * @param {string} filename
 * @returns {string}
 */
function filenameToId(filename) {
	const match = filename.match(/^(\d{2})-/)
	if (!match) throw new Error(`filename does not match NN-slug.md: ${filename}`)
	return `US-${match[1].padStart(3, '0')}`
}

/**
 * Parses the Blocked by section. Returns story IDs derived from referenced filenames.
 * The literal text "None" (case-insensitive) yields an empty array.
 *
 * @param {string} body
 * @returns {string[]}
 */
function parseBlockedBy(body) {
	if (/^\s*none\b/i.test(body)) return []
	const ids = []
	const re = /(\d{2})-[\w-]+\.md/g
	for (const match of body.matchAll(re)) {
		ids.push(`US-${match[1].padStart(3, '0')}`)
	}
	return ids
}

/**
 * Extracts each `- [ ] <text>` line into an array entry, stripping the prefix.
 *
 * @param {string} body
 * @returns {string[]}
 */
function parseCheckboxList(body) {
	const items = []
	for (const line of body.split('\n')) {
		const match = line.match(/^\s*-\s+\[[ xX]\]\s+(.*\S)\s*$/)
		if (match) items.push(match[1])
	}
	return items
}

/**
 * Returns the body of a `## <heading>` section, trimmed, up to the next H2 or EOF.
 * Returns an empty string if the section is missing.
 *
 * @param {string} content
 * @param {string} heading
 * @returns {string}
 */
function extractSection(content, heading) {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const startRe = new RegExp(`^##\\s+${escaped}\\s*$`, 'm')
	const start = content.match(startRe)
	if (!start || start.index === undefined) return ''
	const after = content.slice(start.index + start[0].length)
	const next = after.match(/^##\s+/m)
	const body = next && next.index !== undefined ? after.slice(0, next.index) : after
	return body.trim()
}

/**
 * @param {string} content
 * @returns {string}
 */
function extractTitle(content) {
	const match = content.match(/^#\s+(.+?)\s*$/m)
	if (!match) throw new Error('no H1 title found')
	return match[1].trim()
}

/**
 * Converts a list of {filename, content} into a prd.json structure.
 *
 * @param {Array<{filename: string, content: string}>} files
 * @returns {{ stories: Story[] }}
 */
export function convertIssuesToPrd(files) {
	const stories = files.map(({ content, filename }) => parseIssueMarkdown(content, filename))
	stories.sort((a, b) => a.id.localeCompare(b.id))
	return { stories }
}
