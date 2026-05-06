---
title: alternative doc sources for doc context enrichment
created: 2026-05-06
---

alternative doc sources for doc context enrichment:

Spec 10 follows links from work item descriptions to Confluence pages. Work items in
any tracker (ADO, Jira, GitHub Issues) may also link to other documentation systems:

- GitHub Wiki (linked from GitHub Issues or ADO work items)
- Notion pages
- SharePoint / internal portals
- Any other URL a work item author might paste

Each doc source needs its own client script following the `confluence-client.mjs`
pattern. The Doc Context Sub-agent for a work item would detect the URL domain and
dispatch to the appropriate client.

Needs grilling to decide: auto-detect by URL pattern vs. explicit config declaring
which doc sources are active. Credential handling per source also needs design.

Relates to: `alternative-work-item-sources-for-doc-context.md` (same extensibility
dimension, different axis).
