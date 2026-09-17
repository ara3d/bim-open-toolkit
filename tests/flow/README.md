# tests/flow

NUnit projects for `src/flow`: one per node pack and host library, plus the
workflow suites (`BimOpenFlow.BimWorkflows.Tests`, `TableWorkflows.Tests`,
`View3dWorkflows.Tests`) that evaluate whole sample graphs, and
`BimOpenFlow.PocParity.Tests`, which pins behaviour against the original
prototype's outputs.

Sample graphs come from `samples/`; model fixtures come from the repository
`data/` folder and are skipped when absent. `gates/host-smoke.mjs` exercises
the built host end to end.
