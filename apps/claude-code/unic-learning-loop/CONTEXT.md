# unic-learning-loop

A Claude Code Plugin that collects what a team learns about its repository from Claude Code sessions into one reviewed rules file.

## Language

**Cadence Gate**:
The `Stop` hook's test for whether a Read-back is due: enough turns, enough time, and a transcript that has grown.

**Read-back**:
One run of `/unic-learning-loop:learn`, from reading the transcripts to the developer's yes or no.

**Draft Artefact**:
The proposed new content of the Learned Rules File, shown as a diff and held in the session. It becomes a file only on the developer's yes.

**Learned Rules File**:
`.claude/rules/learned.md`, the only file v1 writes in a Consumer.

**Bookmark**:
The start time of the last finished Read-back. The next Read-back reads only transcript lines after it.
