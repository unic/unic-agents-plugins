#!/usr/bin/env node
// @ts-check
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const ROOT = 'docs/issues'
const STATE_FILE = 'docs/migration-state.json'
const PLAN_FILE = 'docs/migration-plan.md'

/** @type {Record<string, string>} */
const STATE_LABEL = {
	'needs-triage': 'needs-triage',
	'needs-info': 'needs-info',
	'needs-specs': 'needs-specs',
	'ready-for-agent': 'ready-for-agent',
	'ready-for-human': 'ready-for-human',
	resolved: 'resolved',
	closed: 'closed',
	rejected: 'rejected',
}

/** @type {Record<string, string>} */
const CATEGORY_LABEL = {
	enhancement: 'enhancement',
	feature: 'feature',
	bug: 'bug',
	refactor: 'refactor',
	release: 'release',
	documentation: 'documentation',
	docs: 'documentation',
}

const CATEGORIES_TO_CREATE = [
	{ name: 'feature', color: 'c2e0c6', description: 'New capability' },
	{ name: 'refactor', color: 'd4c5f9', description: 'Internal restructuring; no behaviour change' },
	{ name: 'release', color: 'ededed', description: 'Version bump / release housekeeping' },
]
const FEATURE_LABEL_COLOR = 'c5def5'
const CLOSED_STATES = new Set(['closed', 'resolved', 'rejected'])

/** @param {string[]} args */
function gh(args) {
	return execFileSync('gh', args, { encoding: 'utf8' })
}

/** @param {string[]} args */
function ghTry(args) {
	try {
		return { ok: true, out: gh(args), err: '' }
	} catch (e) {
		const err = /** @type {{stderr?: Buffer | string, message: string}} */ (e)
		const stderr = typeof err.stderr === 'string' ? err.stderr : (err.stderr?.toString('utf8') ?? err.message)
		return { ok: false, out: '', err: stderr }
	}
}

/** @param {string} file */
function gitCreationDate(file) {
	try {
		const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file], {
			encoding: 'utf8',
		})
		const lines = out.trim().split('\n').filter(Boolean)
		return lines.at(-1) ?? ''
	} catch {
		return ''
	}
}

/** @param {string} file @returns {string[]} */
function commitsTouchingFile(file) {
	try {
		const out = execFileSync('git', ['log', '--follow', '--format=%H', '--', file], { encoding: 'utf8' })
		return out.trim().split('\n').filter(Boolean)
	} catch {
		return []
	}
}

/** @type {Map<string, number[]>} */
const prsByCommitCache = new Map()

/** @param {string} sha @returns {number[]} */
function mergedPrsForCommit(sha) {
	if (prsByCommitCache.has(sha)) return /** @type {number[]} */ (prsByCommitCache.get(sha))
	const r = ghTry([
		'api',
		`repos/unic/unic-agents-plugins/commits/${sha}/pulls`,
		'--jq',
		'.[] | select(.merged_at != null) | .number',
	])
	const nums = r.ok ? r.out.trim().split('\n').filter(Boolean).map(Number) : []
	prsByCommitCache.set(sha, nums)
	return nums
}

/** @param {string} file @returns {number[]} sorted unique PR numbers that touched the file (merged only) */
function mergedPrsForFile(file) {
	const shas = commitsTouchingFile(file)
	const set = new Set()
	for (const sha of shas) for (const n of mergedPrsForCommit(sha)) set.add(n)
	return [...set]
		.sort((a, b) => /** @type {number} */ (a) - /** @type {number} */ (b))
		.map((n) => /** @type {number} */ (n))
}

/** @param {string} file */
function parseIssue(file) {
	const content = readFileSync(file, 'utf8')
	const title = content.match(/^# (.+)$/m)?.[1]?.trim() ?? basename(file, '.md')
	const status = content.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim() ?? ''
	const category = content.match(/^\*\*Category:\*\*\s*(.+)$/m)?.[1]?.trim() ?? ''
	const blockedSection = content.match(/##\s+Blocked by\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/)
	const blockedBy = blockedSection ? [...blockedSection[1].matchAll(/`([^`]+\.md)`/g)].map((m) => m[1]) : []
	return { title, status, category, blockedBy, content }
}

function collect() {
	/** @type {Array<{slug:string,filename:string,path:string,title:string,status:string,category:string,blockedBy:string[],date:string,content:string,position:number,blockedByPositions:(number|null)[]}>} */
	const items = []
	for (const slug of readdirSync(ROOT)) {
		const dir = join(ROOT, slug)
		if (!statSync(dir).isDirectory()) continue
		for (const f of readdirSync(dir)) {
			if (!/^\d+.*\.md$/.test(f)) continue
			const path = join(dir, f)
			const parsed = parseIssue(path)
			items.push({
				slug,
				filename: f,
				path,
				...parsed,
				date: gitCreationDate(path),
				position: 0,
				blockedByPositions: [],
			})
		}
	}
	items.sort((a, b) => {
		if (a.date !== b.date) return a.date < b.date ? -1 : 1
		if (a.slug !== b.slug) return a.slug < b.slug ? -1 : 1
		return a.filename < b.filename ? -1 : 1
	})
	items.forEach((it, i) => {
		it.position = i + 1
	})
	const byKey = new Map()
	for (const it of items) {
		byKey.set(it.path, it.position)
		byKey.set(`${it.slug}/${it.filename}`, it.position)
		byKey.set(it.filename, it.position)
	}
	for (const it of items) {
		it.blockedByPositions = it.blockedBy.map((ref) => {
			const norm = ref.replace(/^docs\/issues\//, '')
			return (
				byKey.get(ref) ??
				byKey.get(norm) ??
				byKey.get(`${it.slug}/${basename(ref)}`) ??
				byKey.get(basename(ref)) ??
				null
			)
		})
	}
	return items
}

function plan() {
	const items = collect()
	const slugs = [...new Set(items.map((i) => i.slug))].sort()
	const stateCounts = /** @type {Record<string,number>} */ ({})
	const categoryLabelCounts = /** @type {Record<string,number>} */ ({})
	for (const it of items) {
		stateCounts[it.status] = (stateCounts[it.status] ?? 0) + 1
		const label = CATEGORY_LABEL[it.category] ?? `❓${it.category}`
		categoryLabelCounts[label] = (categoryLabelCounts[label] ?? 0) + 1
	}

	let md = '# Migration plan: docs/issues/ → GitHub Issues\n\n'
	md += `**Total issues to create:** ${items.length}\n`
	md += `**Features:** ${slugs.length}\n`
	md += `**Will be closed after creation:** ${items.filter((i) => CLOSED_STATES.has(i.status)).length}\n\n`

	md += '## Order (oldest file first → GitHub issue # ascending)\n\n'
	md += '| # | Date | Slug | File | Title | Status → label | Category → label | Blocked by |\n'
	md += '|---|------|------|------|-------|----------------|------------------|------------|\n'
	for (const it of items) {
		const stateLabel = STATE_LABEL[it.status] ?? `❓${it.status}`
		const catLabel = CATEGORY_LABEL[it.category] ?? `❓${it.category}`
		const blocked = it.blockedByPositions.length
			? it.blockedByPositions.map((p, i) => (p ? `#${p}` : `❓\`${it.blockedBy[i]}\``)).join(', ')
			: '—'
		const title = it.title.replace(/\|/g, '\\|')
		md += `| ${it.position} | ${it.date.slice(0, 10)} | \`${it.slug}\` | \`${it.filename}\` | ${title} | \`${stateLabel}\` | \`${catLabel}\` | ${blocked} |\n`
	}

	md += '\n## Labels — required state\n\n'
	md += '### State labels (already seeded)\n\n'
	for (const [s, c] of Object.entries(stateCounts).sort()) {
		md += `- \`${STATE_LABEL[s] ?? `❓${s}`}\` — ${c} issues\n`
	}
	md += '\n### Category labels (some need creating)\n\n'
	for (const [label, n] of Object.entries(categoryLabelCounts).sort()) {
		md += `- \`${label}\` — ${n} issues\n`
	}
	md += '\n### Per-feature labels to create (one per slug)\n\n'
	for (const s of slugs) md += `- \`feature/${s}\`\n`

	writeFileSync(PLAN_FILE, md)
	console.log(`Plan written: ${PLAN_FILE} (${items.length} issues)`)
}

/**
 * @param {{path:string,filename:string,slug:string,content:string,title:string,blockedBy:string[],blockedByPositions:(number|null)[]}} item
 * @param {Record<string,number>} resolvedNumbers map of source key → real github issue number (used in backfill pass)
 */
function buildBody(item, resolvedNumbers) {
	let body = item.content
		.replace(/^# .+\n+/, '') // remove H1 (will be the issue title)
		.replace(/^\*\*Status:\*\*\s*.+$/m, '')
		.replace(/^\*\*Category:\*\*\s*.+$/m, '')
		.replace(/^\n{3,}/gm, '\n\n')
		.trim()

	if (item.blockedBy.length && Object.keys(resolvedNumbers).length) {
		for (const ref of item.blockedBy) {
			const norm = ref.replace(/^docs\/issues\//, '')
			const num =
				resolvedNumbers[ref] ??
				resolvedNumbers[norm] ??
				resolvedNumbers[`${item.slug}/${basename(ref)}`] ??
				resolvedNumbers[basename(ref)]
			if (num) {
				const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				body = body.replace(new RegExp(`\`${escaped}\``, 'g'), `#${num}`)
			}
		}
	}

	const prs = mergedPrsForFile(item.path)
	const prLine = prs.length ? `**Touched by PRs:** ${prs.map((n) => `#${n}`).join(', ')}` : null

	const footer = [
		'',
		'---',
		`**PRD:** [\`docs/issues/${item.slug}/PRD.md\`](docs/issues/${item.slug}/PRD.md)`,
		`**Migrated from:** \`docs/issues/${item.slug}/${item.filename}\` (source removed after migration)`,
		...(prLine ? [prLine] : []),
	].join('\n')
	return `${body}\n${footer}\n`
}

/** @returns {{labelsCreated:boolean,issuesCreated:Record<string,number>,backfilled:string[],closed:string[],deleted:string[]}} */
function loadState() {
	if (!existsSync(STATE_FILE))
		return { labelsCreated: false, issuesCreated: {}, backfilled: [], closed: [], deleted: [] }
	return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}

/** @param {ReturnType<typeof loadState>} state */
function saveState(state) {
	writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
}

/** @param {ReturnType<typeof loadState>} state */
function createLabels(state) {
	if (state.labelsCreated) {
		console.log('Labels: already done, skipping')
		return
	}
	console.log('Phase 1: creating labels')
	const existing = new Set(
		gh(['label', 'list', '--limit', '200', '--json', 'name']).trim()
			? JSON.parse(gh(['label', 'list', '--limit', '200', '--json', 'name'])).map(
					(/** @type {{name:string}} */ l) => l.name
				)
			: []
	)

	for (const c of CATEGORIES_TO_CREATE) {
		if (existing.has(c.name)) {
			console.log(`  ⊙ ${c.name} (exists)`)
			continue
		}
		const r = ghTry(['label', 'create', c.name, '--color', c.color, '--description', c.description])
		console.log(`  ${r.ok ? '✓' : '✗'} ${c.name}${r.ok ? '' : ` — ${r.err.trim().split('\n')[0]}`}`)
	}

	const items = collect()
	const slugs = [...new Set(items.map((i) => i.slug))].sort()
	for (const slug of slugs) {
		const name = `feature/${slug}`
		if (existing.has(name)) {
			console.log(`  ⊙ ${name} (exists)`)
			continue
		}
		const r = ghTry([
			'label',
			'create',
			name,
			'--color',
			FEATURE_LABEL_COLOR,
			'--description',
			`Issues from the ${slug} feature`,
		])
		console.log(`  ${r.ok ? '✓' : '✗'} ${name}${r.ok ? '' : ` — ${r.err.trim().split('\n')[0]}`}`)
	}
	state.labelsCreated = true
	saveState(state)
}

/** @param {ReturnType<typeof loadState>} state */
function createIssues(state) {
	console.log('\nPhase 2: creating issues (oldest first)')
	const items = collect()
	const tmpBody = join(tmpdir(), `migration-body-${process.pid}.md`)

	for (const it of items) {
		if (state.issuesCreated[it.path]) {
			console.log(`  ⊙ [${it.position}/${items.length}] ${it.path} → #${state.issuesCreated[it.path]} (exists)`)
			continue
		}

		// pass 1 body: no blocker resolution yet
		writeFileSync(tmpBody, buildBody(it, {}))

		const title = `[${it.slug}] ${it.title}`
		const stateLabel = STATE_LABEL[it.status]
		const catLabel = CATEGORY_LABEL[it.category]
		const featureLabel = `feature/${it.slug}`
		const labels = [stateLabel, catLabel, featureLabel].filter(Boolean).join(',')

		const r = ghTry(['issue', 'create', '--title', title, '--body-file', tmpBody, '--label', labels])
		if (!r.ok) {
			console.error(
				`  ✗ [${it.position}/${items.length}] ${it.path}: ${r.err.trim().split('\n').slice(0, 3).join(' | ')}`
			)
			throw new Error(`Issue creation failed at ${it.path}`)
		}
		const m = r.out.match(/\/issues\/(\d+)/)
		const num = m ? Number(m[1]) : null
		if (!num) {
			console.error(
				`  ✗ [${it.position}/${items.length}] ${it.path}: could not parse issue number from output: ${r.out.trim()}`
			)
			throw new Error('Could not parse issue number')
		}
		state.issuesCreated[it.path] = num
		saveState(state)
		console.log(`  ✓ [${it.position}/${items.length}] ${it.slug}/${it.filename} → #${num}`)
	}

	if (existsSync(tmpBody)) unlinkSync(tmpBody)
}

/** @param {ReturnType<typeof loadState>} state */
function backfillBlockers(state) {
	console.log('\nPhase 3: backfilling blocked-by refs')
	const items = collect()
	const resolved = /** @type {Record<string, number>} */ ({})
	for (const it of items) {
		const n = state.issuesCreated[it.path]
		if (!n) continue
		resolved[it.path] = n
		resolved[`${it.slug}/${it.filename}`] = n
		resolved[it.filename] = n
	}
	const tmpBody = join(tmpdir(), `migration-body-bf-${process.pid}.md`)

	for (const it of items) {
		if (!it.blockedBy.length) continue
		if (state.backfilled.includes(it.path)) continue
		const num = state.issuesCreated[it.path]
		if (!num) continue
		writeFileSync(tmpBody, buildBody(it, resolved))
		const r = ghTry(['issue', 'edit', String(num), '--body-file', tmpBody])
		if (!r.ok) {
			console.error(`  ✗ #${num} (${it.filename}): ${r.err.trim().split('\n')[0]}`)
			throw new Error(`Backfill failed at #${num}`)
		}
		state.backfilled.push(it.path)
		saveState(state)
		console.log(`  ✓ #${num} (${it.slug}/${it.filename}): refs → ${it.blockedByPositions.length} blocker(s)`)
	}
	if (existsSync(tmpBody)) unlinkSync(tmpBody)
}

/** @param {ReturnType<typeof loadState>} state */
function closeIssues(state) {
	console.log('\nPhase 4: closing finished issues')
	const items = collect()
	for (const it of items) {
		if (!CLOSED_STATES.has(it.status)) continue
		if (state.closed.includes(it.path)) continue
		const num = state.issuesCreated[it.path]
		if (!num) continue
		const r = ghTry(['issue', 'close', String(num)])
		if (!r.ok) {
			console.error(`  ✗ #${num}: ${r.err.trim().split('\n')[0]}`)
			throw new Error(`Close failed at #${num}`)
		}
		state.closed.push(it.path)
		saveState(state)
		console.log(`  ✓ #${num} closed (${it.status})`)
	}
}

/** @param {ReturnType<typeof loadState>} state */
function deleteFiles(state) {
	console.log('\nPhase 5: deleting migrated NN-*.md files')
	const items = collect()
	for (const it of items) {
		if (!state.issuesCreated[it.path]) continue
		if (state.deleted.includes(it.path)) continue
		if (existsSync(it.path)) {
			unlinkSync(it.path)
			console.log(`  ✓ removed ${it.path}`)
		}
		state.deleted.push(it.path)
		saveState(state)
	}
}

function execute() {
	const state = loadState()
	createLabels(state)
	createIssues(state)
	backfillBlockers(state)
	closeIssues(state)
	deleteFiles(state)
	console.log('\nMigration complete.')
	console.log(`State: ${STATE_FILE} (kept as audit trail; you can delete it after verifying GitHub).`)
}

const mode = process.argv[2] ?? 'plan'
if (mode === 'plan') plan()
else if (mode === 'execute') execute()
else {
	console.error(`Unknown mode: ${mode}. Use 'plan' or 'execute'.`)
	process.exit(1)
}
