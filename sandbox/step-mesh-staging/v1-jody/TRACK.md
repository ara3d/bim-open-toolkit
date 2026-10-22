# v1-jody: closed B-spline edges written in wrapped form get a Closed mark

Ticket: TKT-431
Status: ready: J1

## Chunks

| Id | Ticket | Goal | Expected |
|---|---|---|---|
| J1 | TKT-431 | The 24 one-edge plane loops of the two M2-JODY-W377 files discretized: a B-spline written unclamped in periodic form is decided closed from its record | 2 h |

## Done

- J1 (TKT-431): see the commit and the ticket's resolution.

## Merge instructions

- `wrapped-spline-closure.library.plato` (block `V1JodyWrappedSplineClosure`) into `03-step`, beside `EndsClosure` in `step.library.plato`.
- `EndsClosure(d, tol)` => `d.EndsClosureWrapped(tol)`, or move `EndsClosureWrapped`'s body into `EndsClosure` and delete it; the comment above `EndsClosure` and layer 3's README ("Closure at decode") then say an unclamped record in wrapped form is closed.
- `wrapped-spline-closure.laws.plato` (block `V1JodyWrappedSplineClosureLaws`) into `08-pipeline`: `Law_V1Jody_ClosedEdgeDiscretizes` reads layer 4's `DiscretizeAllRanged`. After the rewire, `Law_V1Jody_CorpusSplinesAreClosed`'s clause `d.EndsClosure(tol).IsDecided.Not` becomes false: drop that clause, and `Law_V1Jody_DecidedUnchanged`, which then compares a function with itself.

## Contract requests

- None.

## Findings

- STEP's `closed_curve` flag is not kept (layer 1, "B-spline records"); the record test reads the geometry instead, as the layer intends.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| See the ticket | | |
