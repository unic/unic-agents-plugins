# 08. Root Marketplace Manifest

**Status: done — 2026-04-29**

**Priority:** P0
**Effort:** S
**Version impact:** none
**Depends on:** 05, 06, 07
**Touches:** `.claude-plugin/marketplace.json`

## Context

Claude Code's marketplace mechanism allows a single JSON file to list multiple plugins. Once all three plugins are in the monorepo (specs 05–07), this spec creates the root `.claude-plugin/marketplace.json` that users add as a single marketplace source to access all Unic plugins.

## Current behaviour

`.claude-plugin/marketplace.json` does not exist. Users would need to add three separate marketplaces.

## Target behaviour

`.claude-plugin/marketplace.json` lists all three Claude Code plugins. Users run:

```sh
claude marketplace add <github-url-or-local-path>
# then:
claude plugins install pr-review
claude plugins install auto-format
claude plugins install confluence-publish
```

## Affected files

| File | Change |
|---|---|
| `.claude-plugin/marketplace.json` | Create |

## Implementation steps

1. Read the Claude Code plugin documentation or an existing marketplace.json from one of the old repos to confirm the multi-plugin marketplace format. The expected shape is an array of plugin entries, each with a `source` pointing to the plugin's directory relative to the marketplace file.

   > If the format turns out to be a single-plugin manifest (not an array), create individual per-plugin marketplace.json files instead, and document the per-plugin install commands. Add a `## Deviations` section and proceed.

2. Assuming the multi-plugin format is an object with a `plugins` array, create `.claude-plugin/marketplace.json`:

   ```json
   {
     "name": "Unic Agent Plugins",
     "description": "Official Unic AI agent plugins",
     "plugins": [
       {
         "source": "apps/claude-code/pr-review"
       },
       {
         "source": "apps/claude-code/auto-format"
       },
       {
         "source": "apps/claude-code/confluence-publish"
       }
     ]
   }
   ```

3. Update `README.md` — replace the `# coming after spec 09` placeholder in the "Installing plugins" section with the real marketplace install command. Use a placeholder GitHub URL (`https://github.com/unic/unic-agents-plugins`) since the repo may not be public yet.

## Verification

```sh
ls .claude-plugin/marketplace.json   # file exists
cat .claude-plugin/marketplace.json  # valid JSON, lists 3 plugins
```

## Acceptance criteria

- [ ] `.claude-plugin/marketplace.json` exists and is valid JSON
- [ ] All three plugins (`pr-review`, `auto-format`, `confluence-publish`) are listed
- [ ] Each entry has a `source` path pointing to the plugin directory
- [ ] `README.md` install snippet is updated

## Out of scope

- Actually publishing or testing the marketplace install (that's spec 11)
- Adding plugins for other agent targets (future work)
