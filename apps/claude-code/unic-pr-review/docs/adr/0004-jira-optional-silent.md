# 0004. Jira is optional and silent when not configured

**Status:** Accepted (2026-05)

## Context

Not all Unic projects use Jira. Requiring a Jira URL would block Consumers who only use Azure DevOps and Confluence. The doctor command must not fail when Jira is absent.

## Decision

When `jiraUrl` is absent from `~/.unic-confluence.json` and `JIRA_URL` is not set, all Jira-related steps (reachability check, work-item enrichment) are silently skipped. No warning, no notice, no output.

## Consequences

- The doctor output contains no mention of Jira when it is not configured.
- Teams that set up Jira later do not need any other change — just add `jiraUrl` to the credential file.
- Silent skip means misconfigured (URL present but wrong) is the only failure mode.
