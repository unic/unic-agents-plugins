#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Read the single source of truth
const pluginPath = path.join(root, ".claude-plugin/plugin.json");
let pluginJson;
try {
	pluginJson = JSON.parse(readFileSync(pluginPath, "utf8"));
} catch (err) {
	console.error(`sync-version: cannot read ${pluginPath}: ${err.message}`);
	process.exit(1);
}

const version = pluginJson.version;
if (!version || typeof version !== "string") {
	console.error(`sync-version: .version is missing or not a string in ${pluginPath}`);
	process.exit(1);
}

// Write derived version into marketplace.json
const marketplacePath = path.join(root, ".claude-plugin/marketplace.json");
let marketplace;
try {
	marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
} catch (err) {
	console.error(`sync-version: cannot read ${marketplacePath}: ${err.message}`);
	process.exit(1);
}

if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
	console.error(`sync-version: marketplace.json has no plugins[] array`);
	process.exit(1);
}

const prev = marketplace.plugins[0].version;
marketplace.plugins[0].version = version;
writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n", "utf8");

if (prev === version) {
	console.log(`sync-version: marketplace.json already at version ${version} (no change)`);
} else {
	console.log(`sync-version: marketplace.json updated ${prev} → ${version}`);
}
