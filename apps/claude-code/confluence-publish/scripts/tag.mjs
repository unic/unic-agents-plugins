#!/usr/bin/env node
import { spawnSync } from "node:child_process";
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./lib/errors.mjs";

try {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const pluginPath = path.join(root, ".claude-plugin/plugin.json");

	/** @type {{ version: string }} */
	const pluginJson = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, "utf8")));
	const version = pluginJson.version;
	if (!version || typeof version !== "string") {
		throw new CliError(`tag: .version missing in ${pluginPath}`);
	}

	// Safety sync before tagging (idempotent)
	spawnSync("node", [path.join(root, "scripts/sync-version.mjs")], { stdio: "inherit" });

	const tagResult = spawnSync("git", ["tag", `v${version}`], { stdio: "inherit" });
	if (tagResult.status !== 0) {
		throw new CliError(`tag: git tag failed — v${version} may already exist`);
	}

	console.log(`Tagged v${version}. Run: git push --follow-tags`);
} catch (err) {
	if (err instanceof CliError) {
		console.error(err.message);
		process.exit(/** @type {CliError} */ (err).exitCode);
	}
	throw err;
}
