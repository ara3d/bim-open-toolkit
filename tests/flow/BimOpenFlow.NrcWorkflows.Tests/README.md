# BimOpenFlow.NrcWorkflows.Tests

Evaluates every graph in `samples/nrc-analyses` over `samples/nrc` and asserts
the answer node against the NRC paper's expected numbers. `NrcPaths` locates
the two folders; `Fixture` builds `duplex-enriched.duckdb` from the committed
IFC into a temp folder once per run and hands out a registry over both roots.
Every asserted number cites `nrc-ifc-llm/poc/results/expected_answers.json`
or `poc/data/nrc_analytics_storeys.csv`.

| File | Covers |
|------|--------|
| `CsvGraphTests.cs` | the five `nrc-q*` graphs over the CSVs |
| `ModelGraphTests.cs` | the storey walk, DC-W1, and enrichment graphs over the built database |
