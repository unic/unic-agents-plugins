// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildPrePrContext, parseChangedFilesFromDiff, shouldSkipFile } from '../scripts/pre-pr.mjs'

/** Reads the review-pr command for content assertions */
const commandContent = readFileSync(new URL('../commands/review-pr.md', import.meta.url), 'utf8')

// ---------------------------------------------------------------------------
// parseChangedFilesFromDiff
// ---------------------------------------------------------------------------

describe('parseChangedFilesFromDiff', () => {
	it('empty diff → returns empty array', () => {
		assert.deepEqual(parseChangedFilesFromDiff(''), [])
	})

	it('single changed file → returns one path with leading slash', () => {
		const diff = `diff --git a/src/api.ts b/src/api.ts
index 1234567..abcdefg 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,3 +1,4 @@
 unchanged
+added line
`
		const result = parseChangedFilesFromDiff(diff)
		assert.deepEqual(result, ['/src/api.ts'])
	})

	it('multiple changed files → returns all paths', () => {
		const diff = `diff --git a/src/api.ts b/src/api.ts
index 1234567..abcdefg 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,1 +1,2 @@
+added
diff --git a/tests/api.test.ts b/tests/api.test.ts
index 1111111..2222222 100644
--- a/tests/api.test.ts
+++ b/tests/api.test.ts
@@ -1,1 +1,2 @@
+test added
`
		const result = parseChangedFilesFromDiff(diff)
		assert.deepEqual(result, ['/src/api.ts', '/tests/api.test.ts'])
	})

	it('renamed file uses b/ path (new name)', () => {
		const diff = `diff --git a/old/name.ts b/new/name.ts
similarity index 90%
rename from old/name.ts
rename to new/name.ts
`
		const result = parseChangedFilesFromDiff(diff)
		assert.deepEqual(result, ['/new/name.ts'])
	})

	it('deduplicates identical paths from multiple hunks', () => {
		const diff = `diff --git a/src/index.ts b/src/index.ts
index 111..222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
+first hunk
diff --git a/src/index.ts b/src/index.ts
@@ -10,2 +11,3 @@
+second hunk
`
		const result = parseChangedFilesFromDiff(diff)
		assert.deepEqual(result, ['/src/index.ts'])
	})

	it('nested directory paths preserved', () => {
		const diff = `diff --git a/a/b/c/deep.ts b/a/b/c/deep.ts
index 000..111 100644
`
		const result = parseChangedFilesFromDiff(diff)
		assert.deepEqual(result, ['/a/b/c/deep.ts'])
	})
})

// ---------------------------------------------------------------------------
// shouldSkipFile
// ---------------------------------------------------------------------------

describe('shouldSkipFile', () => {
	it('non-generated .ts file → false (keep)', () => {
		assert.equal(shouldSkipFile('/src/api.ts'), false)
	})

	it('*.g.cs file → true (skip)', () => {
		assert.equal(shouldSkipFile('/Generated/Models/UserModel.g.cs'), true)
	})

	it('swagger.md → true (skip)', () => {
		assert.equal(shouldSkipFile('/docs/swagger.md'), true)
	})

	it('swagger.json → true (skip)', () => {
		assert.equal(shouldSkipFile('/api/swagger.json'), true)
	})

	it('serialization YAML ending in .serialization.yaml → true (skip)', () => {
		assert.equal(shouldSkipFile('/config/types.serialization.yaml'), true)
	})

	it('regular .yaml file → false (keep)', () => {
		assert.equal(shouldSkipFile('/config/pipeline.yaml'), false)
	})

	it('regular .yml file → false (keep)', () => {
		assert.equal(shouldSkipFile('/config/ci.yml'), false)
	})

	it('file named generated-types.ts → true (skip)', () => {
		assert.equal(shouldSkipFile('/src/generated-types.ts'), true)
	})

	it('file under a generated/ directory → true (skip)', () => {
		assert.equal(shouldSkipFile('/src/generated/api-client.ts'), true)
	})

	it('normal source file with no skip pattern → false (keep)', () => {
		assert.equal(shouldSkipFile('/src/services/user.service.ts'), false)
	})
})

// ---------------------------------------------------------------------------
// buildPrePrContext
// ---------------------------------------------------------------------------

describe('buildPrePrContext', () => {
	it('returns rawDiff unchanged', () => {
		const diff = `diff --git a/src/foo.ts b/src/foo.ts\nindex 000..111 100644\n`
		const ctx = buildPrePrContext(diff)
		assert.equal(ctx.rawDiff, diff)
	})

	it('changedFiles contains all parsed paths', () => {
		const diff = `diff --git a/src/foo.ts b/src/foo.ts\nindex 000..111 100644\n`
		const ctx = buildPrePrContext(diff)
		assert.deepEqual(ctx.changedFiles, ['/src/foo.ts'])
	})

	it('filteredFiles excludes skipped files', () => {
		const diff = [
			'diff --git a/src/api.ts b/src/api.ts',
			'index 000..111 100644',
			'diff --git a/Generated/Foo.g.cs b/Generated/Foo.g.cs',
			'index 222..333 100644',
		].join('\n')
		const ctx = buildPrePrContext(diff)
		assert.deepEqual(ctx.changedFiles, ['/src/api.ts', '/Generated/Foo.g.cs'])
		assert.deepEqual(ctx.filteredFiles, ['/src/api.ts'])
	})

	it('empty diff → all arrays empty', () => {
		const ctx = buildPrePrContext('')
		assert.deepEqual(ctx.changedFiles, [])
		assert.deepEqual(ctx.filteredFiles, [])
		assert.equal(ctx.rawDiff, '')
	})
})

// ---------------------------------------------------------------------------
// review-pr.md command content — compact sub-agent output guidance
// ---------------------------------------------------------------------------

describe('review-pr command — compact sub-agent output guidance', () => {
	/** Slice of Step 6 — the review-agent launch step in ADO modes */
	const step6Section = commandContent.slice(
		commandContent.indexOf('## Step 6'),
		commandContent.indexOf('## Step 7'),
	)

	/** Pre-PR step D — the review-agent launch step in pre-PR mode */
	const stepDSection = commandContent.slice(
		commandContent.indexOf('### Step D'),
		commandContent.indexOf('### Step E'),
	)

	it('Step 6 instructs agents to return a JSON array of findings', () => {
		assert.ok(
			step6Section.includes('JSON') && step6Section.includes('array'),
			'Step 6 must instruct review agents to return a JSON array of findings',
		)
	})

	it('Step 6 requires all six finding fields in agent prompt', () => {
		const requiredFields = ['severity', 'filePath', 'startLine', 'endLine', 'title', 'body']
		for (const field of requiredFields) {
			assert.ok(
				step6Section.includes(field),
				`Step 6 agent prompt must mention required finding field: ${field}`,
			)
		}
	})

	it('Step 6 instructs agents to omit code quotes from return value', () => {
		assert.ok(
			step6Section.includes('no code quote') ||
				step6Section.includes('omit code quote') ||
				step6Section.includes('no code quotes') ||
				step6Section.includes('omit code quotes') ||
				step6Section.includes('without code quote') ||
				step6Section.includes('code quotes') ||
				step6Section.toLowerCase().includes('code quote'),
			'Step 6 must instruct agents to omit code quotes from the return value',
		)
	})

	it('Step 6 instructs agents to omit prose reasoning from return value', () => {
		assert.ok(
			step6Section.toLowerCase().includes('reasoning') ||
				step6Section.toLowerCase().includes('prose') ||
				step6Section.toLowerCase().includes('analysis') ||
				step6Section.toLowerCase().includes('supporting'),
			'Step 6 must instruct agents to keep reasoning inside their own context, not in return value',
		)
	})

	it('Step 6 severity values are exactly critical / important / minor', () => {
		assert.ok(step6Section.includes('critical'), 'Step 6 must specify "critical" as a severity value')
		assert.ok(step6Section.includes('important'), 'Step 6 must specify "important" as a severity value')
		assert.ok(step6Section.includes('minor'), 'Step 6 must specify "minor" as a severity value')
	})

	it('Step 6 requires filePath to use leading slash and forward slashes', () => {
		assert.ok(
			step6Section.includes('leading') || step6Section.includes('forward slash') || step6Section.includes('leading /'),
			'Step 6 must require filePath with leading slash and forward slashes matching ADO format',
		)
	})

	it('Step 6 requires title to be one line capped at 80 chars', () => {
		assert.ok(
			step6Section.includes('80') || step6Section.includes('one line') || step6Section.includes('≤ 80'),
			'Step 6 must require title to be one line, at most 80 characters',
		)
	})

	it('Step 6 requires body to be exactly the text to post as comment (no code quotes)', () => {
		assert.ok(
			step6Section.includes('body') && (step6Section.includes('post') || step6Section.includes('comment')),
			'Step 6 must describe body as the exact text to post as the ADO or local-interface comment',
		)
	})

	it('Step D instructs agents to return structured JSON findings (same schema as ADO modes)', () => {
		assert.ok(
			stepDSection.includes('JSON') || stepDSection.includes('structured'),
			'Step D must instruct review agents to return structured JSON findings',
		)
	})

	it('Step D requires same six finding fields as Step 6', () => {
		const requiredFields = ['severity', 'filePath', 'startLine', 'endLine', 'title', 'body']
		for (const field of requiredFields) {
			assert.ok(
				stepDSection.includes(field),
				`Step D agent prompt must mention required finding field: ${field}`,
			)
		}
	})

	it('Step D instructs agents to omit code quotes and prose reasoning from return value', () => {
		assert.ok(
			stepDSection.toLowerCase().includes('code quote') ||
				stepDSection.toLowerCase().includes('reasoning') ||
				stepDSection.toLowerCase().includes('prose') ||
				stepDSection.toLowerCase().includes('analysis'),
			'Step D must instruct agents to keep reasoning inside their own context, not in return value',
		)
	})
})

// ---------------------------------------------------------------------------
// review-pr.md command content — Pre-PR mode section
// ---------------------------------------------------------------------------

describe('review-pr command — Pre-PR mode', () => {
	it('no longer contains "not yet implemented" stub', () => {
		assert.ok(
			!commandContent.includes('not yet implemented'),
			'Pre-PR mode stub must be replaced with real implementation'
		)
	})

	it('prints a console message confirming Pre-PR mode', () => {
		assert.ok(
			commandContent.includes('Pre-PR mode') || commandContent.includes('pre-PR mode'),
			'Command must print a Pre-PR mode confirmation message'
		)
	})

	it('uses git diff against upstream to get the local branch diff', () => {
		assert.ok(
			commandContent.includes('git diff') && commandContent.includes('origin/'),
			'Command must use git diff origin/<branch>...HEAD for Pre-PR mode'
		)
	})

	it('uses pre-pr.mjs helpers for diff parsing', () => {
		assert.ok(commandContent.includes('pre-pr.mjs'), 'Command must import from pre-pr.mjs in Pre-PR mode')
	})

	it('launches review aspect agents in Pre-PR mode', () => {
		assert.ok(
			commandContent.includes('pr-review-toolkit:code-reviewer') &&
				commandContent.includes('pr-review-toolkit:silent-failure-hunter'),
			'Command must launch pr-review-toolkit review agents in Pre-PR mode'
		)
	})

	it('presents findings with severity, filePath, line range, title, body', () => {
		const preprSection = commandContent.slice(commandContent.indexOf('## Pre-PR mode'))
		assert.ok(preprSection.includes('severity'), 'Findings must include severity')
		assert.ok(preprSection.includes('filePath'), 'Findings must include filePath')
		assert.ok(
			preprSection.includes('startLine') || preprSection.includes('line range') || preprSection.includes('line'),
			'Findings must include line range'
		)
		assert.ok(preprSection.includes('title'), 'Findings must include title')
		assert.ok(preprSection.includes('body'), 'Findings must include body')
	})

	it('contains no ADO API calls (az devops invoke / az repos)', () => {
		const preprSection = commandContent.slice(commandContent.indexOf('## Pre-PR mode'))
		assert.ok(
			!preprSection.includes('az devops invoke') && !preprSection.includes('az repos'),
			'Pre-PR mode must not make ADO API calls'
		)
	})

	it('respects aspect filter from $ARGUMENTS', () => {
		const preprSection = commandContent.slice(commandContent.indexOf('## Pre-PR mode'))
		assert.ok(
			preprSection.includes('aspect') || preprSection.includes('ARGUMENTS') || preprSection.includes('filter'),
			'Pre-PR mode must respect the aspect filter from $ARGUMENTS'
		)
	})

	it('does not invoke ADO Fetcher agent in Pre-PR mode', () => {
		const preprSection = commandContent.slice(commandContent.indexOf('## Pre-PR mode'))
		assert.ok(!preprSection.includes('ado-fetcher'), 'Pre-PR mode must not invoke the ado-fetcher agent')
	})

	it('does not invoke ADO Writer agent in Pre-PR mode', () => {
		const preprSection = commandContent.slice(commandContent.indexOf('## Pre-PR mode'))
		assert.ok(!preprSection.includes('ado-writer'), 'Pre-PR mode must not invoke the ado-writer agent')
	})

	it('does not invoke Re-review Coordinator in Pre-PR mode', () => {
		const preprSection = commandContent.slice(commandContent.indexOf('## Pre-PR mode'))
		assert.ok(
			!preprSection.includes('re-review-coordinator'),
			'Pre-PR mode must not invoke the re-review-coordinator agent'
		)
	})

	it('prints a clear completion message when done', () => {
		const preprSection = commandContent.slice(commandContent.indexOf('## Pre-PR mode'))
		assert.ok(
			preprSection.includes('complete') ||
				preprSection.includes('done') ||
				preprSection.includes('finished') ||
				preprSection.includes('✅'),
			'Pre-PR mode must print a completion message'
		)
	})
})
