# Reviewer prompt

Fill `<N>`, `<SHA>`, `<TICKET>`, `<scratchpad>`, `<role>` and `<round>` for each reviewer. Append the
reviewer's agent file body when the probe fell back to `general-purpose`.

```text
Review PR #<N> in unic-agents-plugins at head <SHA>: `git diff origin/develop...<SHA>`, against issue #<TICKET>, whose body and comments are the spec. Read no earlier review and none of the PR's comments first.
Edit, commit and post nothing. Probe in fresh `git clone --no-local` copies under `<scratchpad>/<role>-r<round>/`, never in an existing clone and never in the scratchpad root, which the other reviewers share.
Leave `~/.config/unic/nda-denylist.txt` unread, and print no term from it.
In your final answer: each finding with a severity (Critical, High, Medium, Low), whether you reproduced it, and the file and line at <SHA>. End with a plain answer: is there a reason not to merge?
```

## NDA block

Append it when the ticket touches the NDA guards (`SKILL.md` § When the ticket touches the NDA
guards).

```text
Test a guard with a synthetic term only, such as `zorblax`, from a temporary file that `UNIC_NDA_DENYLIST` points at.
For every refusal you test, assert on the message as well as the exit code. For the Claude hook, exit 2 is the only blocking exit.
```
