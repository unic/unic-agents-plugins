# Reviewer prompt

Fill `<PR>`, `<SHA>`, `<TICKET>`, `<scratchpad>`, `<role>` and `<round>` for each reviewer. `<role>`
is a slug of the reviewer type with no colon, such as `code-reviewer`. Append the reviewer's agent
file body when the probe fell back to `general-purpose`.

```text
Review PR #<PR> in unic-agents-plugins at head <SHA>: `git diff origin/develop...<SHA>`, against issue #<TICKET>. The spec is the issue body and its agent brief comment, which starts with "## Agent Brief" after the triage disclaimer. Ignore openers and other comments. Read no earlier review and none of the PR's comments first.
Edit, commit and post nothing. Probe in fresh `git clone --no-local` copies under `<scratchpad>/<role>-r<round>/`, never in an existing clone and never in the scratchpad root, which the other reviewers share.
Leave the NDA term list unread, whether `$UNIC_NDA_DENYLIST` names it or it is `~/.config/unic/nda-denylist.txt`, and print no term from it.
In your final answer: each finding with a severity (Critical, High, Medium, Low), whether you reproduced it, and the file and line at <SHA>. End with a plain answer: is there a reason not to merge?
```

## NDA block

Append it when the ticket touches the NDA guards (`SKILL.md` § When the ticket touches the NDA
guards).

```text
Test a guard with a synthetic term only, from a temporary file that `UNIC_NDA_DENYLIST` points at. For a probe that pushes this repository's history, make up a fresh term and confirm `git log --all -S <term>` prints nothing.
For every refusal you test, assert on the message as well as the exit code. For the Claude hook, exit 2 is the only blocking exit.
```
