# Additive parallel paths for Doc Context extensibility, no plugin registry yet

Spec 10 hardcodes one path: ADO work items → Confluence pages. Future sources (Jira,
GitHub Issues, GitHub Wiki, Notion, etc.) are anticipated but not yet needed. Two
architectural approaches were considered:

**Additive parallel paths** (chosen): each new source gets its own client script
alongside `confluence-client.mjs`, and the Doc Context gathering phase in
`review-pr.md` step 4a adds a parallel branch for it. No shared abstraction layer.
Structure grows by addition, not by configuration.

**Plugin registry / config-file** (deferred): a declarative config file (similar to
`docs/agents/issue-tracker.md` in the `setup-matt-pocock-skills` pattern) lists which
work item trackers and doc sources are active for a given install. Generic dispatching
logic reads the config and routes to the right client. Clean once there are many
sources; overhead before there are.

We chose additive parallel paths because there is currently one work item source (ADO)
and one doc source (Confluence). The registry abstraction would cost more in design and
maintenance than it saves at this scale. The condition to revisit: when a third distinct
source type is added, that is the signal to introduce a registry rather than a third
parallel path.

**Status:** Accepted (2026-05)

**Considered alternatives:**
- Plugin registry / config-file dispatch — rejected for now: premature at one source
  each; revisit when a third source type is introduced

**See also:**
- `docs/inbox/alternative-work-item-sources-for-doc-context.md`
- `docs/inbox/alternative-doc-sources-for-doc-context.md`
