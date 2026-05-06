# ADRs — pr-review plugin

Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root.
See the root `docs/adr/README.md` for format and numbering conventions.

## Index

| ID   | Title                                                                                   | Status     |
| ---- | --------------------------------------------------------------------------------------- | ---------- |
| 0001 | Canonical bot signature                                                                 | Accepted   |
| 0002 | Signature-based prior-review detection                                                  | Accepted   |
| 0003 | Target latest PR iteration                                                              | Accepted   |
| 0004 | Incremental diff baseline                                                               | Accepted   |
| 0005 | Four-state thread classification                                                        | Accepted   |
| 0006 | Reply to existing threads instead of opening duplicates; auto-resolve addressed threads | Accepted   |
| 0007 | Summary comment is rewritten on re-review, not appended                                 | Superseded |
| 0008 | Soft dependency on pr-review-toolkit                                                    | Accepted   |
| 0009 | Re-review summary delta is posted as a reply to the existing summary thread             | Accepted   |
| 0010 | Inline Confluence client                                                                | Accepted   |
| 0011 | Additive parallel paths for doc-context extensibility                                   | Accepted   |
