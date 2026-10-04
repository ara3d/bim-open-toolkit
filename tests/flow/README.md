# tests/flow

NUnit projects for the BIM packs in `src/flow` (`Nodes.Bos`, `Nodes.BimAnalysis`,
`Nodes.Geometry`), the 3D workflow suite `View3dWorkflows.Tests`, and
`BimOpenFlow.PocParity.Tests`, which pins behaviour against the original
prototype's outputs. The tests of the generic packs, the host, and the MCP
server moved to `ara3d/bim-open-flow` with them and run in its CI. The suites
that need the studio's bim profile or the toolkit's samples (`BimWorkflows`,
`NrcWorkflows`, `SampleFlows`, `SnowdonWorkflows`) live in `tests/studio`.

Sample graphs come from `samples/`; model fixtures come from the repository
`data/` folder and are skipped when absent. `gates/host-smoke.mjs` exercises
the built studio and generic host end to end.
