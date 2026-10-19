# bspline: mesh B-spline (freeform) faces

Ticket: TKT-327
Status: working

## Done

- laws and fixtures: 21 laws in `bspline-evaluation.laws.plato` and `bspline-inverse.laws.plato` on the fixtures of `bspline-witnesses.library.plato`. Before any body: 21 of 21 stop on a host obligation (BSplinePoint, ClosestParameterBySearch), gpu32.

## Merge instructions

## Contract requests

## Requests to other tracks

## Findings

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the plan, contracts and layer code | 25 min | |
| Laws and fixtures | 30 min | 2 CLI runs (15 s each) |
| Waiting on the shared law server | 45 min, abandoned | 1 server run, no answer |

## Lessons

- The shared server on 8768 gave no answer in 45 minutes while four tracks used it; the pinned CLI (`C:/Users/cdigg/.plato-cli/93907bd7/Plato.CLI.dll run ... --laws --profile=gpu32`) compiles the library plus this folder in 15 s. Use the CLI when the server is loaded.
