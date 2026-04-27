// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/**
 * Shared JSDoc type definitions for push-to-confluence.mjs and its lib modules.
 * No runtime exports — consumers access these types via JSDoc type-import tags in other files.
 */

/**
 * Credentials loaded from env vars or ~/.unic-confluence.json.
 *
 * @typedef {{ url: string, username: string, token: string }} Credentials
 */

/**
 * Raw HTTP response from httpsRequest.
 *
 * @typedef {{ status: number, body: string }} HttpResponse
 */

/**
 * Confluence page version object embedded in the page GET response.
 *
 * @typedef {{ number: number }} PageVersion
 */

/**
 * Confluence page data as returned by GET /wiki/api/v2/pages/:id?body-format=storage.
 *
 * @typedef {{
 *   title: string,
 *   version: PageVersion,
 *   body: { storage: { value: string } }
 * }} PageData
 */

/**
 * Options for injectContent.
 *
 * @typedef {{
 *   replaceAll?: boolean,
 *   dryRun?: boolean,
 *   pageId?: number,
 *   version?: number
 * }} InjectOptions
 */

export {}
