---
description: Produce a 3-point PERT effort estimate for the ticket, with caveats when requirements are incomplete.
argument-hint: <ticket reference or free-text ticket description>
---

# PERT effort estimate

Produce a three-point **PERT** effort estimate for this ticket. Do NOT write
anything to the tracker — only produce the draft file.

(The configured `estimation.method` in `.archon/ticket-spec.config.yaml` is
`pert`; this command implements PERT.)

## Inputs

- Analysis: read `$ARTIFACTS_DIR/analysis.md`
- Rewritten description: read `$ARTIFACTS_DIR/draft-description.md`
- Completeness assessment (JSON): `$assess-completeness.output`
- Completeness detail: read `$ARTIFACTS_DIR/completeness.md` if present.

## What to do

1. Scope the work from the affected code areas in the analysis (across all repos)
   and the acceptance criteria in the draft description.
2. Estimate effort in **person-days** at three points:
   - **O** = Optimistic (everything goes smoothly)
   - **M** = Most likely (realistic, expected case)
   - **P** = Pessimistic (significant complications)
3. Compute the weighted estimate **E = (O + 4M + P) / 6** and the standard
   deviation **SD = (P − O) / 6**. Round E and SD to one decimal place.
4. Write a short rationale referencing the concrete code areas and risks that
   drive each number.
5. **Caveats are required when completeness is not high.** If the completeness
   assessment is `low` or `medium`, list the open questions/assumptions the
   estimate depends on and state clearly that it may change once they are
   resolved. The estimate is produced regardless — never refuse to estimate
   because requirements are incomplete.

## Output

Write the estimate to **`$ARTIFACTS_DIR/estimate.md`** in this shape:

```
# PERT estimate

| Point | Person-days |
|-------|-------------|
| Optimistic (O) | <n> |
| Most likely (M) | <n> |
| Pessimistic (P) | <n> |
| **Weighted (E = (O+4M+P)/6)** | **<n>** |
| Std deviation (SD = (P−O)/6) | <n> |

## Rationale

## Caveats & assumptions
- <caveat — only if completeness < high; otherwise "None — requirements assessed complete.">
```

Then print the single line: `PERT E = <n> person-days (O=<o>, M=<m>, P=<p>)`.
