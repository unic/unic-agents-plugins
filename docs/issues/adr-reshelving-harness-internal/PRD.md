---
title: Reshelve harness-internal ADRs into the unic-archon-dlc plugin
created: 2026-05-23
---

**Status:** ready-for-agent
**Plugin:** `apps/claude-code/unic-archon-dlc` (plus monorepo-wide doc edits)
**Category:** documentation

## Problem Statement

The root `docs/adr/` directory currently holds 31 ADRs. Nine of them are scoped to the `unic-archon-dlc` plugin's internals — the Feature Runner, the spec template format, the retired Ralph orchestrator, the retired `/implement-feature` skill — yet they live alongside genuinely monorepo-wide decisions about pnpm, Biome, CI, releases, GPG signing, and the like.

That mixing has three concrete costs:

- The root ADR index is harder to scan because half of the post-0019 entries describe a single plugin's harness rather than cross-cutting monorepo conventions.
- The scope of each decision is miscommunicated. A reader of root `docs/adr/` reasonably expects every entry to be a repo-level decision; the harness ADRs are not.
- Supersession chains (0030 supersedes 0020 + 0024; 0031 supersedes 0027 + 0029) are read as monorepo history rather than as the harness's evolution.

This Feature reshelves the nine harness-internal ADRs into the plugin's own `docs/adr/` directory, sweeps inbound references, leaves redirect stubs for external links, and updates the auto-generated `docs/agents/domain.md` so the convention is documented at the surface where agents read it.

## Solution

Nine ADR files move from root `docs/adr/` to `apps/claude-code/unic-archon-dlc/docs/adr/` and are renumbered to a fresh sequence (0002–0010, continuing after the existing 0001-setup-as-slash-command). Each renumbered ADR carries a single-line "Renumbered from monorepo-root ADR-NNNN" trace under its Status header so git archaeology continues to lead somewhere useful.

At each old root path, a one-line redirect stub replaces the original file. The stub preserves external links (GitHub permalinks shared in Slack, PR descriptions, issue comments) and honours the existing "Never delete an ADR" rule from `docs/adr/README.md`. Internal inbound links across four monorepo docs are swept to point at the new locations directly.

The `buildDomainDoc` template in `lib/agent-docs-writer.mjs` is generalised in its multi-context branch to mention that each context may keep its own `docs/adr/`. The wording is generic — no hardcoded path to this monorepo's structure leaks into the harness. A regenerated `docs/agents/domain.md` (produced by re-running `/unic-archon-dlc:setup` against this repo) lands in the same PR so the dogfood state matches the new generator output. The per-plugin ADR index README is refreshed to list all ten files. A single line is added to `CONTEXT-MAP.md` under "Relationships" describing the ADR-location split.

## User Stories

1. As a maintainer scanning root `docs/adr/`, I want only monorepo-wide decisions to appear, so that the index communicates scope correctly.
2. As a contributor opening the `unic-archon-dlc` plugin directory, I want every harness-internal ADR to live under `apps/claude-code/unic-archon-dlc/docs/adr/`, so that I can read the plugin's design history without cross-jumping to the root.
3. As a contributor reading a renumbered ADR, I want a "Renumbered from monorepo-root ADR-NNNN" trace at the top, so that I can correlate the file with old commit messages that refer to the original number.
4. As a maintainer chasing a GitHub permalink shared months ago to `docs/adr/0030-retire-ralph-adopt-archon-runner.md`, I want a redirect stub at that path pointing to the new home, so that the external link still leads somewhere actionable.
5. As a contributor reading `CONTRIBUTING.md`, I want references to ADR-0030 / ADR-0031 to resolve directly to their new locations under the plugin, so that I do not pay an extra redirect hop.
6. As a contributor reading `docs/process/ai-development.md` or `docs/process/development-workflow.md`, I want every ADR link to point at the new harness path with the new number, so that the process docs reflect current structure.
7. As a contributor reading `docs/agents/feature-runner.md`, I want the ADR-0028 / 0030 / 0031 links to resolve directly to the new harness paths, so that the agent-facing doc stays accurate after reshelving.
8. As a contributor following an ADR supersession chain (0020 superseded by 0030, etc.), I want both ends of the chain to live in the same directory, so that I do not have to cross monorepo / plugin boundaries to read the history.
9. As an agent reading `docs/agents/domain.md`, I want the multi-context section to acknowledge that per-context `docs/adr/` directories are a permitted pattern, so that I do not assume root `docs/adr/` is the only location for architectural decisions.
10. As a maintainer of `unic-archon-dlc` running setup against a Consumer that uses a multi-context layout, I want the harness to describe the per-context ADR pattern generically — without baking in this monorepo's plugin path — so that the generated `docs/agents/domain.md` is portable.
11. As a contributor opening `CONTEXT-MAP.md`, I want a one-line note that monorepo-wide decisions live in root `docs/adr/` and per-context decisions live in each context's `docs/adr/`, so that the routing rule is discoverable from the structural index.
12. As a contributor opening `apps/claude-code/unic-archon-dlc/docs/adr/README.md`, I want the index table to list all ten ADRs in the directory, so that I can navigate the plugin's design history without `ls`-ing the folder.
13. As a maintainer running `pnpm --filter unic-archon-dlc test` after the generator change, I want a node:test assertion that `buildDomainDoc` emits the per-context-ADR phrase in multi-context mode and omits it in single-context mode, so that future edits to the generator wording fail CI rather than silently regressing.
14. As a maintainer verifying the regenerated `docs/agents/domain.md`, I want the file to be produced by a real `/unic-archon-dlc:setup` run — not hand-edited — so that the dogfood state matches what the harness would write in any other multi-context Consumer.
15. As a maintainer reviewing the resulting PR, I want a single grep guard (`docs/adr/00\(20\|23\|24\|26\|27\|28\|29\|30\|31\)`) to return only the redirect stubs and historical-only references, so that I can confirm no live link points at the old paths.
16. As a contributor reading the dogfood-banner PRD or the custom-spec-runner-grill-02 conversation, I want those name-only references (`ADR-0030`, `ADR-0031`, etc.) to be left alone, so that historical wording is preserved.
17. As a maintainer following Gitflow, I want this work to land via a feature branch targeting `develop`, so that the release flow remains predictable.

## Implementation Decisions

### Renumbering policy

ADRs move with a fresh sequence starting at `0002` (the existing `0001-setup-as-slash-command.md` keeps its slot). The mapping is fixed by the move order — original ascending order maps to new ascending order:

| Old number | New number | Slug                             |
| ---------- | ---------- | -------------------------------- |
| 0020       | 0002       | per-plugin-ralph-loops           |
| 0023       | 0003       | spec-template-format             |
| 0024       | 0004       | ralph-atomic-iteration           |
| 0026       | 0005       | tdd-dispatch-by-version-impact   |
| 0027       | 0006       | feature-runner-context-bundle    |
| 0028       | 0007       | blocked-by-canonical-sequencing  |
| 0029       | 0008       | feature-runner-afk-invocation    |
| 0030       | 0009       | retire-ralph-adopt-archon-runner |
| 0031       | 0010       | retire-implement-feature-skill   |

Slugs are preserved verbatim. Each renumbered file gains a single trace line immediately under the Status header, of the form `Renumbered from monorepo-root ADR-NNNN (2026-05).`

Per-directory numbering is already the documented convention in root `docs/adr/README.md` ("Files are named NNNN-slug.md, zero-padded to 4 digits, per directory"), so no policy text needs changing.

### Redirect stub format

At each of the nine original root paths, the file is replaced with a one-line redirect stub. The stub is intentionally short and clearly marked so it is not mistaken for an active ADR:

```markdown
# NNNN. <original title>

> **Moved** to [apps/claude-code/unic-archon-dlc/docs/adr/00MM-<slug>.md](../../apps/claude-code/unic-archon-dlc/docs/adr/00MM-<slug>.md) (2026-05).
>
> This ADR is harness-internal and now lives with the unic-archon-dlc plugin. The redirect preserves external links; new references should use the new path.
```

The stub keeps the original NNNN title for index searchability but carries no Status / Context / Decision / Consequences sections. The body is a single blockquote callout so a reader scanning the file sees the redirect immediately and does not read further looking for content that is no longer there.

### Supersession chains stay intact

Both cohorts move together:

- **Active** (still load-bearing): 0023, 0026, 0028, 0030, 0031 — become 0003, 0005, 0007, 0009, 0010.
- **Superseded** (historical only): 0020 (→ 0002), 0024 (→ 0004), 0027 (→ 0006), 0029 (→ 0008).

Inside the moved set, every ADR-to-ADR reference (e.g. "Superseded by ADR-0030", "see ADR-0027 / ADR-0029") is updated to the new harness-local number. All references are intra-directory after the move, so relative paths simplify (e.g. `0030-retire-ralph-adopt-archon-runner.md` becomes `0009-retire-ralph-adopt-archon-runner.md`).

### Internal link sweep

Four monorepo docs contain inbound links to the moved set. Each is updated so every reference points at the new harness path with the new number. No old-path link survives in these files:

- `CONTRIBUTING.md` — two links (0030, 0031) → (0009, 0010).
- `docs/agents/feature-runner.md` — three links (0028, 0030, 0031) → (0007, 0009, 0010).
- `docs/process/ai-development.md` — five links (0027, 0028, 0029, 0030, 0031) → (0006, 0007, 0008, 0009, 0010).
- `docs/process/development-workflow.md` — three links (0028, 0030, 0031) → (0007, 0009, 0010).

Relative path prefixes adjust accordingly (e.g. `docs/agents/feature-runner.md` previously used `../adr/0028-…`; the new link becomes `../../apps/claude-code/unic-archon-dlc/docs/adr/0007-…`).

Two name-only references are explicitly left untouched:

- `docs/issues/unic-archon-dlc-dogfood-banner/PRD.md` mentions "ADR-0030 and ADR-0031" by name only (no link). It is an already-merged PRD describing past context; updating the wording would muddy the historical record.
- `docs/conversations/custom-spec-runner-grill-02.md` is a verbatim historical conversation transcript.

### Generator change in `lib/agent-docs-writer.mjs`

The `buildDomainDoc(c, projectDir)` function's multi-context branch currently emits two bullet points:

```
- **Context map:** `CONTEXT-MAP.md`
- **ADRs:** `docs/adr/` (repo-level decisions)
```

The second bullet is generalised to acknowledge that each context may keep its own `docs/adr/`. The wording stays portable — no hardcoded plugin path, no mention of `unic-archon-dlc` specifically. Suggested wording (final form is owned by the implementer subject to the constraint):

```
- **Context map:** `CONTEXT-MAP.md`
- **ADRs:** monorepo-wide decisions live in root `docs/adr/`; each context may also keep its own `docs/adr/` for decisions scoped to that context.
```

The single-context branch is untouched.

No other lib module changes. The function signature, return shape, and call sites stay identical.

### Regenerated `docs/agents/domain.md`

After the generator change ships, the existing `docs/agents/domain.md` in this repo is regenerated by running `/unic-archon-dlc:setup` against the repo. The dogfood banner already present at the top of the file remains in place (it is reapplied by `prependBanner(AGENT_DOC_BANNER, …)` in `writeAgentDocs`). Hand-editing the file is explicitly forbidden by the banner; the implementation must use the setup re-run path so the diff matches what the updated generator would produce in any Consumer.

### `CONTEXT-MAP.md` relationship note

A single line is added to `CONTEXT-MAP.md` under the existing "Relationships" section:

```
- Architectural decisions are split by scope: monorepo-wide decisions live in root `docs/adr/`; decisions scoped to a single context live in that context's own `docs/adr/`.
```

The `CONTEXT.md` glossary is **not** touched. Adding a "Plugin ADR" term would violate its strict ubiquitous-language-only role; the ADR location is a structural fact, not domain vocabulary.

### Plugin ADR README refresh

`apps/claude-code/unic-archon-dlc/docs/adr/README.md` currently lists only 0001 in its index table. After the move it is refreshed to list all ten ADRs in numeric order. The existing pointer at the top of the file ("Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root.") stays unchanged.

### Release impact

The generator change to `lib/agent-docs-writer.mjs` is a behavioural change to the on-disk output of generated files in any multi-context Consumer using `unic-archon-dlc`. Version impact: **patch**.

- Run `pnpm --filter unic-archon-dlc bump patch`.
- Add a dated CHANGELOG entry under the new version describing the generator change.

The remaining edits (ADR moves, stubs, link sweep, README refresh, CONTEXT-MAP line, regenerated `docs/agents/domain.md`) are documentation only and require no further version bump. `verify:changelog` runs PR-only (ADR-0017) and will be satisfied by the patch bump entry.

### Commits and branch

- Branch: `feature/adr-reshelving-harness-internal`, targeting `develop`.
- Commit scopes follow Conventional Commits (ADR-0021):
  - `docs(adr): …` for the ADR moves, stubs, link sweep, plugin ADR README refresh, and `CONTEXT-MAP.md` edit.
  - `chore(unic-archon-dlc): …` for the `lib/agent-docs-writer.mjs` change, the new test assertions, the `bump patch`, the CHANGELOG entry, and the regenerated `docs/agents/domain.md`.
- Per repo doctrine: never touch `LICENSE` files.

## Testing Decisions

The change splits cleanly into a mechanical doc move (verified by review + grep guard) and a small generator change (verified by node:test assertions + the setup re-run).

### Extend `test/install-agent-docs.test.mjs`

Prior art: this file already exercises `writeAgentDocs(projectDir, config)` end-to-end by writing into an `os.tmpdir()` sandbox and asserting file contents. The new behaviour is added by extending the existing tests rather than creating a new file, mirroring how the dogfood-banner work extended the same test in #124.

New assertions:

- When `config.repo_layout === 'multi-context'`, the generated `docs/agents/domain.md` contains the per-context-ADR phrase introduced in the multi-context branch of `buildDomainDoc`.
- When `config.repo_layout` is `'single-context'` (or unset, defaulting to single-context), the generated `docs/agents/domain.md` does **not** contain the per-context-ADR phrase.
- Both branches continue to include the `AGENT_DOC_BANNER` prefix (regression guard for the dogfood-banner contract).

Tests assert observable file contents — not the internal call shape of `buildDomainDoc`. They run under `node:test` + `assert/strict`, consistent with the rest of the test suite.

### Grep guard

Mechanical regression guard run by the implementer (and the reviewer) before merge:

```sh
grep -rn "docs/adr/00\(20\|23\|24\|26\|27\|28\|29\|30\|31\)" \
  --include="*.md" --include="*.mjs" \
  --include="*.js" --include="*.ts" \
  -- .
```

Expected results:

- The nine redirect stubs at `docs/adr/00XX-…md` (each contains its own old path in the file's first heading line — that is fine).
- The historical conversation doc `docs/conversations/custom-spec-runner-grill-02.md` (name-only mentions, left alone).

Any other result indicates a missed link.

### Visual diff review

The reviewer confirms:

- All nine moved files exist in `apps/claude-code/unic-archon-dlc/docs/adr/` with their new numbers and slugs.
- Each renumbered file carries the "Renumbered from monorepo-root ADR-NNNN" trace under Status.
- ADR-to-ADR supersession references inside the moved set use the new numbers.
- The nine redirect stubs at root use the stub format above and link to the correct new paths.
- The four sweep-target files (`CONTRIBUTING.md`, `docs/agents/feature-runner.md`, `docs/process/ai-development.md`, `docs/process/development-workflow.md`) link to the new paths.
- `apps/claude-code/unic-archon-dlc/docs/adr/README.md` index table lists all ten ADRs.
- `CONTEXT-MAP.md` Relationships section contains the one-line ADR split note.
- `docs/agents/domain.md` matches what `/unic-archon-dlc:setup` produces against this repo (i.e. is not hand-edited).

### Build / lint gates

- `pnpm check` — Biome + Prettier on the whole tree.
- `pnpm typecheck` — `tsc --checkJs --noEmit` over `.mjs` sources.
- `pnpm --filter unic-archon-dlc test` — node:test for the plugin (covers the extended `install-agent-docs.test.mjs`).
- `pnpm test` from root — runs the full per-package test sweep.
- `pnpm --filter unic-archon-dlc verify:changelog` — guards the CHANGELOG entry for the new patch version.

## Out of Scope

- Any change to the retained root ADRs (0001–0019, 0021, 0022, 0025). These are genuine monorepo-wide decisions and stay at root.
- Any change to `LICENSE` files anywhere in the tree (root doctrine — maintainer-managed).
- Touching `docs/conversations/custom-spec-runner-grill-02.md`, the dogfood-banner PRD, or any other historical-only reference.
- Renaming or restructuring the `apps/claude-code/unic-archon-dlc/docs/adr/` directory itself.
- Adding any new vocabulary term to `CONTEXT.md` (glossary stays untouched).
- Touching the per-plugin `docs/plans/` directories — handled by the cleanup chore PR.
- Refreshing per-plugin `CLAUDE.md` / `AGENTS.md` files — tracked separately in #125.
- The dogfood-banner change — already shipped (#124).
- Any implementation against this PRD itself — the PRD is the deliverable; implementation follows via `/tdd` once the issue is picked up.

## Further Notes

- The reshelving is reversible: the moves are renames + content edits in one PR, and a follow-up PR could swap the directions if the convention is later revised. The redirect stubs guarantee external links keep resolving regardless.
- The `unic-archon-dlc` plugin is still not operational as a Feature Runner in this repo (manual `/tdd` remains the path per the soon-to-be-renumbered ADR-0009 and ADR-0010). The reshelving makes the harness-internal scope of those decisions structurally explicit without changing operational practice.
- Future harness ADRs go straight into `apps/claude-code/unic-archon-dlc/docs/adr/` from inception. There is no expected back-pressure to revisit this split.
- The generator change is intentionally light: it adds one informational bullet, not a structural shift. A future Consumer using a multi-context layout will see the same wording without any plugin-specific assumption leaking through.
- Tag for the patch release will be `unic-archon-dlc@<new-version>`, created automatically by the release workflow on merge to `main` (ADR-0018).
