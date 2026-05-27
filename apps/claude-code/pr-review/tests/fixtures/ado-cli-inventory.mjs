// @ts-check

/**
 * Single source of truth for every `az` command this plugin actually invokes.
 *
 * The smoke test (`tests/ado-cli-smoke.test.mjs`) does two things with this list:
 * 1. Asserts every `az` shape found in `agents/`, `commands/`, and `scripts/` is
 *    listed here (modulo `ado-cli-allowlist.mjs`).
 * 2. Runs `<command> --help` against each entry to surface ADO CLI renames or
 *    removals (the Step 4 bug class — `az repos pr thread list` was a phantom).
 *
 * Register a new ADO call here before invoking it.
 *
 * @typedef {{
 *   kind: 'invoke',
 *   area: string,
 *   resource: string,
 *   command: string[],
 *   helpKeywordsRequired: string[],
 * }} InvokeEntry
 * @typedef {{
 *   kind: 'repos' | 'boards',
 *   command: string[],
 *   helpKeywordsRequired: string[],
 * }} SubcommandEntry
 * @typedef {InvokeEntry | SubcommandEntry} InventoryEntry
 */

/** @type {InventoryEntry[]} */
export const adoCliInventory = [
	// Orchestrator Step 4 — PR metadata.
	{
		kind: 'repos',
		command: ['az', 'repos', 'pr', 'show'],
		helpKeywordsRequired: ['--id', '--org'],
	},
	// ADO Fetcher Step 4 — checkout PR source branch.
	{
		kind: 'repos',
		command: ['az', 'repos', 'pr', 'checkout'],
		helpKeywordsRequired: ['--id'],
	},
	// Doc Context Orchestrator — fetch linked work item.
	{
		kind: 'boards',
		command: ['az', 'boards', 'work-item', 'show'],
		helpKeywordsRequired: ['--id'],
	},
	// ADO Fetcher Step 1 — list iterations.
	{
		kind: 'invoke',
		area: 'git',
		resource: 'pullRequestIterations',
		command: ['az', 'devops', 'invoke'],
		helpKeywordsRequired: ['--area', '--resource'],
	},
	// ADO Fetcher Step 2 — fetch PR threads (introduced in Slice 01).
	{
		kind: 'invoke',
		area: 'git',
		resource: 'pullRequestThreads',
		command: ['az', 'devops', 'invoke'],
		helpKeywordsRequired: ['--area', '--resource'],
	},
	// ADO Fetcher Step 3 — list changed files.
	{
		kind: 'invoke',
		area: 'git',
		resource: 'pullRequestIterationChanges',
		command: ['az', 'devops', 'invoke'],
		helpKeywordsRequired: ['--area', '--resource'],
	},
	// ADO Fetcher Step 5 — list linked work items.
	{
		kind: 'invoke',
		area: 'git',
		resource: 'pullRequestWorkItems',
		command: ['az', 'devops', 'invoke'],
		helpKeywordsRequired: ['--area', '--resource'],
	},
	// ADO Writer + Re-review Coordinator — post replies to threads.
	{
		kind: 'invoke',
		area: 'git',
		resource: 'pullRequestThreadComments',
		command: ['az', 'devops', 'invoke'],
		helpKeywordsRequired: ['--area', '--resource'],
	},
]
