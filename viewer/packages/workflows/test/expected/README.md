# The expected-result files

Ten pairs. Each `.md` states one workflow's input contract and rules in prose; each `.json` carries
the input tables and the rows the workflow must produce from them. They were written by hand from the
product brief before any adapter existed, which is what makes them acceptance tests rather than a
record of what the code happens to do. `docs/CHECKPOINT-W.md` lists every correction made to them
since, with its reason.

Two conventions in the `.json` files were settled after the `.md` files were written, so where the
two disagree the `.json` is the current one:

**Exception rows have one shape across all ten workflows.** Each `.md` describes exception rows in
its own terms — `objectId`, `scenario`, `candidateCount`, `candidateBuildingIds` and so on. The
adapters emit one shape instead:

```
{ subjects: [...], related?: [...], field, scope?, detail?, kind, reason | values }
```

`subjects` are the ids of the input rows the exception is about, `related` the candidates that stay
open, `field` the input field or step that could not be used, `scope` the scenario it happened in,
and `detail` one sentence of context. `related`, `scope` and `detail` are written only when they have
something in them. Which rows are exceptions, which subject each is about, its reason and its
disputed values are unchanged from the hand-written files.

**An observation is written the same way everywhere**: `{kind:'known', value, unit?}`,
`{kind:'missing', reason}` or `{kind:'conflicting', values}`, with `evidence` only when there is
some. This is the JSON form of the model package's `Observation`, and the five missing reasons are
its own.

One `.json` input table was reshaped: `01-door-schedule.json` carries each door's fact columns under
`facts` rather than at the top of the row, because the model package's `object()` schema returns the
value it was given and so cannot accept a row of arbitrary extra columns without an escape hatch. No
expected value changed with it.

One expected row was corrected: `05-delivery-timeline.json` gives EQ-4 the coverage note
`"delivered, accepted not observed"`. Its `.md` names only `accepted`, but EQ-4 has no `delivered`
event either, and the rule is every lower-ranked state with no known qualifying date.
