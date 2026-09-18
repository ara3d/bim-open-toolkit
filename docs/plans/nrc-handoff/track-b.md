# Track B checkpoint: CSV graphs

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any write.**

State: verified.

Starting point: HEAD `322f0b2`, with track A's CSV copies at `48f7a1f` and the
test project at `8bcf1c9` already in.

## Scope

Five graph documents in `samples/nrc-analyses/` and one test per graph in
`tests/flow/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs`.

| Graph | Chain | Asserted against |
|-------|-------|------------------|
| `nrc-q1-building-total` | csv, aggregate | `expected_answers.json` Q1 |
| `nrc-q8-per-storey` | csv, aggregate, sort | Q8, Q2, `nrc_analytics_storeys.csv` |
| `nrc-q3-top-elements` | csv, select, sort, limit | Q3 |
| `nrc-q5-by-category` | csv, aggregate, sort | Q5 |
| `nrc-q7-absence` | two csv, two filter, anti join, aggregate, select | Q7 note |

## Files written

- `samples/nrc-analyses/nrc-q1-building-total.json`
- `samples/nrc-analyses/nrc-q8-per-storey.json`
- `samples/nrc-analyses/nrc-q3-top-elements.json`
- `samples/nrc-analyses/nrc-q5-by-category.json`
- `samples/nrc-analyses/nrc-q7-absence.json`
- `tests/flow/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs`
- this checkpoint

## Remaining work

None. All five graphs and their tests are in.

## Running processes

None.

## Checks and results

`dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter CsvGraphTests
--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-b`

| After | Result |
|---|---|
| B1 | 1 passed, 0 failed |
| B2 | 2 passed, 0 failed |
| B3, B4, B5 | 5 passed, 0 failed |
| final, at `bc1ce3d` | 5 passed, 0 failed |

## Blockers

None.

## Chunk commits

| Chunk | Hash |
|---|---|
| B1 `nrc-q1-building-total` | `e8b9fa6` |
| B2 `nrc-q8-per-storey` | `cfcb390` |
| B3 `nrc-q3-top-elements` | `2305872` |
| B4 `nrc-q5-by-category` | `9319493` |
| B5 `nrc-q7-absence` | `bc1ce3d` |

## Findings

- The expression grammar's equality operator is `==`, not `=`
  (`submodules/ara3d-dataflow/src/Ara3D.DataFlowEngine.Expressions/Parsing/Lexer.cs:200`).
  String literals take single or double quotes, so `[IfcClass] == 'IFCROOF'`.
- The roof `0jf0rYHfX3RAB3bSIRjmxl` has two rows in `nrc_analytics_long.csv`
  (`NRC.OC.ANNUAL` and `NRC.EUI.ANNUAL`), so the anti join alone returns two
  rows. `nrc-q7-absence` adds a `rel.aggregate` grouped by `GlobalId, IfcClass`
  before the select, which collapses it to the one row Q7 describes.
- **Defect for the supervisor (shared file, not edited here).**
  `tests/flow/BimOpenFlow.NrcWorkflows.Tests/NrcPaths.cs` resolves the repo root
  with `SampleSeeding.FindRepoRoot(AppContext.BaseDirectory)`. Amendment 8 makes
  every track build with `--artifacts-path`, which puts the test output under
  `%LOCALAPPDATA%\Temp`, outside the checkout, so `NrcPaths.Root` throws
  "BimOpenToolkit.sln not found above ...". It takes `Fixture.OneTimeSetUp` down
  with it, and with it every test in the assembly. Suggested fix: resolve the
  root from a `[CallerFilePath]` default instead of `AppContext.BaseDirectory`.
  Until that lands, `CsvGraphTests` resolves the root from its own source path
  with the same `FindRepoRoot` helper and does not call `NrcPaths`.
- The `Fixture` SetUpFixture fails the whole assembly under the private
  artifacts path for the reason above. Each verification run here temporarily
  commented out the `IfcDuckDbBuild.Build` call in `Fixture.cs`, ran the tests,
  and restored the file byte for byte (checked with a checksum before
  restoring, so a concurrent track-A edit would not be clobbered). No change to
  `Fixture.cs` is committed by this track.

## Verification limits

- The five tests were run with `Fixture.OneTimeSetUp`'s `IfcDuckDbBuild.Build`
  call temporarily commented out locally, for the `NrcPaths` reason above. The
  file was restored byte for byte after every run and no change to it is
  committed. Once `NrcPaths` resolves the root correctly, these tests should
  run untouched, because they build their own runtime and registry.
- The working tree carried tracks A, C, and D's uncommitted source changes
  during every run, so the build was not over a clean revision. The tests only
  exercise `rel.*` over CSV files and none of those tracks' behavior.
- `dotnet test` here builds the whole dependency graph, so an unrelated track's
  broken intermediate state would show up as a build failure, not a wrong
  number.
