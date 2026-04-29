// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/**
 * Shared JSDoc type definitions for release-tools scripts.
 * No runtime exports — consumers access these types via JSDoc type-import tags in other files.
 */

/**
 * Plugin manifest loaded from .claude-plugin/plugin.json.
 *
 * @typedef {{ name: string, version: string, [key: string]: unknown }} PluginJson
 */

/**
 * Marketplace entry inside .claude-plugin/marketplace.json.
 *
 * @typedef {{ version: string, [key: string]: unknown }} MarketplaceEntry
 */

/**
 * Root structure of .claude-plugin/marketplace.json.
 *
 * @typedef {{ plugins: MarketplaceEntry[] }} MarketplaceJson
 */

export {}
