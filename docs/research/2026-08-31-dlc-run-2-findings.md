# Run 2 findings register — `profile-card`, 2026-08-31

One register for everything the second `unic-archon-dlc` run produced, so the findings stop living in
five places. Sources harvested: [WI 43004](https://dev.azure.com/FZAG/dxp/_workitems/edit/43004)
comments, threads on PR 5825, 5834 and 5835, the `implement-review-precheck` node output recovered from
`~/.archon/archon.db`, and the orchestrator handoff.

## What the run was

Run 1 built `profile-card` in `DXP-DesignSystem` in August. A person then fixed several things by hand.
Documents were written so a second run would not need those fixes — `CLAUDE.md`, `CONTEXT.md`,
`docs/agents/figma.md`, five ADRs. **Run 2 ran the same feature again to ask whether that prose carries
the knowledge.** Expected results were sealed off the tracker before it started, so the run could not
read its own answer key.

**The answer: the documentation reached the planning legs and the review nodes. It did not reach the
implementer.**

## Reading this register

`Found by` is a measurement, not bookkeeping — it is the evidence behind the dedup result below.

| Value               | Meaning                                                  |
| ------------------- | -------------------------------------------------------- |
| `precheck`          | `implement-review-precheck`, whose output reached nobody |
| `round1` / `round2` | the two `unic-dlc-pr-review` dispatches                  |
| `goals-check`       | the build Box's acceptance-criteria node                 |
| `worker`            | the session driving the run                              |
| `orchestrator`      | this seat, from comparing run 1 against run 2            |
| `maintainer`        | read at a gate                                           |

---

# A. `DXP-DesignSystem` — code

> **These are evidence, not a work list.** The decision on 2026-09-01 is **not to fix run 2's output**.
> PR 5835 and PR 5807 are both **abandoned**, branches kept. What matters about each defect below is
> what it proves about the chain — see **§F**, which is the actual plan.

Everything here is on `feature/43004_build-profile-card` at `5e683a7`, in **PR 5835, abandoned**.

## A1. Fixed in `5e683a7`, awaiting merge

| #   | Finding                                                                                                                                                                                                                                                                                            | Found by                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | **`cn()` drops bound token utilities.** `lib/utils.ts` extended only `theme.spacing` while `styles.css` declares custom `--color-*`, `--text-p*` and `--shadow-*` families. Four symptoms from one cause: icon size, lead font size, badge text colour, disabled card carrying two shadow classes. | precheck + round1                        |
| 2   | **A function-form `render` prop defeats the disabled guard.** `aria-disabled="false"` reached the DOM and the consumer's handler fired.                                                                                                                                                            | precheck + round1 + goals-check          |
| 3   | `argTypes` declared for 2 of 4 props on the parts meta, 3 of 4 on the root meta.                                                                                                                                                                                                                   | precheck + round1 + goals-check          |
| 4   | One `test`-tagged story called no `expectDomSnapshot`.                                                                                                                                                                                                                                             | precheck + round1 + goals-check + worker |
| 5   | Hover bound one of the three tokens WI 43013 names.                                                                                                                                                                                                                                                | precheck                                 |

**Note on #1.** `lib/utils.ts` carried an eight-line comment diagnosing the _general_ defect and fixing
it for `spacing` alone. The cure was not applied to the diagnosis.

## A2. Introduced by the fix commit `5e683a7`

| #   | Finding                                                                                                                                                                                                                                        | Found by                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 6   | Unreachable trailing return in `guardDisabled`.                                                                                                                                                                                                | round2 (65550)          |
| 7   | **The new `User2` `label` prop ships with no hand-declared `argType`** — breaking the criterion the same commit had just fixed on two other metas.                                                                                             | round2 (65543)          |
| 8   | Repeated Switches: one `label` null-check drives three attributes.                                                                                                                                                                             | round2                  |
| 9   | **Hover utilities on a disabled card.** `hover:bg-interactive-elevated-hover` and `hover:text-interactive-elevated-on-hover` are on the root of a disabled card. **UNRESOLVED — classes read, painted result never checked.** Needs a browser. | orchestrator            |
| 10  | The disclosed `outlineOf` change: the worker modified a test helper so its own change would pass, disclosed it, and asked to be challenged. **No reviewer mentioned it.**                                                                      | worker (self-disclosed) |

## A3. Open

| #   | Finding                                                                                                                                                                                             | Found by                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 11  | **No component root carries `dxp:font-body`, so all three render in the fallback face.** ADR-0005 requires it and **was written from run 1's hand fix of this exact defect**. Four reads missed it. | round2 (65545)            |
| 12  | Both icon-only badges ship with no accessible name. `User2` now has the capability; no story passes a label.                                                                                        | precheck + round2 (65546) |
| 13  | `BadgeMain` binds no icon size, so `<BadgeMain icon={<User2 />} />` renders a 16px glyph in a 40px pill.                                                                                            | precheck                  |
| 14  | Title weight uses stock `font-bold` rather than the bound `font/weight/bold` token.                                                                                                                 | round2 (65548)            |
| 15  | Shotgun Surgery: every new token scale must be hand-mirrored across `utils.ts` and `styles.css`, with nothing enforcing it.                                                                         | round1 + round2 (65549)   |
| 16  | Divergent Change: `snapshot.ts` ships both `expectDomSnapshot` and `getRealUserEvent`; the second does not snapshot.                                                                                | precheck + round2 (65551) |
| 17  | `@source inline("dxp:size-icon-l")` keeps alive a class no component writes — only a story hand-writes it.                                                                                          | precheck                  |
| 18  | `report.md` ships stale: three of its four uncovered criteria are closed at `HEAD`.                                                                                                                 | round2 (65544)            |
| 19  | `CardProfileMain` imports `useRender` from `@base-ui/react` where WI 43011 says a plain prop and the PRD says no runtime dependency. The dependency predates this diff.                             | precheck                  |

## A4. Kept by design, with justification on the thread

| #   | Finding                                                                         | Note                                                                                                        |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 20  | Focus-ring width names a tier-2 variable directly (65537).                      | Tailwind v4 has no theme namespace for outline width, so no utility can exist. **ADR-0004 amendment owed.** |
| 21  | `glyphOf` duplicated across two story files (65540).                            | Hoisting it into `snapshot.ts` worsens finding 16.                                                          |
| 22  | Prop prose in both the component comment and the `argType` description (65541). | Different readers, why versus what. Overrulable.                                                            |

## A5. Contested between reviewers — a documentation gap, not a code defect

| #   | Finding                                                                                                        | Note                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | A story asserts `[40, 40]` from `getBoundingClientRect`; 40 is `Icon/size-l` plus twice `spacing/default/XXS`. | **Round 1 praised the file for never doing this; round 2 filed it twice.** The bar does not say which side of the line a geometry assertion whose expected number derives from tokens sits on. **Settle the rule, then the finding decides itself.** |
| 24  | `classesAtRest` and `expectNoCardBranch` read class attributes.                                                | ~~Same drawer as 23~~ — measured false 2026-09-01 (43019): both capture a rendered class attribute and compare it to another render, naming no literal. Same shape as 23, but on the class half of the bar's rule, not the geometry half.            |

## A6. Fidelity — neither run got the component right

| #   | Finding                                                                                                                                                                                   | Found by     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 25  | **The badge and icon position within `card-profile-main` was wrong in both runs.**                                                                                                        | maintainer   |
| 26  | **The `fade` animation annotation is recorded in both runs' contracts and implemented in neither.** No `.tsx` or `.css` in either build carries a transition, animation or keyframe.      | orchestrator |
| 27  | **Storybook organisation and controls differ between the two runs**, from the same command version. Run 1's organisation is preferred. Nothing documents what the organisation should be. | maintainer   |

---

# B. Figma — owed to design, no code change fixes any of these

| #   | Finding                                                                                                                                                                         | Status                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 28  | Focus ring measures 2.48:1 against SC 1.4.11's 3:1; disabled title 2.95:1.                                                                                                      | **Filed as [Bug 43000](https://dev.azure.com/FZAG/dxp/_workitems/edit/43000)** |
| 29  | `icon/interface/User2` `Style=line` (`7133:49`) strokes a bare `black`; `get_variable_defs` returns `{}`. Unbacked literal. Located by `cmp` against the icon set's own export. | Owner unknown, unfiled                                                         |
| 30  | `badge-main` binds `spec-gap-inner-c` = 60, following none of the naming conventions of every other variable on that node. Nothing consumes it.                                 | Owner unknown, unfiled                                                         |
| 31  | Badge text node renders `typo/p-tiny` with an **11px fallback** while the token resolves to 12.                                                                                 | **Run 1 recorded it; run 2 did not**                                           |
| 32  | Hover badge text node carries a **raw hex `#01013b`** typed beside the token-bound colour.                                                                                      | Run 1 only                                                                     |
| 33  | Font style string reads `Inter:Regular` where sibling nodes read `Inter:regular`.                                                                                               | Run 1 only                                                                     |
| 34  | The card's width is a drawn **356 with `min-width: 356`** and no binding behind either number.                                                                                  | Run 1 only                                                                     |

**31–34 are the substance of the contract comparison.** Measurement density is _identical_ between the
two runs — 28 node ids, 15 hex values, 92 bullets in both card contracts. **Run 2 lost no facts and four
findings**, because run 1 read into the nested instance layers and run 2 did not. In the one case the
run explains itself — the animation annotation — it says it carried the fact forward from `figma.md`
rather than re-measuring. **The document existing is why the observation was not repeated.**

---

# C. `unic-agents-plugins` — the plugin and the process

## C1. Detection reaches nobody

| #   | Finding                                                                                                                                                                                                                                                               | Evidence                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 35  | **`implement-review-precheck` produced thirteen findings and recorded them nowhere.** Two lines in the log, empty artifacts directory. Recovered only from `~/.archon/archon.db`, `remote_agent_workflow_events`. Its own closing line: _"This node posted nothing."_ | Non-posting is a design choice; non-recording is not.                                                                             |
| 36  | **The `/specs` gate asks a human to approve an artefact nobody reads.**                                                                                                                                                                                               | **Filed as [#437](https://github.com/unic/unic-agents-plugins/issues/437)**, with the `/tickets` leg added as its second instance |
| 37  | **After the review, nothing exists for a developer to act on.** Twenty findings, threads posted, no artefact anyone picks up.                                                                                                                                         | maintainer                                                                                                                        |
| 38  | **A fact reaching a contract is not a fact reaching anything.** The animation annotation is the worked example: recorded twice, implemented never.                                                                                                                    | orchestrator                                                                                                                      |

## C2. Gates that are not gates

| #   | Finding                                                                                                                                                                                                                                                                                                                | Evidence                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 39  | **`open-pr` precedes `build-pr-gate`.** The run failed on `evidence_policy` _after_ PR 5835 was created and the gate was skipped on a `when_condition`. **A failed run shipped a complete, mergeable pull request and the human gate never ran.** Reversing them leaves nothing to review, which is the safer failure. | verified in the DAG                  |
| 40  | **A gate that is a config value has no safe middle.** With `gates.pr-review: afk` there is no pause; the config's own comment records that with it on _the chain approves it unconditionally every round_. The only lever either way is destroying the run, which loses every finding.                                 | `.archon/unic-dlc.config.yaml:74-79` |

## C3. The chain cannot verify its own work

| #   | Finding                                                                                                                                                                                                                                         | Evidence                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 41  | **CORRECTED 2026-09-03 — the row as first written overstated, and its replacement is the sharper finding.** Whether an Archon worktree has `node_modules` is **non-deterministic**: 12 of the 16 DXP worktrees on this machine have one, 4 do not, and every one that has it was created 5–13 minutes after its worktree, mid-run, by a node's own initiative — **no Box instructs any node to install**. So the defect is not "the review cannot run checks"; it is **"whether a check can run is a coin flip, and no node reports which way it landed"**. That kills any criterion satisfied by observing a green run, because a green run already happens by luck. | Reframes **#430**, and extends it to `pr-review` and `qa` |
| 42  | **Four acceptance criteria failed while `verification` returned PASSED**, minutes apart in the same run.                                                                                                                                        | the false pass, in one artefact |

## C4. Re-entry and branching

| #   | Finding                                                                                                                                                                                                                                            | Evidence                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 43  | **The re-entry idiom reads before it offers the choice.** `/specs` Step 2 and `/tickets` Step 2 both detect → read → summarise → ask, so **a re-run cannot be unanchored by picking a branch**. Property of the command text, so every repository. | plugin 0.26.0, `gitCommitSha 348f2319` |
| 44  | **Step 8 hardcodes `feature/specs/<slug>`** against the Consumer's `feature/<WI#>_<slug>`, and **overriding it was necessary, not stylistic** — a branch cut from `develop` would have restored the deleted PRD. Overridden in **both** runs.      | run 1 used `feature/42981_specs-…`     |
| 45  | Step 8 hardcodes the PR title `plan(<SLUG>): PRD and ADRs`, naming an artefact this run did not produce.                                                                                                                                           | no ADR crystallised                    |

## C5. `/specs` should grill, and check itself

| #   | Finding                                                                                                                                                                                                                                                                     | Evidence                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 46  | **A structural audit finds nothing; asking what the artefact promises finds everything.** Two legs, two audits that passed clean, two sets of real defects found by a reader. **Counting the checks a document declares is not checking whether each claim is true.**       | the run's clearest process result  |
| 47  | **`figma.md` declares a mechanical override test that the run did not run**, while three contracts said `Findings: none`. An unattended run ships that.                                                                                                                     | bucket 3, ran only on intervention |
| 48  | **The interview module is developer-hostile.** A grilling-style formulation is wanted instead.                                                                                                                                                                              | maintainer                         |
| 49  | **`/specs` should end with a review of what it produced**, feeding the PR review.                                                                                                                                                                                           | maintainer                         |
| 50  | **Testing seams are asked about cold and documented nowhere.**                                                                                                                                                                                                              | maintainer                         |
| 51  | **`/specs` Step 7's "read `figma.md` in Step 7 and not before"** fights the grilling Method the same command composes; ADR-0001 points at that file four times for facts about this component. Obeyed literally, the command grills the user for what the repository holds. | worker                             |
| 52  | **The chain writes requirements its own gates forbid.** PRD user story 26 wants the contract in the same PR as the component; contracts merge at the specs gate, components at the build gate. Caught three legs too late.                                                  | worker                             |

## C6. Tickets and hierarchy

| #   | Finding                                                                                                                                                                                                                                                                             | Evidence                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 53  | **Per-slice `test_command` filters and shared-component DOM snapshots are in tension.** Eight stale snapshots sat at `HEAD`. `/tickets` validates that a command exists, never that the set can see a cross-slice regression. _"The narrower I made the seam, the blinder it got."_ | worker, self-reported                     |
| 54  | **User Story named for the slug with Task children reads well in ADO** and should be a config value, not a convention nobody remembers.                                                                                                                                             | maintainer                                |
| 55  | `triage-labels.md` § Type maps every slice onto `User Story` and forbids `Task`; its stated reason (parentless Tasks) does not apply when a human parents them.                                                                                                                     | **WI 42998** exists for this, still `New` |

## C7. Confluence

| #   | Finding                                                                                                                                                                                                | Evidence                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 56  | **The write path fails silently on escaping.** HTML entities published as literal visible markup, success returned, no validation error. **Hit in both runs.**                                         | page 981139457 is at version 2 |
| 57  | **It asks permission for what `docs.publish: true` already granted.**                                                                                                                                  | maintainer                     |
| 58  | **Contract changes in git do not reach Confluence.** When `publish` is true, a re-published contract should update the page.                                                                           | maintainer                     |
| 59  | **Run 1 published no component pages at all** despite `docs.publish: true`. `Design System Components` (973276506) had no descendants before run 2. Measured before publishing, not re-verifiable now. | worker                         |

## C8. Determinism and session shape

| #   | Finding                                                                                                                                                                                                                                                                             | Evidence                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 60  | **Output organisation is nondeterministic.** Storybook organisation and controls differ between runs from the same command version; run 1 also produced `screenshot.png` where another take produced `screenshot.generated.png`. Nothing documents what the organisation should be. | maintainer                                                                |
| 61  | **`/specs` and `/tickets` suit one session; `/build` wants a fresh one.**                                                                                                                                                                                                           | maintainer                                                                |
| 62  | **`reconcile` has no `kept_by_design` verdict.** Four findings with written justifications were classified `still_present`, indistinguishable from four nobody touched.                                                                                                             | **amends [#431](https://github.com/unic/unic-agents-plugins/issues/431)** |
| 63  | Storybook 10.5.10 is available.                                                                                                                                                                                                                                                     | chore                                                                     |

---

# D. The measurements

| Measure                | Result                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dedup**              | **19 distinct findings across the precheck and round 1, only 5 shared — ~26% overlap, 7 unique to each.** Round 2 added a twentieth four reads had missed. **Two different passes, not N rounds of one.** Neither "one good pass finds it all" nor "five rounds earn their cost" survives. |
| **Cost**               | Seven-day proxy, coarse: build **6** points of a week, round 1 **3**, round 2 **2**. Two review rounds ≈ the build leg. Run 1's "half a week" was probably its two SIGTERM deaths, not the work.                                                                                           |
| **Reconcile accuracy** | **Six FIXED claimed, six real, zero false.** `unverified_fixed 0`, `unmatched_priors 0`, `regressed 0`. Ten of fourteen rows matched the sealed table exactly; the four misses were all kept-by-design → `still_present`, **the harmless direction**. **#431 did not reproduce.**          |
| **Finding identity**   | Six finding hashes reproduced round 1 exactly. Identity matching is stable; the gap is a missing verdict.                                                                                                                                                                                  |
| **Praise**             | **This reviewer's findings are reproducible and its praise is not.** Round 1 said assertions never touch classes or token values, "followed exactly". Round 2 filed two findings against exactly that, on identical code.                                                                  |
| **Unattended**         | **No.** Four halts in `/specs` alone, all by design.                                                                                                                                                                                                                                       |

## The sealed prediction, scored

Written before the run, off the tracker.

**Documented arm — the run should have got these unaided.** `vitest` static import ✔ · `argTypes` ✘ (failed **three times**, twice in the build and once in the fix commit, each after being written into every slice as a criterion) · `data-theme` ✔ · **typeface / `font-body` ✘ — and ADR-0005 was written from run 1's fix of this exact defect** · slot-as-children ✔.

**Undocumented arm — predicted misses.** `disabled` control default ✔ caught · the `as` control as a select ✔ · button UA styles ✔ · title colour ✔ caught by the `cn` fix.

---

# F. What to change so the next run catches these

**Run 2 answered its question: the documentation reached the planning legs and the review nodes, and
not the implementer.** ADR-0005 is the proof — written _from_ run 1's `font-body` defect, merged,
loaded every turn, violated again.

**So "write it down better" is the fix this run's own evidence rules out.** Every row below asks a
different question: _what would have caught this without anyone reading anything?_

|       | Class     | Meaning                                           | Lives in                  |
| ----- | --------- | ------------------------------------------------- | ------------------------- |
| **M** | mechanism | a rule already exists and nothing enforces it     | mostly `DXP-DesignSystem` |
| **R** | read      | nothing ever measured it                          | `unic-archon-dlc`         |
| **C** | consumer  | it was recorded and nothing downstream acts on it | `unic-archon-dlc`         |

## F1 — Mechanisms (M)

| From                                                      | The rule that already existed                                                       | What would catch it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **11** `dxp:font-body` absent                             | ADR-0005, explicitly, written from run 1's fix                                      | An assertion that every component root's class list carries it. **A document has now failed at this twice.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **1**, **15** `cn` extends one scale of four              | none — but `utils.ts`'s own comment diagnoses the general defect and fixes one case | A check that **every** custom `--<family>-*` in `styles.css` appears in `utils.ts`. Kills both findings with one test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **3** `argTypes` incomplete                               | `CLAUDE.md`, **and** an acceptance criterion on all seven slices                    | A check that every prop in the component's type has an `argTypes` entry. **This failed three times after being made a criterion — a criterion is not a mechanism.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **12** icon-only badge unnamed                            | the component's own warning                                                         | An a11y rule that flags an unnamed interactive element. **axe does not flag an unnamed `span`, so "a11y passes" held vacuously.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **12**, second half (added 2026-09-02, PR 5843)           | none                                                                                | The badge root at `5e683a7` is a plain `span`, not interactive, so an interactive-naming rule (43024) does not catch it. Finding 12 is a **text-alternative** defect: an element whose only content is an `aria-hidden` glyph, conveying a status and exposing nothing. Needs its own rule and work item; candidate shape from `DS-43020`: no accessible name, no text content, at least one element child, every descendant `aria-hidden`. **Not filed yet.**                                                                                                                                                                                                                                                                                                                          |
| **a sixth check** (added 2026-09-02, PR 5843 iteration 2) | none                                                                                | **A component with no `test`-tagged story is invisible to 43022, 43023 and 43024**: the hooks fire on every rendered story, and a build that ships a component and no story satisfies all five mechanisms while enforcing none. Closing it needs a check that walks `packages/ui-react/src/` for a component directory no story renders. Its shape is a decision, not an implementer's guess: whether an icon counts, whether a `DEMOS` composition counts, whether a component may ship story-less behind a tag. **Load-bearing for run 3; filed 2026-09-02 as [WI 43028](https://dev.azure.com/FZAG/dxp/_workitems/edit/43028)** under 42989, predecessor 43020, with the three shape decisions derived from the bar and stated in the body. PR 5843 thread 65652 holds the evidence. |
| **4** one story without a snapshot                        | `CLAUDE.md` § The bar, item 3                                                       | `count(test-tagged stories) == count(snapshots)`. Round 2 did this arithmetic by hand; nothing runs it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **25** badge and icon position                            | **the contract records the arrangement with y-coordinates**                         | An assertion on document order and geometry — **blocked by F3, because the bar may forbid the assertion that would prove it**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## F2 — Reads (R)

| From      | What was never measured                                                                                                                                                               | Consequence                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **31–34** | Run 1 read **into** nested instance layers and found four design defects. Run 2 did not, and found none — **with identical measurement density**, 28 node ids and 92 bullets in both. | The contract's read list must require the nested-layer pass, or every future run loses the same four.                                       |
| **26**    | The `fade` annotation was **carried forward from `figma.md` rather than re-measured**, and the run said so.                                                                           | **The document existing is why the observation was not repeated.** The cost side of the whole thesis, and the only self-explained instance. |

## F3 — Consumers (C)

| From                              | Recorded where                          | Nothing acts on it                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **26** `fade`                     | both runs' card contracts               | No step turns an annotation into a criterion, a ticket or code. **Recorded twice, implemented never.**                                                                                                                                                                                                                                                                                             |
| **25** arrangement                | both contracts, with coordinates        | The build ignored it and no check compared them.                                                                                                                                                                                                                                                                                                                                                   |
| **23**, **24** the assertion rule | `CLAUDE.md` § The bar                   | **The rule does not say whether a token-derived geometry assertion is a token-value assertion. Two reviewers of the same code reached opposite verdicts.** Settle the rule and two findings resolve themselves — and F1's last row unblocks.                                                                                                                                                       |
| **35** thirteen precheck findings | nowhere a human or the report can reach | Recovered only from SQLite.                                                                                                                                                                                                                                                                                                                                                                        |
| **35**, read again 2026-09-02     | `remote_agent_workflow_events`          | The same table is a **recovery procedure**, not only a defect: `unic-dlc-pr-review` iteration 3 on PR 5843 (run `e95e79db`) died on SIGTERM inside `post`; its 17 KB summary and five findings were recovered whole from the `tool_called` inputs and posted by hand under its iteration marker. Four of the five were real defects. Memory `reference_archon_killed_run_recoverable_from_sqlite`. |

## F4 — The hypothesis for run 3

> **Run 2 showed documents do not reach the implementer. Run 3 asks whether mechanisms do.**

**Widened 2026-09-02 15:58 (maintainer).** Run 3 also carries [#441](https://github.com/unic/unic-agents-plugins/issues/441)
(after [#452](https://github.com/unic/unic-agents-plugins/issues/452)), so one run assesses two legs: on the specs leg, whether
the grilling fires and the halts halt; on the build leg, whether the five checks (ADO 43020–43024) reach the implementer.
This is not a confound, because the five checks test properties a PRD cannot mask (`dxp:font-body` on the root, an
`argTypes` entry per prop, a snapshot per test story, every `@theme` scale in `cn()`, a name on every interactive
element), so each leg's result is observable on its own. What the run can no longer say is whether the build got
better _overall_ because of one change or the other, and that was never the hypothesis. The sealed predictions
must cover both legs.

**Documents added before run 3, stated so the diff does not surprise (2026-09-02, PR 5843):** the Consumer's
`CLAUDE.md` § Where the files go gained a component rule (a component's props are a local named type; a variant axis
is declared once with `satisfies Record<Axis, string>`), paired with 43021's check that enforces it mechanically;
`CLAUDE.md` also gained § MCP servers routing and a documentation standard, and `docs/agents/unic-archon-dlc.md`
gained the Archon 0.7.0 floor, `/setup`'s re-run behaviour and a killed-run recovery procedure. None changes what
`/specs`, `/tickets` or `/build` do; all are documents an agent reads. If run 3's implementer honours the props rule
while 43021 also fires on it, the two are not separable for that one rule, and the report says so.

Each F1 row replaces a document that already existed and was ignored. If run 3 stops failing on them,
mechanisms win. **If it fails anyway, the problem is further upstream than either**, and that is worth
knowing before more prose gets written.

### Run 3's preconditions — not board work, and not to be done early

**1. `develop` carries run 2's PRD, `issues.json` and three contracts.** Run 3 hits the same re-entry
trap and needs the same deletion setup, or it anchors on run 2. **This happens at dispatch time, on the
run's own branch, exactly as run 2's two setup commits did.** Doing it early destroys the baseline the
comparison still needs, which is why it is deliberately **not** a work item.

**2. The story and control organisation is decided** — recorded as an ADR by the DS ticket set:

```
COMPONENTS/badge-main
COMPONENTS/card-profile-main
DEMOS/card-with-badge
ICONS/interface/User2
```

Chosen 2026-09-01 by comparing both Storybooks side by side, 6006 against 6007. **Fully decided — no open
sub-question remains.** `card-with-badge` takes a `DEMOS` section of its own because it is the composition
demo, not a component: its only job was to show the two drawn convenience cells need no card code, and it
caught a defect two slices upstream while doing it. Under `COMPONENTS` it would read as a fourth
component, which is exactly what it is not.

**And the organisation is not a style question.** Run 2 split `card-profile-main` into five story files —
`composed`, `disabled`, `parts`, `root`, `states` — against run 1's one, **because each slice needed its
own filtered `test_command`.** Same root cause as the eight stale snapshots: the narrower the per-slice
seam, the more the story files fragment. So the organisation ADR and the cross-slice-seam ticket are two
ends of one problem.

**3. A confound to state before run 3, not discover in its report.** The mechanism tickets introduce a
**node vitest project that neither run 1 nor run 2 had** — `packages/ui-react` has no runner today and
the only one is `apps/storybook-react`'s chromium project. So the testing-seam question the maintainer
answered at run 2's tickets gate **gets a different answer next time**, and part of any
run-2-versus-run-3 diff is new infrastructure rather than a changed chain. **Accepted, not hidden.**

Sharpened 2026-09-02, while amending 43020–43024: `apps/storybook-react`'s `test` script pins
`--project=storybook` and `packages/ui-react` has no `test` script, so the new node-environment project is
invisible to root `pnpm test` until one of those changes. That script change is part of the same new
infrastructure and belongs in the confound, not in run 3's report as a surprise. And the five checks' "Done
when" lines were all satisfiable on the empty `develop` tree — the all-negative shape #381 already measured —
so each now proves its negative path on a fixture (WI revisions of 2026-09-02).

Widened 2026-09-02 11:31 by `DS-43020`, measured in the installed `@storybook/addon-vitest` 10.4.0: the
storybook vitest project's `test.include` is overwritten by the plugin with the story globs from `.storybook/main.ts`
(`include: [...includeStories, ...getComponentTestPaths()]`, and any passed `include` is emptied with a
"will be ignored" warning), so a fixture test that is not a story cannot run in that project. The set therefore
adds **two** vitest projects, not one: a node project for the three file-reading checks and a browser project for
the fixture proofs of 43023 and 43024. Run 3's diff against run 2 carries both.

---

# E. Proposed tickets

## `unic-agents-plugins` (GitHub) — FILED 2026-09-01

All `app:unic-archon-dlc` + `needs-specs`. **Filed without `/to-tickets`** — the skill's vertical-slice
rule does not transfer to a repository whose product is prose, and its `disable-model-invocation` means
a second opinion costs a session. The edges below are this seat's, unreviewed.

| #       | Covers     | P   | Title                                                                                 |
| ------- | ---------- | --- | ------------------------------------------------------------------------------------- |
| **438** | 35         | p1  | a review node produced thirteen findings and recorded them nowhere                    |
| **439** | 39, 40     | p1  | `open-pr` precedes its gate, and a config-value gate has no safe middle               |
| **440** | 43, 44, 45 | p2  | the re-entry idiom reads before it offers the choice, and Step 8 hardcodes names      |
| **441** | 46–51      | p1  | **`/specs` grills, checks its own claims, and ends with a review** ⚠ grill first     |
| **442** | 52         | p2  | `/specs` wrote a PRD requirement the chain's own gates forbid — **blocked by 441**    |
| **443** | §F2        | p1  | the contract's reads lost four findings between two runs at identical density         |
| **444** | §F3        | p2  | an annotation must reach a criterion or be refused                                    |
| **445** | 56–59      | p2  | Confluence publishing fails silently, asks for permission it has, does not update     |
| **446** | 27, 60     | p2  | nothing steers a Consumer's story and control organisation — **blocked by ADO 43018** |
| **447** | 37, 38     | p2  | a review's findings must become work a developer can pick up                          |
| **448** | 53         | p2  | per-slice test commands cannot see a cross-slice regression                           |
| **449** | 54, 55     | p3  | the work-item hierarchy a Consumer wants becomes config — **blocked by ADO 42998**    |

**Amended rather than filed:**

- **#430** — the worktree install. Run 2 extends it **past `pr-review` to every review node in the
  lifecycle**. **The attribution written here on 2026-09-01 was wrong, corrected 2026-09-03 by
  `DLC-430-grilling` and verified independently:** `verification` PASSED and `goals-check` returned four AC
  failures minutes apart, which is a true observation, but a missing install did not cause it. That worktree
  HAD `node_modules` — born 17:05:24 UTC, one second after `run-build` called `pnpm --filter
  @repo/storybook-react exec playwright install chromium` — and `verification`'s own `tool_called` payload at
  17:56:22 is `pnpm test 2>&1 | tail -60`, verdict 7 test files, 17 tests, 17 passed, turbo 0 cached. **The
  suite really ran and really passed.** `goals-check`'s four failures are about acceptance criteria, not exit
  codes, and remain unexplained by this finding. What made the original reading look sound: the Archon DB
  stores UTC while `stat` prints local time, and the two-hour offset made a mid-run install look like a
  post-run human one. See the corrected row 41 for the finding that survives.
- **#431** — **it did not reproduce.** Six FIXED claimed, six real, zero false, scored against a sealed
  table. All four misclassifications were `kept by design` → `still_present`, the harmless direction.
  The real gap is a **missing `kept_by_design` verdict**.
- **#437** — second instance added from the tickets leg.

**442 ← 441 is a native GitHub dependency** (verified). **446 ← ADO 43018** and **449 ← ADO 42998** cross
trackers, where no native link exists, so both are prose in the body and will vanish if nobody reads it.

**Not filed here:** Storybook 10.5.10 is a `DXP-DesignSystem` dependency, not a plugin concern. It was
listed under GitHub in this register by mistake.

## `DXP-DesignSystem` (Azure DevOps) — FILED 2026-09-01

**No ticket fixes run 2's output.** These are mechanisms and decisions only. All eight are Tasks under
**42989**, area `dxp\DXP - ZRH\DS - Design System`, tags `P: DesignSystem` + `readyForImplementation`,
priority 2.

| id        | was | Title                                                                                 |
| --------- | --- | ------------------------------------------------------------------------------------- |
| **43018** | W3  | ADR: how a component's stories and its controls are organised                         |
| **43019** | W2  | Settle whether a token-derived geometry assertion is a token-value assertion          |
| **43020** | W1a | Check that every custom theme scale in `styles.css` is declared in `cn()`             |
| **43021** | W1b | Check that every prop in a component's type has an `argTypes` entry                   |
| **43022** | W1c | Check that the test-tagged story count equals the snapshot count                      |
| **43023** | W1d | Assert that every component root carries `dxp:font-body`                              |
| **43024** | W1e | Fail a story where an interactive element has no accessible name                      |
| **43025** | W1f | Assert the badge and icon arrangement the contract records — **conditional on 43019** |

**43025 carries a native Predecessor link from 43019** (verified: `Dependency-Reverse`), and names it in
its title too, so the condition survives someone deleting the link. The vitest-project confound line
sits on **43020, 43021 and 43022**, one sentence each, pointing here.

**Every one has iteration path `dxp` — the project root, not a sprint.** `add_child` sets no iteration
and the session correctly declined to invent one. **A human sprints them, or they sit off every board.**

### An unverified board fact, recorded because it predicts a repeat

**All eight arrived with `System.Description` duplicated byte-for-byte into
`Microsoft.VSTS.TCM.ReproSteps`.** Cleared on 2026-09-01, so each body now exists once.

**The cause is unmeasured.** It correlates with the MCP's **`add_child`** action: the filing session's
payload carried four keys and no `ReproSteps`, and the three Tasks and User Stories on this board
created by other paths (43008, 42998, 43017) all have that field empty. **But that comparison separates
tools, not work-item types**, so it cannot say which layer between the call and the board adds it.

Settling it needs a throwaway item on a customer board, which neither session was willing to file.
**Prediction: anyone filing through `add_child` gets the duplicate again, run 3 included.** If it
reproduces there, it has earned a line in `docs/agents/issue-tracker.md` beside the Bug-field trap on
WI 42998. Until then it stays here, as an observation with an unproven cause.

**Two people reached for a wrong actor over this in one exchange** — the filing session blamed the
board without re-reading its own payload; this seat then blamed the session on evidence that only
showed other tools behave differently. **The field records what it holds and never who wrote it**, which
is what makes the mistake cheap to make twice.

| Proposed                                             | Covers                     | Note                                                                                                |
| ---------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| **W1 — enforce what the documents already say**      | F1 rows 1–5                | Five checks, one ticket per check or one ticket with five. **The hypothesis under test**            |
| **W2 — settle the assertion rule**                   | 23, 24, F3                 | **Blocks W1's last row.** A documentation gap, not a code defect                                    |
| **W3 — ADR: how stories and controls are organised** | 27, 60                     | You prefer run 1's. Nothing documents it, which is why two runs invented two answers → unblocks T10 |
| **43000** · filed                                    | 28                         | Two faint colours · Jessica Moser                                                                   |
| **43017** · filed                                    | 29–34, 26                  | Ten design questions · Jessica Moser                                                                |
| **42998** · open                                     | 54, 55, the Bug-field trap | Retitled 2026-09-01                                                                                 |

## Deliberately no ticket

Sections **A1–A6** as repairs — run 2's output is abandoned, not fixed.
**Finding 10**, the disclosed helper change: it was correct and approved. **That no reviewer mentioned
it is a finding about reviewers**, and it belongs to T1's family rather than to work.
