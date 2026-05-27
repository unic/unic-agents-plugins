// @ts-check

/**
 * Regex allowlist for `az` invocations intentionally NOT in `ado-cli-inventory.mjs`.
 *
 * Entries fall in two buckets:
 * - **Preflight calls** — the orchestrator probes the CLI itself, not an ADO API,
 *   so inventory-style coverage is overkill.
 * - **Error-message hints** — strings the plugin prints to nudge the user; they
 *   never run via the plugin, only via the human reading the error.
 *
 * Add a comment explaining the exemption alongside every entry.
 */

export const ADO_CLI_ALLOWLIST = [
	// Preflight in commands/review-pr.md Step 3 — Azure CLI version check.
	/^az --version$/,
	// Preflight — confirms the azure-devops extension is installed.
	/^az extension list$/,
	// Preflight (added by Slice 02) — confirms `az devops invoke` is callable.
	/^az devops invoke --area <missing> --resource <missing>$/,
	// Error-message hint — never invoked by the plugin; suggested to the user.
	/^az devops login$/,
	// Error-message hint — recovery instruction when the extension is missing.
	/^az extension add$/,
	// Error-message hint — recovery instruction when `az devops invoke` is broken.
	/^az extension remove$/,
]
