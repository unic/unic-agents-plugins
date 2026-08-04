// @ts-check

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { METHODS_MANIFEST } from '../lib/methods-manifest.mjs'

/**
 * The Archon Boxes hold to the manifest.
 *
 * `test/command-methods.test.mjs` closed the loop on the four interactive Boxes, whose prose calls
 * `resolveMethod`. It could not cover the Archon Boxes, because until #281 they read no Method at all
 * — `AGENTS.md` said so out loud, and a stale Method name in a node prompt was caught only by reading.
 * This file closes that half.
 *
 * The two halves are held to DIFFERENT conventions, on purpose. A command Box resolves through
 * `resolveMethod` so a config-tier or `.local` override is honoured, and `command-methods.test.mjs`
 * forbids a literal path into a Method's directory. An Archon node cannot import plugin `lib/`
 * (ADR-0023 §5), so it must read the bundle tier by literal `.archon/methods/<name>/SKILL.md` path,
 * and this file forbids `resolveMethod` instead. Do not "unify" the two: the asymmetry is the
 * container difference, recorded in ADR-0023 §5.
 *
 * Every assertion here is a dumb string check, in the same style as its two siblings: a clever YAML
 * parser would have failure modes of its own, and node prompts are prompts, not code.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

/** Derived with `resolve`, never a path literal — the Windows CI runner's cwd is on `D:`. */
const BUNDLE_ROOT = resolve(PLUGIN_ROOT, 'vendor', 'mattpocock-skills')

/** Every Archon workflow this Plugin ships, and the Box name its `providedTo` entries use. */
const BOX_OF_WORKFLOW = /** @type {const} */ ({
	'unic-dlc-build': 'build',
	'unic-dlc-pr-review': 'pr-review',
	'unic-dlc-qa': 'qa',
	'unic-dlc-explore': 'explore',
})

const WORKFLOWS = /** @type {Array<keyof typeof BOX_OF_WORKFLOW>} */ (Object.keys(BOX_OF_WORKFLOW))

/**
 * A Method's `SKILL.md`, cited the one way an Archon node is allowed to cite it.
 *
 * Anchored on `SKILL.md` rather than the directory alone so a sub-file citation
 * (`.archon/methods/tdd/tests.md`) does not read as a second Method — sub-files get their own check.
 */
const METHOD_SKILL_PATH = /\.archon\/methods\/([a-z][a-z0-9-]*)\/SKILL\.md/g

/** Any file under a Method's installed directory — `SKILL.md` or a sub-file. */
const METHOD_ANY_FILE = /\.archon\/methods\/([a-z][a-z0-9-]*)\/([A-Za-z][A-Za-z0-9._-]*\.md)/g

const CANONICAL_NAMES = new Set(METHODS_MANIFEST.map((entry) => entry.name))
const ALL_ALIASES = new Set(METHODS_MANIFEST.flatMap((entry) => [...entry.aliases]))

/**
 * @param {keyof typeof BOX_OF_WORKFLOW} workflow
 * @returns {string}
 */
function readWorkflow(workflow) {
	return readFileSync(join(PLUGIN_ROOT, '.archon', 'workflows', `${workflow}.yaml`), 'utf8')
}

/**
 * The source text of a single node, from its `- id:` line up to (not including) the next node's.
 * @param {string} contents
 * @param {string} nodeId
 * @returns {string}
 */
function nodeSource(contents, nodeId) {
	return contents.split(`- id: ${nodeId}`)[1]?.split('\n  - id: ')[0]
}

/**
 * The Methods a workflow cites, deduped — one entry per Method however many nodes read it.
 * @param {keyof typeof BOX_OF_WORKFLOW} workflow
 * @returns {Set<string>}
 */
function citedMethods(workflow) {
	return new Set([...readWorkflow(workflow).matchAll(METHOD_SKILL_PATH)].map(([, name]) => name))
}

for (const workflow of WORKFLOWS) {
	test(`${workflow}.yaml cites no Method that upstream renamed away`, () => {
		// An alias is a *failure*, not a pass — same rule as the command Boxes. `resolveAlias` keeps a
		// config file written before the v1.1.0 rename working; a node prompt has no such excuse.
		for (const name of citedMethods(workflow)) {
			assert.ok(
				!ALL_ALIASES.has(name),
				`${workflow}.yaml cites .archon/methods/${name}/ — a pre-v1.1.0 alias; use the canonical Method name`
			)
			assert.ok(
				CANONICAL_NAMES.has(name),
				`${workflow}.yaml cites .archon/methods/${name}/SKILL.md, which is not a Method in the manifest`
			)
		}
	})

	test(`${workflow}.yaml cites only Method files that exist in the vendored bundle`, () => {
		// Catches a node pointing at a sub-file upstream deleted or never had — the Archon-side twin of
		// the command Boxes' sub-file check. `/setup` installs the bundle verbatim, so a path that is
		// absent from `vendor/` is absent from `.archon/methods/` in every Consumer too.
		for (const [, name, file] of readWorkflow(workflow).matchAll(METHOD_ANY_FILE)) {
			const entry = METHODS_MANIFEST.find((candidate) => candidate.name === name)
			assert.ok(entry, `${workflow}.yaml cites .archon/methods/${name}/${file}, which is not a manifest Method`)
			const declared = [entry.upstreamPath.split('/').pop(), ...entry.subFiles]
			assert.ok(
				declared.includes(file),
				`${workflow}.yaml cites \`${file}\` under "${name}", which the manifest does not declare — upstream may have moved or deleted it`
			)
			const onDisk = join(dirname(resolve(BUNDLE_ROOT, entry.upstreamPath)), file)
			assert.ok(existsSync(onDisk), `${workflow}.yaml cites \`${file}\` under "${name}", not in the vendored bundle`)
		}
	})

	test(`${workflow}.yaml resolves no Method through plugin lib/`, () => {
		// ADR-0023 §5: an Archon node is a self-contained prompt. It cannot import `lib/`, so it cannot
		// call `resolveMethod` — which is why the config and `.local` tiers do not reach inside a Box.
		// Matched as a CALL — `resolveMethod(` — not as the bare word. Every rewired node names
		// `resolveMethod` in prose precisely to forbid itself from calling it, so a substring check would
		// fail on the instruction that makes the rule true.
		const contents = readWorkflow(workflow)
		assert.ok(
			!contents.includes('resolveMethod('),
			`${workflow}.yaml calls resolveMethod — an Archon node must read the Method by literal path (ADR-0023 §5)`
		)
		assert.ok(
			!contents.includes('methods-resolver'),
			`${workflow}.yaml names lib/methods-resolver.mjs — an Archon node cannot import plugin lib/ (ADR-0023 §5)`
		)
		// Matched as a path prefix for the same reason: every workflow's bootstrap comment names
		// `$CLAUDE_PLUGIN_ROOT` to record that it deliberately does not use one.
		assert.ok(
			!contents.includes('$CLAUDE_PLUGIN_ROOT/'),
			`${workflow}.yaml joins a path onto $CLAUDE_PLUGIN_ROOT, which is not reliably set in Archon's runner (ADR-0023 §5)`
		)
	})

	test(`${workflow}.yaml points at no Method directory other than .archon/methods/`, () => {
		// `.agents/skills/` is where Matt's own setup installs; a node reading from there would pin the
		// Box to a directory this Plugin does not own — the defect `/triage` carried before #280.
		const contents = readWorkflow(workflow)
		assert.ok(
			!contents.includes('.agents/skills'),
			`${workflow}.yaml points at .agents/skills — Methods are installed at .archon/methods/ (ADR-0031)`
		)
		assert.ok(
			!contents.includes('vendor/mattpocock-skills'),
			`${workflow}.yaml points into the Bundle — a node reads the INSTALLED tier at .archon/methods/ (ADR-0031)`
		)
	})
}

test('every Archon workflow cites exactly the Methods the manifest says its Box reads', () => {
	// Asserted in both directions. One way alone lets the pair drift: a Box could quietly stop reading a
	// Method while `providedTo` — and the README table generated from it — kept claiming it does.
	for (const workflow of WORKFLOWS) {
		const box = BOX_OF_WORKFLOW[workflow]
		const cited = [...citedMethods(workflow)].sort()
		const fromManifest = METHODS_MANIFEST.filter((entry) => entry.providedTo.includes(box))
			.map((entry) => entry.name)
			.sort()

		assert.deepEqual(
			cited,
			fromManifest,
			`${workflow}.yaml cites [${cited}] but the manifest's providedTo for "${box}" says [${fromManifest}]`
		)
	}
})

test('/qa reads no Method — its brief shape is inlined because upstream deprecated the source', () => {
	// `qa` was Matt's Method until v1.1.0 moved it to `skills/deprecated/` with no replacement. The
	// citation is gone and the shape stays inlined; a manifest entry would point at a dead branch.
	// Without this, re-adding `qa` to the manifest would look like a fix instead of a regression (#281).
	assert.equal(citedMethods('unic-dlc-qa').size, 0, 'unic-dlc-qa.yaml must cite no Method')
	assert.equal(
		METHODS_MANIFEST.find((entry) => entry.name === 'qa'),
		undefined,
		'`qa` must not be in the manifest'
	)
	assert.ok(
		!/Matt(?:'s)? `?qa`?/.test(readWorkflow('unic-dlc-qa')),
		'unic-dlc-qa.yaml must not attribute its brief shape to a deprecated upstream Method'
	)
})

test('/build hosts no refactor phase — tdd puts refactoring in the review stage', () => {
	// AC 2/3 of #281 as a test, because the phase set is otherwise only prose: `tdd` says "refactoring
	// is not part of the loop", so a REFACTOR phase reappearing here contradicts the Method the node
	// now reads, and the Fowler smell baseline in /pr-review's Standards axis would double-cover it.
	const build = readWorkflow('unic-dlc-build')

	// The signal is the declared phase set and what the loop WRITES, not a scan for the string: the
	// state-load rule below must name `refactor-done` in order to retire it, exactly as the pre-check
	// node names `gh pr comment` in order to forbid it. A substring check would fail on the rule that
	// makes the retirement true.
	assert.match(
		build,
		/"phase": "pending\|red-done\|green-done"/,
		'unic-dlc-build.yaml must declare the phase set as pending|red-done|green-done'
	)
	assert.ok(
		!/phase "refactor-done"/.test(build),
		'unic-dlc-build.yaml writes or matches a "refactor-done" phase — the loop has no REFACTOR step (#281)'
	)
	// Regression guard for the migration rule itself. Without it a build-state.json left mid-run by
	// 0.14.0 matches no Step 2 branch, never satisfies COMPLETE, and freezes every slice blocked on it —
	// while the CHANGELOG's Breaking note promises the opposite (Copilot review, PR #293).
	assert.match(
		build,
		/Normalise on read[\s\S]{0,80}"refactor-done"[\s\S]{0,160}read as "green-done"/,
		'unic-dlc-build.yaml must normalise a legacy "refactor-done" phase to "green-done" when loading state'
	)
	assert.ok(
		!/###\s+REFACTOR/.test(build),
		'unic-dlc-build.yaml still carries a REFACTOR phase — refactoring belongs to /pr-review (#281)'
	)
	assert.match(
		readWorkflow('unic-dlc-pr-review'),
		/Fowler smell baseline/,
		"unic-dlc-pr-review.yaml must carry the Fowler smell baseline that replaced /build's REFACTOR phase"
	)
})

test('/pr-review is the only Archon Box that posts a review', () => {
	// AC 4: `implement` ends with "use /code-review", and /build now runs that as a LOCAL pre-check. Two
	// Boxes with review-posting authority would double-comment every PR — invisible in a green test run,
	// which is why it is asserted rather than trusted to prose.
	//
	// The signal is the hidden idempotency marker, not a scan for `gh pr comment`: the pre-check node
	// NAMES those commands in order to forbid them, so a substring check would fail on the prohibition
	// that makes the rule true. Only a node that actually posts a review needs the marker.
	const nodeBody = nodeSource(readWorkflow('unic-dlc-build'), 'implement-review-precheck')
	assert.ok(nodeBody, 'unic-dlc-build.yaml must carry the implement-review-precheck node')

	assert.match(nodeBody, /POSTS NOTHING/, 'implement-review-precheck must state that it posts nothing')
	assert.match(
		nodeBody,
		/Run no tracker or PR mutation/,
		'implement-review-precheck must spell out the mutations it may not run, not just assert it posts nothing'
	)

	for (const workflow of WORKFLOWS) {
		if (workflow === 'unic-dlc-pr-review') continue
		assert.ok(
			!readWorkflow(workflow).includes('unic-dlc-pr-review:iteration='),
			`${workflow}.yaml carries /pr-review's review marker — only /pr-review posts reviews (#281 AC 4)`
		)
	}
	assert.ok(
		readWorkflow('unic-dlc-pr-review').includes('unic-dlc-pr-review:iteration='),
		'unic-dlc-pr-review.yaml lost the iteration marker its re-review classification keys on'
	)
})

test('every Archon Box keeps its config gate and its fresh-context isolation', () => {
	// AC 9: this tranche removes hand-written text, not Harness capability. Deleting prose next to a
	// `when:` gate or a `context: fresh` line is the characteristic failure, and it is invisible in a
	// green test run — so the gate count and the isolation markers are pinned here.
	const gated = {
		'unic-dlc-build': 'build-pr-gate',
		'unic-dlc-pr-review': 'review-gate',
		'unic-dlc-qa': 'uat-gate',
		'unic-dlc-explore': 'spike-branch-gate',
	}

	for (const workflow of WORKFLOWS) {
		const contents = readWorkflow(workflow)
		assert.ok(contents.includes(`- id: ${gated[workflow]}`), `${workflow}.yaml lost its ${gated[workflow]} node`)
		assert.match(
			contents,
			/when: "\$bootstrap\.output\.gate == 'hitl'"/,
			`${workflow}.yaml lost the gates.${BOX_OF_WORKFLOW[workflow]} HITL condition — the gate would fire in AFK`
		)
		assert.match(contents, /context: fresh/, `${workflow}.yaml lost its fresh-context node isolation (ADR-0012)`)
	}

	const build = readWorkflow('unic-dlc-build')
	assert.ok(build.includes('- id: slopcheck'), 'unic-dlc-build.yaml lost the slopcheck node')
	assert.match(build, /fresh_context: true/, 'unic-dlc-build.yaml lost the red/green loop fresh-context guarantee')
})

test('the two sub-agent-spawn nodes allow Agent, never Task', () => {
	// `archon validate` (v0.7.0) caught this once already: `Task` in allowed_tools is silently
	// ignored at runtime, so a revert here would leave both fan-outs spawning nothing with no error.
	const spawners = /** @type {const} */ ({
		'unic-dlc-build': 'implement-review-precheck',
		'unic-dlc-pr-review': 'review',
	})
	for (const workflow of /** @type {Array<keyof typeof spawners>} */ (Object.keys(spawners))) {
		const nodeId = spawners[workflow]
		const node = nodeSource(readWorkflow(workflow), nodeId)
		assert.ok(node, `${workflow}.yaml lost its ${nodeId} node`)
		assert.match(
			node,
			/allowed_tools:.*\bAgent\b/,
			`${workflow}.yaml's ${nodeId} node must allow the Agent tool to spawn its two sub-agents`
		)
		assert.doesNotMatch(
			node,
			/allowed_tools:.*\bTask\b/,
			`${workflow}.yaml's ${nodeId} node allows Task — sub-agent spawn silently no-ops at runtime (the #281 regression)`
		)
	}
})

test('unic-dlc-explore.yaml — all four research nodes individually cite the research Method', () => {
	// `citedMethods` dedupes into a Set, so the bidirectional manifest check above cannot tell "all
	// four nodes cite research" from "only one still does" — this pins each node individually.
	const contents = readWorkflow('unic-dlc-explore')
	const nodeIds = [...contents.matchAll(/^ {2}- id: (research-\S+)/gm)].map(([, id]) => id)
	assert.equal(nodeIds.length, 4, 'expected four research nodes in unic-dlc-explore.yaml')
	for (const id of nodeIds) {
		const node = nodeSource(contents, id)
		assert.match(
			node,
			/\.archon\/methods\/research\/SKILL\.md/,
			`${id} must cite the research Method individually, not rely on a sibling node's citation`
		)
	}
})
