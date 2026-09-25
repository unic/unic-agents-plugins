# Dispatching agent work, and keeping what comes back

How to hand a ticket to an agent session, when to rewrite what you handed it, and where a session's
learnings go so the next one has them. Written from this repository's streams; the rules are dated
and each one cost something.

Its companions: [`orchestrator-and-wayfinder.md`](orchestrator-and-wayfinder.md) for who does what,
and [`agent-tool-traps.md`](agent-tool-traps.md) for the tools themselves.

Issue numbers here are this repository's own and public — they are the evidence, so they stay.
Anything naming a customer repository lives in the orchestrator's untracked notes instead.

## The opener is a ticket comment, not a message

A prompt that lives only in a chat message dies with the session that wrote it, and the worker
cannot find it. So the output for a ticket is a comment **on that ticket**; the worker then reads
its own opener.

### The shape that has worked

1. **What it produces**, in one line, and which skill to invoke — plus which to _not_ invoke, and
   why. Name the tempting wrong route where someone would take it.
2. **Read order, numbered.** Not a bibliography: the order matters, and say what each item gives.
   Put a comment ahead of a body when the comment supersedes it.
3. **The one trap that costs an hour**, under its own heading. Exactly one. If you cannot name a
   single worst trap, you have not understood the ticket well enough to write its opener.
4. **The decision the ticket does not make**, if there is one. This is the most valuable section you
   can write and the one a ticket body almost never contains. Find it by asking: _what would two
   competent implementers do differently here?_
5. **Other traps**, as a list. Cheap to read, cheap to skip.
6. **The bar that proves it.** Name the check that distinguishes a real fix from a plausible one,
   and say what a _false_ pass looks like. "The suite passes today while every command is broken" is
   worth more than any instruction.
7. **What to do on landing** — version, changelog, which tickets to tell, which repositories.
8. **The report-back clause** (below).
9. **The review and handover flow.**

### Rules the shape has accumulated

Each is dated to the day it was adopted, and each came from a session that went wrong without it.

- **A research ticket's named source is a hypothesis** (2026-08-23, #378: nineteen named pages held
  nothing and the answer sat one folder away). Standing line: _if the named source does not answer
  the question, search for one that does before concluding it cannot be answered._
- **When a criterion adds a field an agent reads back from a previous run, name the surface that
  writes it** (2026-08-24, #394: the first-pass fix wrote a reader with no writer; both review axes
  caught it, the author's re-read did not).
- **A fix that adds a cross-reference is checked by reading the target, in the same pass**
  (2026-08-24, #407: two of iteration 2's criticals were introduced by iteration-1 fixes — a pointer
  to a section that stated no field names, and a commit pin a third file had outrun).
- **Read a ticket's open questions for the missing definition _between_ two of them**, not only for
  gaps inside each (2026-08-25, #404: a grilling stopped dead on "how is this contract different
  from the spec page?" — no artefact drew the derived-versus-authored line, and once drawn, a whole
  open question dissolved instead of being answered).
- **When a report's own count contradicts the specification's intended count, record the ambiguity
  as the finding** rather than picking a reading (2026-09-02). A leg report carries counts; a
  decision record carries the intended count; the opener asks for the comparison.
- **A grilling opener names the skill the maintainer must type.** A worker sent to a
  model-invocable grilling ran it alone for six rounds, the companion skill never joined, settled
  decisions had nowhere durable to land, and two rounds drifted to "write the documents better"
  (2026-09-02, #441). Check the frontmatter for `disable-model-invocation` before naming any skill
  as an opener step.
- **A grilling that spins off a ticket touching the same file as its own criteria says which lands
  first** (2026-09-02, #441/#452). Without that sentence the frontier reads them as parallel and two
  workers edit one file.
- **When a fact lives on two surfaces, name the surface** (2026-09-02, #452/PR #454: an opener
  listed a status set from a README index column while the criteria governed a decision record's own
  status line — 25 distinct file-level lines, none spelled like the index).
- **The four reads run twice — once on the criteria, once on the diff** (2026-09-03, #441/PR #455).
  Eleven criteria came out of six grilling rounds and still shipped a set whose halt rule and record
  rule cancelled each other. **The gap was not between two criteria; it was between a criterion and
  an unchanged line three lines above it in the file being edited**, which no reading of the ticket
  reaches. Grilling a ticket well does not retire the four reads at review time.
- **Never tell a worker to un-draft without checking who drafted it** (2026-09-03). A maintainer had
  drafted it deliberately; the worker refused and was right. Read the pull request's own timeline
  before naming a pipeline step.
- **Measure the absence before grilling the fix** (2026-09-03, #438). A ticket said thirteen
  findings "reached nowhere"; they were in the run's own report on its own branch the whole time,
  and one `git show` closed a p1. Standing line for any ticket alleging something is missing:
  _open the place the artefact would be if it worked, on the branch the run produced, and say what
  you found; trace the writer first — grep the field, find its one reader, check whether that node
  ran._ A false absence propagates faster than a false presence, because nobody re-opens a file to
  confirm something is still not there.
- **Harvest before any forced cleanup; terminal is not consumed** (2026-09-02). A run that had died
  inside its final node had its whole product complete and unposted inside the worktree that the
  cleanup then deleted. Opener wording: _copy the artefacts directory out of the worktree first, or
  do not complete a run whose output was never consumed; a failed status says nothing about what is
  on disk._
- **An opener cites a durable document; it does not restate it** (2026-09-02). Once a rule and its
  recovery procedure live in a repository's own guidance, the opener links to that section.
- **Absolute paths in every shell call** where `cd` does not persist between calls, and **never a
  foreground `sleep`** where the harness blocks it (2026-09-02) — it kills the compound command
  silently, so a polling read comes back as "nothing yet".
- **Read the frontier from the native dependency graph, never from a handoff table** (2026-08-20:
  a table dropped one open blocker and kept a reversed edge, and a ticket was dispatched over an
  undecided prerequisite). See [`issue-tracker.md`](issue-tracker.md). When a dependency reverses,
  flip the native relation in the same edit as the prose. A dispatch against an open `blockedBy`
  carries a written reason.
- **An isolation run's read list is closed** (2026-08-31: three attempts leaked three times, each
  through an instruction to read something). Name the comment ids and file paths, never "all
  comments" or "the history", and open each item before sending to see what it holds now.
- **A run that measures improvement gets the method on its ticket, never the expected findings**
  (2026-08-31). The worker reads the ticket, so a listed expectation becomes an instruction. Seal the
  prediction where the worker never reads it, and check it yourself afterwards.
- **An item that edits the maintainer's own files goes to the maintainer as a proposal** (2026-09-17).
  A peer session cannot grant permission over a person's files. Ask the maintainer first, then
  write the brief as "the maintainer approved X on <date>; do X".
- **Retire an instruction out loud when its reason expires** (2026-08-31: a worker blocked, rightly,
  on a stale "do not hand-fix" beside a new "proceed to the fix"). Say "retracting X, because its
  reason is gone" in the message that gives the new one, and write the reason into an instruction
  when you first give it.
- **When a pull request is closed for bad criteria, the re-dispatch opener forbids reading it**
  (2026-08-05, PR #307). Its diff and its review comments carry the wrong pattern. Name the pull
  request, the reason and what it contains.
- **When two tickets both falsify one sentence, split ownership by claim, not by file location**
  (2026-09-03, #430/#439). Count the claims in a sentence you were told to leave alone; if your change
  falsifies one, say so and quote it. Name the sentence by what it tells the reader, never by line or
  clause position.
- **A ticket whose output is visual names a design checkpoint where the maintainer sees the
  rendered item, before the bulk of the work** (2026-09-25, #563/#564). #563's diagram was shaped
  with the maintainer over several rounds and came out as wanted. #564's opener named no such
  point. The worker drew five diagrams and exported ten PNGs alone. The maintainer steered one
  layout choice from the worker's prose descriptions, because the screenshots the worker read were
  visible only to the worker, and first saw the diagrams after the pull request was open. Every
  change from then on re-ran the render and the export, and HTML commits needed a per-commit guard
  exception while #566 was open. Standing line for a visual ticket: _draw one item, show the
  maintainer the rendered file or its export, iterate, and only then draw the rest and export._ A
  description of a diagram is not that checkpoint. The tool's own checks do not replace it either:
  all nine Archify checks passed on designs the maintainer then changed.

### Before you post one: the four reads

Applied to the criteria you are about to point a worker at.

- **Read them as one set.** The dangerous shape is a gap between two that an implementer fills with
  a defensible-sounding decision. #389's nine criteria stopped at four files while five other
  readers of the deleted keys went unnamed.
- **Turn the diagnosis on the cure.** If the ticket says a thing rots because it is hand-written,
  ask what is still hand-written in the fix.
- **Ask which criteria are satisfied by changing nothing.** That is fine when it is true — say so in
  the opener so nobody hunts for work that is not there.
- **List what the ticket did not decide.** "Either is acceptable" and "whichever fits" are where an
  unanswered question hides. Each becomes section 4, or goes back to its owner.

If a ticket needs grilling before it can be dispatched at all, say so rather than writing an opener
over an undecided question.

## The pipeline a ticket ends in

The shape, for any ticket that ends in a pull request. The concrete commands differ per repository
and belong in the orchestrator's configuration.

1. **Open the pull request.** Where a reviewer bot is triggered by un-drafting, open as a draft.
2. Further fixes and commits on the branch are fine.
3. **Implementation done → self-review**, by whatever review flow that repository requires.
   - **Iteration 2 is mandatory, not politeness** (2026-08-23): the author marking findings `fixed`
     is the author grading their own homework. One reconcile pass found two "fixed" findings still
     present and two factual errors headed for merge. It works on prose-only diffs too.
   - **Fixing a finding closes its thread, in the same pass** (2026-08-24). Reply with the fixing
     commit, then resolve. Say in the reply when the verdict is hand-verified rather than
     tool-measured, and name any judgement the closure rests on. **Never resolve a review workflow's
     own summary thread** — it stays open by design.
   - **Post one summary comment** after acting on a multi-axis review: findings per axis, what was
     fixed with commit refs, what was refuted and why, plus a named **"what both axes agreed on"**
     section (2026-08-24, #409 — the convergence row was the most useful line and a per-axis format
     nearly lost it).
   - **When a merge resolves a version bump upward, grep the changelog body for the old number, not
     just the heading** (2026-08-24, #409: a migration note keyed off a version that stopped
     existing in the merge).
   - **On close, move the state label to `resolved`** — nothing in the merge path does it, so an
     unattended ticket otherwise closes still wearing `ready-for-agent` and the queue fills with
     closed tickets that look dispatchable (2026-08-24, #394).
   - **When a document records upstream provenance, record a commit and state what would make it
     stale** (2026-08-24, #394 hit the moving-fact defect three times in one ticket: a branch tip, a
     "still unmerged", a pre-tag version).
   - **Run every step a review workflow prescribes, or ask before skipping one** (2026-05-29,
     PR #168: a skipped toolkit step was the one that found the defects).
   - **An edit to a document an agent reads top-down gets a third review axis** (2026-08-28). A
     skill, an `AGENTS.md`, a `CLAUDE.md` or a `docs/agents/` file is read in order, and neither the
     Standards nor the Spec axis asks whether it is shaped for that. Read it against
     `writing-for-agents`: the thing to do first, reasons after. A prohibition listed before the
     working command makes the banned shape more available. After pruning, re-read what remains.
   - **Review the shell snippets inside agent `.md` prompts by hand** (2026-06-05, PR #198). CI never
     runs them, so a `jq`, `awk` or `sort` passes every job and fails on Windows git-bash. Use
     `node -e` or a `node` helper instead.
   - **Do small follow-ups that only make sense now, rather than filing them** (2026-08-04,
     PR #293). An issue filed for context-bound work rots, because the context stays in the session.
     File only work that needs a decision, a dependency or a slot.
4. **If the pull request was opened as a draft only to hold the reviewer off, flip it once checks
   are green by exit code** — never on the worker's own judgement, and never at all when someone
   drafted it deliberately. Read the timeline first; see the rule above.
5. **Read every review body to the end, not the thread list.** A review can carry a finding with
   **zero inline comments**: the body's `<details>` ends with
   `Suppressed comments (n) — Previously missed (n)`, naming a `path:line`, so it opens no thread,
   sends no notification, and reads as a pass in every check that counts threads. **A zero-comment
   review is the dangerous one.** Two of six rounds on #455 were this shape and both findings were
   real. Check `.commit_id` too: a review fired on a pre-fix commit reports stale findings, and the
   newest push may have no review yet.
6. **Cap the rounds, but judge by what a round produced, not by its number** (sharpened 2026-09-03,
   #455). The cap exists to stop a fix-review-fix spiral, so count the rounds your own fixes
   provoked. Two rounds there generated zero new comments each and still each carried one correct
   finding, so they were authorised past the cap with a hard stop after; the next round came back
   clean, which is a better place to end than on a cap. Say in the handover which rounds were which.
   - **After applying any review's fixes, re-read the fixes as a set**, and ask whether they
     multiplied the surface they were meant to reduce — **and ask it about the paragraph you just
     edited, not only the diff** (2026-09-05, PR #461: two rounds in a row were rules bolted beside
     an existing rule instead of replacing it; each criterion still read satisfied, so a
     criterion-by-criterion check saw nothing). The rule that worked: **rewrite the paragraph whole,
     then re-read the paragraph whole.** "Is this true?" is not enough — ask "is my fix the right
     shape?".
7. **Handover.** After the **last** commit, not the first (2026-08-23, #378: a description was
   re-read, then a fix commit changed the diff shape and the stale one-file description shipped on a
   four-file diff), the worker re-reads its own pull-request description and re-verifies every claim
   against the final diff. Evidence a later commit falsified is corrected, never left standing. Then
   it sends the four report fields plus the URL, and the merge owner reviews and merges.

Two guards, adopted 2026-08-20 after a commit landed on a local integration branch because an IDE
switched the branch under a working session:

- **All feature work happens in a git worktree, never a shared main clone.** Two actors on one
  working tree is the whole failure mode, and the reason is peer traffic, not build isolation: one
  session moved a shared clone to the integration branch under another session's five uncommitted
  files, and recovery worked only because the edits were uncommitted. Put worktrees **outside** the
  clone — a linter that ignores a dotted directory will skip a worktree hidden inside it. This rule
  does not reach a subagent the Agent tool spawns with `isolation: "worktree"`, because the tool
  picks that path; see [Judging a command](agent-tool-traps.md#judging-a-command).
- **`git rev-list --count origin/<target>..HEAD` before every push** in a repository the session
  does not hold exclusively. A zero or absurd count means **`HEAD` is not where the session thinks
  it is** — the branch was switched underneath it — which is the failure this guard was adopted
  for. It says nothing about the remote: the local `origin/<target>` is a cached ref, so a target
  that advanced on the server leaves the count unchanged. To catch that, `git fetch` first and
  compare the `origin/<target>` OID against the one the session started from.
- **Push early from a worktree, and check its path exists after any idle gap** (2026-08-25: a
  worktree outside the clone was deleted by no session, and nothing was lost only because
  everything had been pushed).

## When an opener goes stale

Openers rot. Four rules settle who fixes them and when.

### The orchestrator rewrites; the worker reports

The worker has the freshest knowledge of its own ticket and the worst view of everything else. It
finishes with its most context-polluted window, it does not hold the frontier order, and it has a
mild interest in how its unfinished work is described.

More decisively: **the learning that matters most is usually not about the ticket that produced
it.** One session learned that a plugin environment variable is unset while installing command
definitions; the consequence was a _different_ ticket's priority and premise. No worker could have
drawn that line — it needs the map. So the worker sends four fields and stops.

### Write the opener at dispatch, not at filing

An opener written when a ticket is filed rots for as long as the ticket waits. A ticket gets
criteria when it is filed, and an opener when it is about to be dispatched. The frontier ticket
carries one; the three behind it should not, until they move up.

### Edit in place before dispatch; supersede after

| State                                                  | What to do                                                                                                                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No session has started                                 | **Edit the opener in place.** One opener, no ambiguity.                                                                                                                                                                                   |
| A session is running against it                        | **Post a superseding comment** naming what changed, **and message the running session** — a correction that reaches the ticket but not the session tripping over it has done half its job. Never silently rewrite under a running worker. |
| The ticket's _criteria_ are wrong, not just its advice | Amend the **body**, and say on the ticket that you did. Amend the ticket rather than merge a green pull request against bad criteria.                                                                                                     |

A body is a specification; an opener is advice as of a date. Specifications get corrected; advice
gets superseded.

**The newest opener wins, so mark a superseded one in place** (2026-08-20). `gh issue view
--comments` reads oldest first, so an unmarked stale opener is followed by default. Edit the old
comment to open with "**Stale — do not follow**" and a pointer to the new one.

### A freshness check you can actually run

Before posting or re-posting an opener, re-verify every claim that names a moving part — a ticket
state, a priority, a version, a commit, a file path, a line count. Each one is a command. An
opener-shaped claim about stale files once turned out to be `git show HEAD:…` run from the wrong
branch, and it reached a commit message before anyone caught it.

**If a claim cannot be re-verified in one command, it probably does not belong in an opener.**

## Keeping current: the learning loop

Nothing pushes a worker's learnings at the session that dispatched it. So build the channel, and
note the shape of the lever: **you write every worker's prompt, so you can put your own feedback
channel into all of them.** That clause is the difference between a coordinator that ages well and
one that is stale in a week.

### Get a name workers can address

Messaging needs a stable target, and a session's name comes from `/rename`, not from a file.
Confirm your own name before writing any opener and put that address in every prompt. **On a seat
change the old name dies with its session** — re-point the report clause in any opener whose ticket
is still open.

### Put a reporting clause in every prompt

```text
BEFORE YOU FINISH, AND WHENEVER YOU LEARN SOMETHING THAT WOULD HAVE CHANGED THIS PROMPT,
report to <the live session name> with four things and nothing else:
  1. what you expected
  2. what happened
  3. the command or file that proved it
  4. whether it changes only this ticket, or every session in this repo
Send it when you learn it, not only at the end — a session that dies unreported
takes its learnings with it.
Talk only to <the live session name>. Do not message another orchestrator or its
sessions; tell <the live session name>, who relays it.
```

**A child session talks only to its own orchestrator** (2026-09-23, maintainer's rule). When a
child messages another seat's orchestrator directly, a fact can land with that seat and never reach
its own, and the next child of its own seat starts without it. The orchestrators relay between
seats.

Point 3 is load-bearing. A report without the command that proved it is an opinion. Point 4 tells
you where the learning goes.

### Pull, on your own cadence

Do not wait to be told. Each time you resume: list the live sessions and ask any you have not
spoken to what they found; re-read the map and the comments on every open frontier ticket, because
sessions record there even when they forget to message; and read the log of the integration branch
in every repository since you last looked. An integration branch moving under a running session is
how a change first reaches that session's context, unannounced.

### Route each learning by its lifetime

| The learning changes…                               | Write it to                                           | Why                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| any future session, on any machine                  | repository guidance, in git                           | reviewable, and the only destination that survives a machine or reaches a second person    |
| only sessions on this machine, at this project path | project memory, plus a pointer in its index           | loaded automatically, and lost with the machine — so a convenience, never the durable copy |
| this stream's plan or order                         | a comment on the ticket, or the map's body            | survives your session; the next coordinator reads it first                                 |
| one ticket's criteria                               | that ticket's body, and say on it that you amended it | amend the ticket, never merge against bad criteria                                         |
| nothing outside the run                             | leave it in the transcript                            | not everything earns a file                                                                |

**Project memory is not durable across machines.** Measured 2026-09-17: of twenty memory keys cited
across one stream's own notes, three existed on disk — the rest had been promoted to project memory
and lost when the machine changed, because that memory is keyed to a project path on one machine.
So the first row is the durable route and the second is a convenience: anything you would mind
losing goes into repository guidance, which is what this file is. If you write it to project memory
because it loads automatically, write it to git as well.

**Project memory is an inbox, not a store.** A session writes to it because it is instant and a
commit is not, so treat each entry as waiting for its place in git:

1. Every new memory names its destination in its frontmatter, as `destination:` under `metadata:`.
2. The destination is the first of these that fits:
   - a trap in a tool (git, `gh`, pnpm, Biome, Archon, Azure DevOps, Copilot):
     `docs/agents/agent-tool-traps.md`;
   - a rule about dispatching, openers, review or verification: this file;
   - a fact about one plugin: that plugin's `AGENTS.md` or `CONTEXT.md`;
   - a fact only one orchestrator seat acts on: `.orchestration/<seat>/LESSONS.md`, which is
     gitignored, so a fact naming a client goes here and never into a tracked file;
   - `memory`, only when the fact applies to every session and fits none of the above.
3. An orchestrator promotes the entries at each handoff: it writes each fact to its destination,
   deletes the memory file and removes its index line. A session with no orchestrator promotes its
   own entries before it ends.

Claude Code loads only the first 200 lines or 25KB of `MEMORY.md`, whichever comes first. On
2026-09-23 the index of this repository reached 24,142 bytes, and 33 of its 138 entries repeated
a rule already in git. Promotion at every handoff keeps the index small enough that it never needs
a sweep.

### Close the loop out loud

When a worker's report changes a prompt you already wrote, **tell the session running it.** A
learning that reaches the map but not the session currently tripping over it has done half its job.

### What this cannot do

A session that dies without reporting takes its learnings with it, and you will not know it existed
unless it still shows in the session list. That is why the clause says _send it when you learn it_.
Treat a silent session that has been busy a long time as a question to ask, not as progress.

## Process patterns worth enforcing

- **Read the criteria as one set.** #389's nine criteria stopped at four files while five other
  readers of the deleted keys went unnamed. Reading them together caught it; reading them one by one
  would not have.
- **A criterion whose evidence lives outside the artefact is half a criterion.** #389's AC-6 claimed
  every installed file matched the source; only one appeared in the diff.
- **A fix that is committed and inert is worse than no fix**, because it removes the pressure to
  find the real one. A configuration key sat at the wrong path for weeks while being cited in prose.
- **Running the tool against a real consumer finds what tests cannot.** Two review runs against one
  small pull request produced four real defects in the tool itself.
- **A bar written from the defects you found detects those defects and nothing else** (2026-08-28).
  Name the property that makes each a defect, then ask which instances your wording misses. For a
  claim carried over from another branch, the bar is that every present-tense claim about repository
  state is checked against the target branch, whatever the sentence cites as its authority.
- **A step described as always running is a claim about every branch above it** (2026-08-24, #396:
  a version check stopped on equal versions, so the "unconditional" step never ran on the common
  path). Walk the most boring input through.
- **A new issue names the ADRs it adds by slug, not by number** (2026-08-03). Tickets in flight take
  numbers first, so a number written today is a collision or a dead pointer later. Say the number is
  taken at authoring time.
- **Before round 1 of an audit, list what only the maintainer can decide, and put it to him once**
  (2026-08-13: tickets with an undecided question took six and seven rounds; one without took two).
  Keep each amendment's mandate narrow, never let the amender audit its own work, and publish each
  round's brief before spawning the amender.
- **An audit brief carries the defect, its evidence and what a human must decide** (2026-08-13).
  Not the reasoning that reached them. A brief on an open ticket expires as the branch moves, so
  re-run the audit after a few days of merges rather than trusting it.
