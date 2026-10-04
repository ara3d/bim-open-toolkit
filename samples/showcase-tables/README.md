# Showcase over the tables samples

The showcase demo that reads bim-open-flow's `samples/tables` (in `deps/bim-open-flow`)
rather than `samples/nrc`. The literal placeholder `{SAMPLES}` stands for that folder;
`NrcSamples.ShowcaseTables` in the studio names it, and both studio profiles seed the graph.

| Id | Input | Chain | You see | Profile |
|---|---|---|---|---|
| `bfast-buffers` | `samples/tables/sample.bfast` in bim-open-flow (reached as `{SAMPLES}/sample.bfast`) | `bfast.read` into `view.table`; `bfast.buffer` (unitPrices as float64) into `view.table` | the four-buffer directory (32, 32, 64, 25 bytes) and the eight prices, 99.99 fourth | tables, bim |

`tests/studio/BimOpenFlow.NrcWorkflows.Tests/BfastGraphTests.cs` evaluates it in both profiles.
