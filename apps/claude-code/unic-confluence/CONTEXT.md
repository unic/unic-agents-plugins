# unic-confluence

A Claude Code Plugin (and npm package) that Publishes Markdown files into Confluence pages by injecting rendered HTML into named Injection Zones.

## Language

**Publish**:
The act of rendering a source Markdown file and writing its HTML into a target Injection Zone on a Confluence page.
_Avoid_: sync, push, upload, deploy

**Injection Zone**:
A named region in a Confluence page body bounded by marker comments (`[AUTO_INSERT_START:label]` / `[AUTO_INSERT_END:label]`), into which the Plugin writes rendered content.
_Avoid_: placeholder, slot, template region

**Zone Label**:
The named identifier inside an Injection Zone marker that addresses a specific zone — e.g. `[AUTO_INSERT_START:release-notes]`. A single page may have multiple Injection Zones distinguished by their Zone Labels.
_Avoid_: marker name, label, zone ID

**Page Map**:
The `confluence-pages.json` file that maps slug strings to numeric Confluence page IDs, allowing Publishes to be addressed by name rather than raw ID.
_Avoid_: pages file, ID map, config

**Page Alias**:
A single slug-to-ID entry within the Page Map — e.g. `"release-notes": 12345678`.
_Avoid_: slug, key, mapping

**Auto-aliasing**:
The behaviour of writing a new Page Alias into the Page Map after a Publish addressed by raw numeric ID, so future Publishes can use the slug instead.
_Avoid_: auto-slug, alias creation, ID resolution

## Relationships

- A **Publish** writes into exactly one **Injection Zone**, identified by its **Zone Label**
- If no **Injection Zone** is found, the Plugin falls back: anchor macros (legacy) → append to end of page
- A **Page Map** contains zero or more **Page Aliases**
- **Auto-aliasing** appends a new **Page Alias** to the **Page Map** after a Publish by raw ID

## Example dialogue

> **Dev:** "Can I Publish to two different sections of the same Confluence page?"
> **Domain expert:** "Yes — add two Injection Zones with different Zone Labels, then Publish twice, once per label."

> **Dev:** "A user ran `unic-confluence 12345678` and now the Page Map has a new entry. Did something go wrong?"
> **Domain expert:** "That's Auto-aliasing working as intended. The Plugin saved a Page Alias so they can use a slug next time instead of the raw ID."

> **Dev:** "What happens if I Publish to a page that has no Injection Zone markers?"
> **Domain expert:** "The Plugin falls back to anchor macros first (legacy pages), then appends to the end of the page if nothing matches."
