// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

/**
 * The barrier that bars provider knowledge from the Boxes, plus the staging and repo-derivation rules
 * it protects (#289).
 *
 * Two defects motivated this file, and one earlier fix motivated its shape.
 *
 * The defects: `/explore`'s `preserve-spike` ran `git add -A`, and `/build`'s `open-pr` said "stage
 * everything changed by the build" — in an isolated worktree with fresh context, "everything" is
 * whatever else is on disk. Separately, no PR or tracker call named the repository it acted on, so a
 * host tool inferred it from the checkout; in a fork clone that is the PARENT, and the PR opens on
 * someone else's project.
 *
 * The shape: the first attempt at the fix (PR #307, closed unmerged) satisfied a criterion that
 * prescribed the flag per host, and so wrote 22 `--repository`, 16 `gh pr create` and 11 `az repos pr`
 * occurrences into seven prompt blocks — including one `az repos pr thread` subcommand that does not
 * exist. That is the failure this file exists to make impossible. An agent composing a call at run time
 * reads the tool as it is today; a flag table frozen in a YAML file is stale the moment the tool
 * changes, cannot be verified without a live tenant, and is copied as precedent by the next agent that
 * reads it. ADR-0016: the DLC owns the _what_ and none of the _how_.
 *
 * Every assertion here is a dumb string check, in the same style as `archon-box-methods.test.mjs`: a
 * clever YAML parser would have failure modes of its own, and node prompts are prompts, not code.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

/**
 * The four Box YAMLs, both interactive command docs, and the four Archon command docs that ship
 * beside the YAMLs. #289 AC 10 names the first six; the four stubs are in because AC 6's rule is
 * "no Box prompt **or command doc**", and a Consumer's agent reads a stub as readily as a prompt.
 *
 * `commands/setup.md` is deliberately NOT here. `/setup` is the one surface that legitimately holds
 * provider values: it conducts the conversation that WRITES `tracker.type`, so it must be able to
 * name the options. Same for `/triage` and `/cleanup`, which are outside this defect's surface.
 *
 * Path segments are joined, never a literal — the Windows CI runner's cwd is on `D:`.
 * @type {readonly string[][]}
 */
const GUARDED = Object.freeze([
	['.archon', 'workflows', 'unic-dlc-build.yaml'],
	['.archon', 'workflows', 'unic-dlc-explore.yaml'],
	['.archon', 'workflows', 'unic-dlc-pr-review.yaml'],
	['.archon', 'workflows', 'unic-dlc-qa.yaml'],
	['.archon', 'commands', 'unic-dlc-build.md'],
	['.archon', 'commands', 'unic-dlc-explore.md'],
	['.archon', 'commands', 'unic-dlc-pr-review.md'],
	['.archon', 'commands', 'unic-dlc-qa.md'],
	['commands', 'specs.md'],
	['commands', 'tickets.md'],
])

/** The four Box YAMLs, by the workflow name their `bootstrap` node belongs to. */
const WORKFLOWS = /** @type {const} */ (['unic-dlc-build', 'unic-dlc-explore', 'unic-dlc-pr-review', 'unic-dlc-qa'])

/**
 * Every surface that commits. Each must carry the staging rule inline: a Box node is self-contained
 * and imports nothing from the Plugin (ADR-0023 §5), so doctrine in `AGENTS.md` is invisible to it.
 * @type {readonly string[][]}
 */
const COMMITTING = Object.freeze([
	['.archon', 'workflows', 'unic-dlc-build.yaml'],
	['.archon', 'workflows', 'unic-dlc-explore.yaml'],
	['commands', 'specs.md'],
	['commands', 'tickets.md'],
])

/**
 * The tokens no guarded file may contain, and a string each one must still catch.
 *
 * Boundaries are deliberate. `git` itself is fine and load-bearing — the repository is DERIVED with
 * `git remote get-url origin`, and git is the one tool every Consumer has whatever their host. What is
 * barred is the host's own CLI and the provider names a prompt could branch on.
 *
 * `github-flow` is a `project.branching` value and it trips the `github` pattern. That is intended: a
 * prompt derives its base branch from `project.branching == "gitflow"` and never needs to spell the
 * other value, so there is no legitimate hit to exempt.
 *
 * Design tools (`figma`) are absent from the list on purpose. This barrier covers the axes a Box
 * WRITES to — the repository host, the issue tracker, the docs system. Design input is read-only ingest
 * through a registered skill and is not on this defect's surface.
 * @type {ReadonlyArray<{ label: string, pattern: RegExp, sample: string }>}
 */
const BANNED = Object.freeze([
	{ label: 'gh', pattern: /\bgh\b/i, sample: 'run `gh pr view` first' },
	{ label: 'az', pattern: /\baz\b/i, sample: 'then `az repos pr show`' },
	{ label: '--repo / --repository', pattern: /--repositor(y|ies)\b|--repo\b/i, sample: 'pass --repo unic/x' },
	{ label: '--org / --organization', pattern: /--organi[sz]ation\b|--org\b/i, sample: 'pass --organization unic' },
	{ label: '--hostname', pattern: /--hostname\b/i, sample: 'pass --hostname example.com' },
	{ label: 'github', pattern: /github/i, sample: 'on GitHub this differs' },
	{ label: 'gitlab', pattern: /gitlab/i, sample: 'or .gitlab-ci.yml' },
	{ label: 'bitbucket', pattern: /bitbucket/i, sample: 'Bitbucket needs a different call' },
	{ label: 'ado', pattern: /\bado\b/i, sample: 'ado    → a thread' },
	{ label: 'azure', pattern: /azure/i, sample: 'the azure-devops-cli skill' },
	{ label: 'devops', pattern: /devops/i, sample: 'Azure DevOps threads' },
	{ label: 'jira', pattern: /\bjira\b/i, sample: 'jira / other → no PR' },
	{ label: 'confluence', pattern: /confluence/i, sample: 'publish to Confluence' },
	{ label: 'local-markdown', pattern: /local-markdown/i, sample: 'jira / local-markdown DO NOT' },
])

/**
 * Read a guarded file, normalising CRLF so the `^`/`$` anchors below behave on the Windows runner.
 * @param {readonly string[]} segments
 * @returns {string}
 */
function readGuarded(segments) {
	return readFileSync(join(PLUGIN_ROOT, ...segments), 'utf8').replace(/\r\n/g, '\n')
}

/** @param {readonly string[]} segments @returns {string} */
const label = (segments) => segments.join('/')

/**
 * Collapse every run of whitespace to one space.
 *
 * Prompt prose is hard-wrapped at 100 columns, so a sentence the Harness requires — "never the one a
 * tool infers from the checkout" — routinely spans two lines. Matching a phrase against the raw text
 * therefore fails on a reflow that changed nothing, which is a test that cries wolf until someone
 * deletes it. Flatten first, then match the phrase.
 * @param {string} text
 * @returns {string}
 */
const flatten = (text) => text.replace(/\s+/g, ' ')

/**
 * Every banned token in `text`, with the 1-indexed line it sits on.
 * @param {string} text
 * @returns {Array<{ token: string, line: number, source: string }>}
 */
function scan(text) {
	/** @type {Array<{ token: string, line: number, source: string }>} */
	const hits = []
	const lines = text.split('\n')
	for (const [index, source] of lines.entries()) {
		for (const { label: token, pattern } of BANNED) {
			if (pattern.test(source)) hits.push({ token, line: index + 1, source: source.trim() })
		}
	}
	return hits
}

/**
 * The source text of a single node, from its `- id:` line up to (not including) the next node's.
 *
 * The trailing newline in the split key is load-bearing: without it, `merge` matches `merge-gate`
 * first and this returns the wrong node's body — a silent false pass on whichever rule was asserted.
 * @param {string} contents
 * @param {string} nodeId
 * @returns {string}
 */
function nodeSource(contents, nodeId) {
	return contents.split(`- id: ${nodeId}\n`)[1]?.split('\n  - id: ')[0]
}

test('the barrier is pointed at files that exist', () => {
	// Without this a rename silently reduces coverage to zero and every test below passes vacuously.
	for (const segments of GUARDED) {
		const contents = readGuarded(segments)
		assert.ok(contents.length > 0, `${label(segments)} is empty or missing — the #289 barrier no longer covers it`)
	}
	assert.equal(GUARDED.length, 10, 'the guarded set changed — update it deliberately, do not let it shrink')
})

test('the barrier itself still fires', () => {
	// A self-test, because a mistyped pattern fails open: it reports a clean file forever and the
	// regression it was written to stop walks straight back in. Each entry must catch its own sample.
	for (const { label: token, pattern, sample } of BANNED) {
		assert.ok(pattern.test(sample), `the "${token}" pattern no longer matches its own sample: ${sample}`)
	}
	const hits = scan('Compose the host: `gh pr create --repo unic/x` on GitHub, `az repos pr` on ado.')
	assert.ok(hits.length >= 5, `the scanner found only ${hits.length} tokens in a line that carries at least five`)
})

test('no Box prompt or command doc names a host CLI, a flag, or a provider', () => {
	// #289 AC 6/AC 10. A Box states WHICH repository to act on and never HOW: it composes the
	// system-skill the Consumer registered under `tracker.access` and reads that skill's own current
	// interface. A prompt may name the config KEYS it reads (`tracker.type`, `tracker.access`) — it must
	// never branch on the provider VALUE, and must never carry a command, subcommand or flag.
	/** @type {string[]} */
	const failures = []
	for (const segments of GUARDED) {
		for (const hit of scan(readGuarded(segments))) {
			failures.push(`${label(segments)}:${hit.line} — "${hit.token}" in: ${hit.source}`)
		}
	}
	assert.deepEqual(
		failures,
		[],
		`provider knowledge leaked back into the Boxes (#289 AC 6). ${failures.length} hit(s):\n  ${failures.join('\n  ')}\n` +
			'Fix it by stating the repository and composing the registered system-skill — not by widening this list.'
	)
})

test('no Box stages blindly', () => {
	// #289 AC 1/2/5. Matched as a BARE COMMAND (`git add -A` at the start of a line), not as a
	// substring: every staging rule NAMES `git add -A` in order to forbid it, so a substring check
	// would fail on the prohibition that makes the rule true — the same trap
	// `archon-box-methods.test.mjs` documents for `resolveMethod`.
	for (const segments of GUARDED) {
		const contents = readGuarded(segments)
		assert.doesNotMatch(
			contents,
			/^\s*git add\s+(-A|-u|\.)(\s|$)/m,
			`${label(segments)} runs a blind \`git add\` — stage named paths (#289 AC 1/2/5)`
		)
		assert.doesNotMatch(
			flatten(contents),
			/(?<!never )[Ss]tage (everything|all) /,
			`${label(segments)} says to stage everything/all — name the paths instead (#289 AC 2)`
		)
		// A trailing slash is a directory sweep: `git add docs/adr/` commits every uncommitted ADR,
		// not the ones this session wrote.
		assert.doesNotMatch(
			contents,
			/^\s*git add\s+\S*\/\s*$/m,
			`${label(segments)} stages a whole directory — name each file (#289 AC 5)`
		)
	}
})

test('every committing surface carries the staging deny list inline', () => {
	// #289 AC 4/AC 8. Inline, not as doctrine: an Archon node is self-contained and imports nothing
	// from the Plugin (ADR-0023 §5), so a rule that lives only in AGENTS.md is invisible at run time.
	for (const segments of COMMITTING) {
		const contents = readGuarded(segments)
		assert.match(
			flatten(contents),
			/never `git add -A`/i,
			`${label(segments)} commits without forbidding a blind \`git add\` (#289 AC 4)`
		)
		for (const denied of ['pr-body.md', '*.tmp.md', '*.scratch.md', '$ARTIFACTS_DIR']) {
			assert.ok(contents.includes(denied), `${label(segments)} commits without denying \`${denied}\` (#289 AC 4)`)
		}
		assert.match(
			contents,
			/git status --porcelain/,
			`${label(segments)} commits without confirming the staged set with \`git status --porcelain\` (#289 AC 1)`
		)
	}
})

test('/build commits build-state.json once, at open-pr, and never in the loop', () => {
	// #289 AC 3. build-state.json is the proof of ADR-0012's anti-cheat claim (`red_exit`,
	// `red_unexpected_pass`, the per-slice phase order). The loop rewrites it on every one of up to 60
	// iterations, so committing it there would put 60 revisions of a scratch-looking file in the PR —
	// and leaving it uncommitted loses the proof entirely when `/cleanup` prunes the worktree.
	const build = readGuarded(['.archon', 'workflows', 'unic-dlc-build.yaml'])

	const openPr = nodeSource(build, 'open-pr')
	assert.ok(openPr, 'unic-dlc-build.yaml lost its open-pr node')
	assert.match(openPr, /build-state\.json/, "open-pr must stage build-state.json — it is /build's anti-cheat record")
	for (const named of ['PRD.md', 'issues.json', 'report.md', 'docs/adr/']) {
		assert.ok(openPr.includes(named), `open-pr's stage list must name ${named} explicitly (#289 AC 2)`)
	}

	const loop = build.split('- id: run-build')[1]?.split('\n  - id: ')[0]
	assert.ok(loop, 'unic-dlc-build.yaml lost its run-build loop')
	assert.match(
		flatten(loop),
		/NEVER stage or commit build-state\.json/,
		'the run-build loop must forbid committing build-state.json — open-pr commits it once (#289 AC 3)'
	)
})

test('every Archon Box derives the repository from origin, with repo_ref as an optional override', () => {
	// #289 AC 7. Derived, not configured: `project.repo_ref` is absent from a default config, so a
	// Consumer upgrading to this version needs no config change. The ambiguity guard fires only for a
	// fork checkout whose parent differs from `origin` — a checkout with one remote never reaches it.
	for (const workflow of WORKFLOWS) {
		const contents = readGuarded(['.archon', 'workflows', `${workflow}.yaml`])
		const bootstrap = nodeSource(contents, 'bootstrap')
		assert.ok(bootstrap, `${workflow}.yaml lost its bootstrap node`)

		assert.match(
			bootstrap,
			/git remote get-url origin/,
			`${workflow}.yaml's bootstrap must derive the repository from the worktree's origin remote (#289 AC 7)`
		)
		assert.match(
			flatten(bootstrap),
			/`project\.repo_ref` is an OPTIONAL override/,
			`${workflow}.yaml's bootstrap must record that project.repo_ref is an optional override (#289 AC 7)`
		)
		assert.match(
			bootstrap,
			/required: \[[^\]]*\brepo_ref\b[^\]]*\]/,
			`${workflow}.yaml's bootstrap must emit repo_ref as a required field — downstream nodes name it`
		)

		// CANCEL, not fail: an ambiguous target is an expected precondition failure (ADR-0011).
		assert.ok(
			contents.includes('- id: guard-ambiguous-repo'),
			`${workflow}.yaml lost its guard-ambiguous-repo node (#289 AC 7)`
		)
		const guard = nodeSource(contents, 'guard-ambiguous-repo')
		assert.ok(guard, `${workflow}.yaml's guard-ambiguous-repo node body could not be extracted`)
		assert.match(
			guard,
			/when: "\$bootstrap\.output\.status == 'ambiguous-repo'"/,
			`${workflow}.yaml's guard-ambiguous-repo must fire on exactly the ambiguous-repo status`
		)
		assert.match(guard, /cancel:/, `${workflow}.yaml's guard-ambiguous-repo must cancel, not fail (ADR-0011)`)
		// The two guards must be mutually exclusive, or both fire on an ambiguous repository and the
		// operator reads the generic "run /tickets first" message instead of the one that helps.
		const guardNotReady = nodeSource(contents, 'guard-not-ready')
		assert.ok(guardNotReady, `${workflow}.yaml's guard-not-ready node body could not be extracted`)
		assert.match(
			guardNotReady,
			/status != 'ready' && \$bootstrap\.output\.status != 'ambiguous-repo'/,
			`${workflow}.yaml's guard-not-ready must exclude ambiguous-repo so only one guard fires`
		)
	}
})

test('every PR-touching prompt states the repository invariant inline', () => {
	// #289 AC 6/AC 8. The invariant is the whole point and it is one sentence: act on THIS repository,
	// never the one a tool infers from the checkout. Asserted per NODE rather than per file, because a
	// file-level check passes as soon as any one node carries it.
	const invariant = /never the one a tool infers from the checkout/

	/** @type {ReadonlyArray<[string, string]>} */
	const prTouching = [
		['unic-dlc-build', 'open-pr'],
		['unic-dlc-build', 'implement-review-precheck'],
		['unic-dlc-explore', 'spike-ticket'],
		['unic-dlc-pr-review', 'prep'],
		['unic-dlc-pr-review', 'post'],
		['unic-dlc-qa', 'uat-gate'],
		['unic-dlc-qa', 'verify-pr-base'],
		['unic-dlc-qa', 'merge'],
	]
	for (const [workflow, nodeId] of prTouching) {
		const node = nodeSource(readGuarded(['.archon', 'workflows', `${workflow}.yaml`]), nodeId)
		assert.ok(node, `${workflow}.yaml lost its ${nodeId} node`)
		assert.match(
			flatten(node),
			invariant,
			`${workflow}.yaml's ${nodeId} node must state the repository invariant (#289 AC 6)`
		)
		assert.match(
			node,
			/\$bootstrap\.output\.repo_ref/,
			`${workflow}.yaml's ${nodeId} node must name the derived repository, not leave it implicit (#289 AC 7)`
		)
	}

	for (const doc of [
		['commands', 'specs.md'],
		['commands', 'tickets.md'],
	]) {
		const contents = readGuarded(doc)
		assert.match(
			flatten(contents),
			invariant,
			`${label(doc)} must state the repository invariant at its PR gate (#289 AC 6)`
		)
		assert.match(
			contents,
			/git remote get-url origin/,
			`${label(doc)} must derive its target repository from the origin remote (#289 AC 7)`
		)
	}
})

test('the composed skill is asked for a capability, never assumed to have one', () => {
	// #289 AC 7's closing clause: "if the composed system-skill cannot target a repository explicitly,
	// cancel naming the missing capability." Without this a Box silently falls back to an inferred
	// repository, which is the original defect wearing a composition-shaped hat.
	for (const workflow of WORKFLOWS) {
		const contents = readGuarded(['.archon', 'workflows', `${workflow}.yaml`])
		assert.match(
			contents,
			/cannot target a repository explicitly/,
			`${workflow}.yaml must handle a registered skill that cannot target a repository explicitly (#289 AC 7)`
		)
	}
})
