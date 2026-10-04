# tests/studio

NUnit projects for `src/studio`. The two Ask suites replace the language model with a scripted
`HttpMessageHandler` and drive the real MCP tool server, so no key and no network are needed.
The Studio scripts in `Ara3D.Studio.BimTools` run only inside Ara 3D Studio and have no tests here.

| Project | Covers |
|---|---|
| `BimOpenFlow.Studio.Tests` | The studio's `/api/ask` handler, its prompts, graph checks, and graph ids; the studio's composition (`StudioCompositionTests`), the NRC seeding and preparation jobs, and the committed `docs/nodes.catalog.json` |
| `BimOpenFlow.BimWorkflows.Tests` | The bim profile's registry, sample BIM graphs, and their seeding |
| `BimOpenFlow.NrcWorkflows.Tests` | The NRC paper's answers over the Duplex model; CI runs it as its own gate |
| `BimOpenFlow.SnowdonWorkflows.Tests` | The Snowdon DuckDB catalog (`samples/duckdb-analyses`) over a generated `sample.duckdb`, and the Snowdon federation match graph over `FederationExample`; it borrows `SampleFixtures` and `TableReads` from bim-open-flow's `tests/flow/BimOpenFlow.TableWorkflows.Tests` (in `deps/bim-open-flow`) |
| `BimOpenFlow.SampleFlows.Tests` | Every committed sample graph seeded and evaluated in both studio profiles, against golden text |
| `BimOpenMcp.Ifc.Ask.Tests` | The IFC question runner: the command line, the fresh conversation per question, the hidden tools, and the transcript and results files. One test runs a whole scripted run over `data/duplex.ifc` and is ignored when that fixture has not been fetched |

The Ask loop's own tests (`BimOpenFlow.Ask.Tests`) and the scripted `fake-claude/claude.cmd`
they and `AskHandlerTests` run moved to bim-open-flow; `BimOpenFlow.Studio.Tests` and
`BimOpenMcp.Ifc.Ask.Tests` copy it from `deps/bim-open-flow/tests/studio/fake-claude`. What these
tests cannot show: a real login, a real model's tool choices, or the CLI's behaviour against a
network failure or a truncated MCP result.
