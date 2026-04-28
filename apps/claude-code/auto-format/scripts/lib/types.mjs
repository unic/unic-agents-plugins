// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/**
 * Shared JSDoc type definitions for format-hook.mjs and its helpers.
 * No runtime exports — consuming files reference these via JSDoc type-import tags.
 */

/**
 * The hook event JSON received on stdin from Claude Code's PostToolUse hook.
 *
 * @typedef {{
 *   tool_input?: {
 *     file_path?: string,
 *     notebook_path?: string
 *   }
 * }} HookEvent
 */

/**
 * Formatter selection — the set of values accepted by the `formatter` config key.
 *
 * @typedef {'auto' | 'prettier' | 'biome'} FormatterName
 */

/**
 * Resolved project configuration (output of loadProjectConfig).
 *
 * @typedef {{
 *   skipPrefixes: string[],
 *   prettierExtensions: string[],
 *   eslintExtensions: string[],
 *   formatTimeoutMs: number,
 *   formatter: FormatterName
 * }} ProjectConfig
 */

export {}
