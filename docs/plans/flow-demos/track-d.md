# Track D checkpoint: demos and sample tests

State: complete (2026-09-18). All three chunks committed; nothing pushed.

## Files touched
- tests/flow/BimOpenFlow.TableWorkflows.Tests/DuckDbWorkflowCatalogTests.cs (new)
- tests/flow/BimOpenFlow.NrcWorkflows.Tests/SampleEnumerationTests.cs (new)
- tests/flow/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs (repo-root workaround removed)
- src/flow/BimOpenFlow.Nodes.{DuckDb,Tables,TableOps,Cleaning,Dates,Viz,Support}/README.md (new)
- samples/duckdb-analyses/README.md, samples/snowdon-analyses/README.md (new)
- ModelGraphTests.cs was in the fence but needed no edit: coverage is read from its source.

## Chunks
| Chunk | Hash | One sentence |
|---|---|---|
| D1 | a718a12 | every duckdb-analyses catalog graph parses, validates against `TablePacks()`, and evaluates where sample.duckdb allows |
| D2 | 7c9fe19 | samples/nrc-analyses enumerated; each file must be named by a test in CsvGraphTests or ModelGraphTests; CsvGraphTests uses NrcPaths |
| D3a | 6e93085 | READMEs for the seven undocumented packs |
| D3b | 613c919 | READMEs for duckdb-analyses and snowdon-analyses |

## Checks run
- `dotnet test tests/flow/BimOpenFlow.TableWorkflows.Tests --artifacts-path artifacts/agent-d`: 61 passed (29 new), 2 s.
- `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --artifacts-path artifacts/agent-d`: 26 passed (18 new), 3 s after the IFC build.
- README kinds: every `Kind` in the six node tables matches a `Kind = "..."` constant in the same pack (9 + 11 + 14 + 6 + 6 + 3 = 49; counts equal the source). All nine READMEs are 29 to 50 lines.
- Semantics sections were checked against the node sources (sample modes, concat strictness, date.filter bounds, Viz warn-only behaviour, Support's single project reference).

## Findings
- Of the nine `workflows.json` graphs only `duckdb-typed-schema` evaluates over `samples/tables/sample.duckdb`: it reads `information_schema.columns`. The other eight SELECT from Snowdon tables `door`, `storey`, `space`, `roof`, `evidence`, `source_object`, `source_revision`, `source_document`, which sample.duckdb (Customers, Orders, Products) lacks. The test evaluates them anyway and asserts the only Error nodes are `duck.query` nodes, so a broken downstream node would still be caught the moment a compatible database is used, and a schema drift in the SQL surfaces as a different failure shape.
- `NodeRegistry.Combine` does not dedupe kinds; since M4 (9a05121) `TablePacks()` and `AllPacks()` already include `rel.*`, so the test uses them alone (the brief's `Combine(..., RelationNodes.All(...))` would register every rel.* kind twice).
- Graph-id coverage for D2 is read from the test source with `[CallerFilePath]` and the regex `"(nrc-[a-z0-9-]+)"`; the alternative (a constant list per test file) would duplicate the literals the tests already carry. The reverse assertion (every literal names a file) keeps the regex honest.
- Viz nodes never throw over column names; they warn and skip. Worth knowing for S1's `chart.bar` demo: a misspelt `labelColumn` gives a chart with no labels rather than a red node.
- `DuckDbOps` still says it duplicates NodeArgs "because node packs do not reference each other", but Nodes.DuckDb already references Support; the comment is stale (M-track territory, not edited).

## Blockers
None. The commit lock was free on all three attempts.

## Requests
- When M3 moves `table.filter/derive/aggregate/sort` into TableOps, add their four rows to `src/flow/BimOpenFlow.Nodes.TableOps/README.md` and drop the "moving here" paragraph; `SortTerms` is mentioned there already.
- `SampleAnalysesTests.SampleFiles` (TableWorkflows) and the new `DuckDbWorkflowCatalogTests` both derive folder paths from `SamplePaths.TablesDir`; when M5's `RepoPaths` lands, both can take `RepoPaths.Samples("duckdb-analyses")` instead (test project, outside my fence for csproj changes).
