# tests/flow

NUnit projects for `src/flow`: one per node pack and host library, plus the
workflow suites (`TableWorkflows.Tests` over `samples/tables` and `samples/analyses`,
`View3dWorkflows.Tests`) that evaluate whole sample graphs, and
`BimOpenFlow.PocParity.Tests`, which pins behaviour against the original
prototype's outputs. The suites that need the studio's bim profile or the
toolkit's Snowdon samples (`BimWorkflows`, `NrcWorkflows`, `SampleFlows`,
`SnowdonWorkflows`) live in `tests/studio`.

Sample graphs come from `samples/`; model fixtures come from the repository
`data/` folder and are skipped when absent. `gates/host-smoke.mjs` exercises
the built host and studio end to end.
