# Domain Docs

How the engineering skills should consume this repo's domain documentation.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per plugin context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- Per-plugin ADRs live at `apps/claude-code/<plugin>/docs/adr/`.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT-MAP.md                          ← points to per-plugin contexts
├── docs/adr/                               ← monorepo-wide decisions
└── apps/
    └── claude-code/
        ├── pr-review/
        │   ├── CONTEXT.md
        │   └── docs/adr/
        ├── auto-format/
        │   ├── CONTEXT.md
        │   └── docs/adr/
        └── unic-confluence/
            ├── CONTEXT.md
            └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept isn't in the glossary yet, note it for `/grill-with-docs` rather than inventing new language.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly:

> _Contradicts ADR-0007 (…) — but worth reopening because…_
