// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { parse as parseYaml } from 'yaml'

/**
 * Explicit staging and host-agnostic repo pinning across every Box (#289).
 *
 * Two defects, both invisible in a green test run, both of which a rewiring slice re-introduces by
 * writing the shorter thing:
 *
 * 1. **Blind staging.** A Box runs in an isolated worktree that carries the operator's copied
 *    `.archon/` directory, scratch files, and (in /build) a `build-state.json` rewritten on every one
 *    of up to 60 loop iterations. `git add -A` therefore stages things that are not the change, which
 *    is why Archon 0.7.0 removed it from its own bundled command defaults.
 * 2. **Unpinned PR commands.** An unpinned `gh`/`az` resolves the repository from the checkout, which
 *    in a fork clone is the upstream parent — so a PR opens, or a review posts, against the wrong
 *    repository.
 *
 * Asserted with dumb string checks, in the same style as `archon-box-methods.test.mjs`: node prompts
 * are prompts, not code, and a clever YAML walk would have failure modes of its own.
 *
 * The ONE exception is `depends_on` / `trigger_rule`, which are structural DAG data rather than prose.
 * A string reader there has a failure mode of its own — it matches the inline flow form and silently
 * skips the block-list form, so a dropped `trigger_rule` reads as a pass. Those two are parsed.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

/** Every Archon workflow this Plugin ships. */
const WORKFLOWS = /** @type {const} */ (['unic-dlc-build', 'unic-dlc-pr-review', 'unic-dlc-qa', 'unic-dlc-explore'])

/** The two command Boxes that stage and open a PR of their own (ADR-0017: they need a live human). */
const COMMANDS = /** @type {const} */ (['specs', 'tickets'])

/** @param {string} workflow */
function readWorkflow(workflow) {
	return readFileSync(join(PLUGIN_ROOT, '.archon', 'workflows', `${workflow}.yaml`), 'utf8').replace(/\r\n/g, '\n')
}

/** @param {string} command */
function readCommand(command) {
	return readFileSync(join(PLUGIN_ROOT, 'commands', `${command}.md`), 'utf8').replace(/\r\n/g, '\n')
}

/**
 * The source text of a single node, from its `- id:` line up to (not including) the next node's.
 *
 * Splits on the id as a whole line, not a bare substring — `merge` is a prefix of `merge-gate`, and a
 * substring split on `- id: merge` would match inside `- id: merge-gate`'s own line when that node is
 * declared first, returning `merge-gate`'s body instead of `merge`'s.
 * @param {string} contents
 * @param {string} nodeId
 * @returns {string | undefined}
 */
function nodeSource(contents, nodeId) {
	const escapedId = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return contents.split(new RegExp(`- id: ${escapedId}\\n`))[1]?.split('\n  - id: ')[0]
}

/**
 * A blind staging verb in a position where it would RUN, rather than one quoted in prose.
 *
 * Every prompt that forbids `git add -A` has to name it in order to forbid it, so a plain substring
 * check would fail on exactly the rule that makes the file correct. Prose quotes the verb inside
 * backticks mid-sentence; a runnable one starts a line, indented or not. This is a POSITION check,
 * not a shell parser — a blind add hidden mid-line (`git checkout -b x && git add -A`) still passes,
 * which is a known limit rather than a claim of total coverage.
 *
 * All six spellings reach the same wrong content: `--all` is `-A`, `:/` and `*` are `.` from the repo
 * root, and `git add -Av` is `-A` with a clustered flag.
 */
const BLIND_ADD = /^[ \t]*git add\s+(?:-[A-Za-z]*[Au][A-Za-z]*|--all|\.|:\/|\*)(?:\s|$)/m

/**
 * `git commit -a` / `-am` stages every tracked modification WITHOUT ever calling `git add`, so it
 * defeats every staging rule that names only the `git add` spellings. It is the shorter thing a
 * rewiring slice reaches for once `git add -A` is forbidden, which is the threat model in the header.
 */
const BLIND_COMMIT = /^[ \t]*git commit\s+(?:-[A-Za-z]*a[A-Za-z]*|--all)(?:\s|$)/m

for (const workflow of WORKFLOWS) {
	test(`${workflow}.yaml stages nothing blindly`, () => {
		const contents = readWorkflow(workflow)
		assert.doesNotMatch(
			contents,
			BLIND_ADD,
			`${workflow}.yaml runs a blind staging verb — a Box stages named paths only (#289)`
		)
		assert.doesNotMatch(
			contents,
			BLIND_COMMIT,
			`${workflow}.yaml commits with -a, which stages every tracked modification without calling \`git add\` — the same defect as \`git add -u\` (#289)`
		)
	})
}

test('every committing node carries the deny list inline, not by reference to AGENTS.md', () => {
	// AC 8: a Box node is self-contained and imports nothing from the Plugin (ADR-0023 §5), so a
	// doctrine document is invisible to a running node. The rule has to be IN the prompt.
	const committing = /** @type {const} */ ([
		['unic-dlc-explore', 'preserve-spike'],
		['unic-dlc-build', 'open-pr'],
	])
	for (const [workflow, nodeId] of committing) {
		const node = nodeSource(readWorkflow(workflow), nodeId)
		assert.ok(node, `${workflow}.yaml lost its ${nodeId} node`)
		for (const denied of ['pr-body.md', '*.tmp.md', '*.scratch.md', '$ARTIFACTS_DIR']) {
			assert.ok(
				node.includes(denied),
				`${workflow}.yaml's ${nodeId} node must name \`${denied}\` in its inline deny list (#289 AC 4)`
			)
		}
		assert.match(
			node,
			/git status --porcelain/,
			`${workflow}.yaml's ${nodeId} node must confirm what is staged with \`git status --porcelain\``
		)
	}
})

test('/build commits build-state.json once, at open-pr, and never inside the loop', () => {
	// AC 3. build-state.json is the proof of ADR-0012's anti-cheat claim (`red_exit`,
	// `red_unexpected_pass`, the per-slice phase order), and that proof dies with the worktree when
	// /cleanup prunes it — so it must reach the PR. Committing it per phase instead would turn the
	// history into a churn log of up to 60 rewrites of one file.
	const build = readWorkflow('unic-dlc-build')

	const openPr = nodeSource(build, 'open-pr')
	assert.ok(openPr, 'unic-dlc-build.yaml lost its open-pr node')
	assert.match(openPr, /build-state\.json/, 'open-pr must stage build-state.json — it is the ADR-0012 proof')

	// The loop must SAY it does not commit the file. Asserting the absence of the string would pass on
	// a loop that silently swept it in with a blind add, which is the defect.
	const loop = nodeSource(build, 'run-build')
	assert.ok(loop, 'unic-dlc-build.yaml lost its run-build node')
	assert.match(loop, /loop:/, 'run-build must still be a loop node')
	const phaseRules = [...loop.matchAll(/do NOT stage or\s+commit it/g)]
	assert.equal(
		phaseRules.length,
		2,
		'both the RED and the GREEN phase must state that they never stage or commit build-state.json (#289 AC 3)'
	)
})

test('every PR-touching Box resolves the repository from project.repo_ref', () => {
	// AC 6. The bootstrap node reads the key; downstream nodes reference it through the same
	// node-output syntax as every other bootstrap field.
	for (const workflow of WORKFLOWS) {
		const contents = readWorkflow(workflow)
		assert.match(
			contents,
			/project\.repo_ref/,
			`${workflow}.yaml's bootstrap node must read project.repo_ref from the config`
		)
		assert.match(
			contents,
			/\$bootstrap\.output\.repo_ref\b/,
			`${workflow}.yaml must consume the pinned repository as $bootstrap.output.repo_ref`
		)
	}
})

/** Node IDs that must pin project.repo_ref on their own gh/az call — the nodes a missing pin would misroute. */
const REPO_PINNED_NODES = /** @type {const} */ ({
	'unic-dlc-build': ['implement-review-precheck', 'open-pr'],
	'unic-dlc-explore': ['spike-ticket'],
	'unic-dlc-pr-review': ['prep', 'post'],
	'unic-dlc-qa': ['verify-pr-base', 'merge'],
})

for (const [workflow, nodeIds] of Object.entries(REPO_PINNED_NODES)) {
	for (const nodeId of nodeIds) {
		test(`${workflow}.yaml's ${nodeId} node pins its own gh/az call to REPO_REF`, () => {
			// AC 6, node-scoped: a whole-file check would still pass if this specific node lost its pin
			// while some other node in the file kept theirs.
			const node = nodeSource(readWorkflow(workflow), nodeId)
			assert.ok(node, `${workflow}.yaml lost its ${nodeId} node`)
			assert.match(
				node,
				/--repo(?:sitory)? "/,
				`${workflow}.yaml's ${nodeId} node must pin its own gh/az call to REPO_REF, not rely on another node in the file`
			)
		})
	}
}

test('the repository reference stays host-agnostic — a flag per host, never a hardcoded host', () => {
	// AC 6. The same string reaches `gh` and `az` through different flags, so the prompt names both and
	// commits to neither host. A literal `github.com` in a command would pin every Consumer to GitHub.
	for (const workflow of WORKFLOWS) {
		const contents = readWorkflow(workflow)
		assert.match(contents, /--repo "/, `${workflow}.yaml must pass the github reference as --repo "<ref>"`)
		assert.match(
			contents,
			/--repository "/,
			`${workflow}.yaml must pass the ado reference as --repository "<ref>" where the subcommand takes one`
		)
		assert.doesNotMatch(
			contents,
			/(?:https?:\/\/)?(?:github\.com|dev\.azure\.com)\//,
			`${workflow}.yaml hardcodes a host URL — the repository reference carries the host (ADR-0016)`
		)
	}
})

test('an absent project.repo_ref cancels the Box — it never fails it', () => {
	// AC 7. ADR-0011: an expected precondition failure cancels, so the run reads as `cancelled` and does
	// not trigger the DAG auto-resume path. A `bash:` check exiting non-zero would fail the run instead.
	for (const workflow of WORKFLOWS) {
		const contents = readWorkflow(workflow)
		const guard = nodeSource(contents, 'guard-no-repo-ref')
		assert.ok(guard, `${workflow}.yaml must carry a guard-no-repo-ref node (#289 AC 7)`)
		assert.match(
			guard,
			/^\s+cancel: /m,
			`${workflow}.yaml's guard-no-repo-ref must use a cancel: node, not a failing check (ADR-0011)`
		)
		assert.match(
			guard,
			/when: "\$bootstrap\.output\.status == 'ready' && \(\$bootstrap\.output\.repo_ref_present == 'false' \|\| \$bootstrap\.output\.repo_ref == ''\)"/,
			`${workflow}.yaml's guard-no-repo-ref must fire on a ready config whose repo_ref is missing OR empty — the flag is self-reported by the same LLM node that emits the value, so gating on the flag alone lets \`repo_ref: ""\` through as \`--repo ""\``
		)
		// Actionable: the message names the missing key AND the command that writes it.
		assert.match(guard, /project\.repo_ref/, `${workflow}.yaml's cancel message must name project.repo_ref`)
		assert.match(
			guard,
			/unic-archon-dlc:setup/,
			`${workflow}.yaml's cancel message must point at /unic-archon-dlc:setup`
		)
	}
})

test('every node that waits on guard-no-repo-ref joins with trigger_rule: all_done', () => {
	// The guard carries a `when:`, so on the HAPPY path — `project.repo_ref` IS set — it is skipped, and
	// a skipped dependency propagates its skipped state under Archon's default `all_success` join. A
	// dependant without `trigger_rule: all_done` is therefore skipped for every correctly-configured
	// Consumer, taking its whole downstream chain with it. This asserts the join, not the edge: a Box may
	// legitimately leave the guard as a `when:`-exclusive sibling (a cancel node stops in-flight parallel
	// nodes), but a Box that DOES depend on it must say `all_done`.
	//
	// PARSED, not string-matched. `depends_on` is data, not prose, so the file-header justification for
	// string checks does not cover it — and a string reader tuned to the inline flow form
	// (`depends_on: [a, b]`) silently SKIPS the equally valid block-list form, turning a defect into a
	// pass rather than a failure.
	let checked = 0
	for (const workflow of WORKFLOWS) {
		const nodes = parseYaml(readWorkflow(workflow))?.nodes ?? []
		for (const node of nodes) {
			if (![node.depends_on ?? []].flat().includes('guard-no-repo-ref')) continue
			checked++
			assert.equal(
				node.trigger_rule,
				'all_done',
				`${workflow}.yaml's ${node.id} node depends on the when:-gated guard-no-repo-ref, so it needs \`trigger_rule: all_done\` — the default all_success skips it whenever the guard is skipped`
			)
		}
	}
	// Non-vacuity. /pr-review's `prep` carries the edge today, so a count of zero means the reader broke,
	// not that the Boxes are clean — the failure mode this assertion exists to catch.
	assert.ok(checked >= 1, 'no guard-no-repo-ref dependant found at all — the depends_on reader is broken')
})

test('each bootstrap still emits the contract the guard condition reads', () => {
	// The guard's `when:` is asserted verbatim above; this is the PRODUCER half. A `when:` that reads a
	// field bootstrap does not emit is not an error — it is permanently FALSE, so the guard never
	// cancels, the Box runs unpinned, and `gh pr create` resolves the repository from the checkout: the
	// upstream parent in a fork clone. That is #289 restored with the guard still sitting in the file
	// looking correct (#289 AC 7).
	for (const workflow of WORKFLOWS) {
		const contents = readWorkflow(workflow)
		const bootstrap = nodeSource(contents, 'bootstrap')
		assert.ok(bootstrap, `${workflow}.yaml lost its bootstrap node`)

		const required = bootstrap.match(/^\s+required: \[([^\]]*)\]/m)?.[1] ?? ''
		const declared = new Set(required.split(',').map((field) => field.trim()))

		// Take each `when:` expression whole, THEN every field inside it — a single regex over the file
		// stops at the first `$bootstrap.output.<field>` per condition, so the second and later reads of a
		// compound condition go unchecked. `guard-no-repo-ref` reads two.
		for (const [, expression] of contents.matchAll(/^\s+when: "([^"]*)"/gm)) {
			for (const [, field] of expression.matchAll(/\$bootstrap\.output\.(\w+)/g)) {
				assert.ok(
					declared.has(field),
					`${workflow}.yaml gates a node on $bootstrap.output.${field}, which bootstrap does not list in \`required\` — the condition is permanently false, not an error`
				)
			}
		}

		// A boolean never equals the string 'false', so retyping this field silently disables the guard.
		assert.match(
			bootstrap,
			/repo_ref_present:[\s\S]{0,120}?'true'[\s\S]{0,40}?'false'/,
			`${workflow}.yaml must keep repo_ref_present a STRING enum — the guard compares it to 'false' (#289 AC 7)`
		)
	}
})

for (const command of COMMANDS) {
	test(`commands/${command}.md stages named paths in both gate paths and pins the PR`, () => {
		// AC 5. `stage-only` is the path that gets forgotten: it stages without committing, so a blind
		// add there leaves the human to discover the scratch files in their own commit.
		const contents = readCommand(command)
		assert.doesNotMatch(
			contents,
			BLIND_ADD,
			`commands/${command}.md runs a blind staging verb — stage named paths in both gates (#289 AC 5)`
		)
		assert.match(
			contents,
			/git add -- "/,
			`commands/${command}.md must stage with \`git add -- "<path>"\`, one named path at a time`
		)
		assert.match(
			contents,
			/gh pr create --repo "/,
			`commands/${command}.md must pin \`gh pr create\` to the configured repository (#289 AC 6)`
		)
		assert.match(
			contents,
			/project\.repo_ref/,
			`commands/${command}.md must read project.repo_ref rather than letting the CLI infer the repository`
		)
		// `docs/adr/` as a whole directory is the specific blind add that survived the first fix: it is
		// not `git add -A`, but it sweeps in every unrelated in-flight ADR just the same.
		assert.doesNotMatch(
			contents,
			/git add[^\n]*\sdocs\/adr\/(?:\s|$)/,
			`commands/${command}.md stages the docs/adr/ directory — name each new ADR file instead`
		)
	})

	test(`commands/${command}.md warns (not cancels) on a null repo_ref, before opening a PR`, () => {
		// AC 7 continued: workflows CANCEL on a missing repo_ref (guard-no-repo-ref); command docs have a
		// live human, so they WARN AND ASK instead. scope.md flags this distinction as needing its own
		// verification, since none of the assertions above would fail if this warning were silently
		// dropped, reworded into a no-op, or reordered to print after the PR already opened.
		const contents = readCommand(command)
		const warnIdx = contents.indexOf('project.repo_ref is not set in .archon/unic-dlc.config.yaml')
		assert.notEqual(warnIdx, -1, `commands/${command}.md must warn when REPO_REF is null, not silently proceed`)

		const prCreateIdx = contents.indexOf('gh pr create --repo "')
		assert.ok(
			prCreateIdx !== -1 && warnIdx < prCreateIdx,
			`commands/${command}.md must print the null-repo_ref warning before the gh pr create call`
		)
	})
}
