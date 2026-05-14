// @ts-check
import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import { convertIssuesToPrd, parseIssueMarkdown } from './issues-to-prd-json.mjs'

test('parseIssueMarkdown extracts title from first H1 and id from filename', () => {
	const md = '# Plugin scaffold and tracer install hook\n\n**Status:** ready-for-agent\n'
	const story = parseIssueMarkdown(md, '01-plugin-scaffold-and-tracer-install.md')
	strictEqual(story.id, 'US-001')
	strictEqual(story.title, 'Plugin scaffold and tracer install hook')
})

test('parseIssueMarkdown extracts Acceptance criteria checkboxes, stripping `- [ ]` prefix', () => {
	const md = [
		'# Title',
		'',
		'## What to build',
		'',
		'whatever',
		'',
		'## Acceptance criteria',
		'',
		'- [ ] First criterion.',
		'- [ ] Second criterion with `code` and markdown.',
		'- [ ] Third criterion.',
		'',
		'## Blocked by',
		'',
		'None — can start immediately.',
	].join('\n')
	const story = parseIssueMarkdown(md, '03-foo.md')
	deepStrictEqual(story.acceptanceCriteria, [
		'First criterion.',
		'Second criterion with `code` and markdown.',
		'Third criterion.',
	])
})

test('convertIssuesToPrd returns {stories: [...]} sorted by id ascending', () => {
	const minimal = (title) =>
		[
			`# ${title}`,
			'',
			'## What to build',
			'',
			'x',
			'',
			'## Acceptance criteria',
			'',
			'- [ ] x',
			'',
			'## Blocked by',
			'',
			'None — can start immediately.',
		].join('\n')
	const prd = convertIssuesToPrd([
		{ filename: '03-third.md', content: minimal('Third') },
		{ filename: '01-first.md', content: minimal('First') },
		{ filename: '02-second.md', content: minimal('Second') },
	])
	deepStrictEqual(
		prd.stories.map((s) => s.id),
		['US-001', 'US-002', 'US-003'],
	)
	strictEqual(prd.stories[0].status, 'pending')
})

test('parseIssueMarkdown maps Blocked by paths to dependsOn US-NNN entries (in source order)', () => {
	const md = [
		'# Title',
		'',
		'## What to build',
		'',
		'x',
		'',
		'## Acceptance criteria',
		'',
		'- [ ] x',
		'',
		'## Blocked by',
		'',
		'- `docs/issues/unic-archon-dlc/12-qa-workflow.md`',
		'- `docs/issues/unic-archon-dlc/03-triage-workflow-and-tracker-adapter.md`',
	].join('\n')
	const story = parseIssueMarkdown(md, '13-cleanup-workflow.md')
	deepStrictEqual(story.dependsOn, ['US-012', 'US-003'])
})

test('parseIssueMarkdown treats "None" in Blocked by as empty dependsOn', () => {
	const md = [
		'# Title',
		'',
		'## What to build',
		'',
		'x',
		'',
		'## Acceptance criteria',
		'',
		'- [ ] x',
		'',
		'## Blocked by',
		'',
		'None — can start immediately.',
	].join('\n')
	const story = parseIssueMarkdown(md, '01-foo.md')
	deepStrictEqual(story.dependsOn, [])
})

test('parseIssueMarkdown extracts the What to build section as description, including subsections', () => {
	const md = [
		'# Title here',
		'',
		'## Parent',
		'',
		'`docs/issues/foo/PRD.md`',
		'',
		'## What to build',
		'',
		'Top paragraph explaining the slice.',
		'',
		'In scope:',
		'',
		'- Item one',
		'- Item two',
		'',
		'Out of scope: irrelevant things.',
		'',
		'## Acceptance criteria',
		'',
		'- [ ] Something',
		'',
		'## Blocked by',
		'',
		'None — can start immediately.',
		'',
	].join('\n')
	const story = parseIssueMarkdown(md, '02-foo.md')
	strictEqual(
		story.description,
		[
			'Top paragraph explaining the slice.',
			'',
			'In scope:',
			'',
			'- Item one',
			'- Item two',
			'',
			'Out of scope: irrelevant things.',
		].join('\n'),
	)
})
