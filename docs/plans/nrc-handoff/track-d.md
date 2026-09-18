# Track D - Typed pset values

Contract revision **nrc-1, including the "Contract amendments" section**, acknowledged
before any file was written, together with the supervisor's C5 clarification:
`sink.writePsets` takes an optional `valueType` column accepting, case-insensitively,
`Text`, `Label`, `Identifier`, `Integer`, `Number`, `Boolean`, and `Real` as a synonym
for `Number`. Empty or null means `Text`. An unknown name is an `ArgumentException`
naming the row and the value. An absent column keeps today's behavior.

State: **verified** (both chunks implemented, committed, and checked).

Started from supervisor commit `8bcf1c9` (the branch tip was `322f0b2` at dispatch).

## Files

Writable fence:

- `src/flow/BimOpenFlow.Nodes.Effects/WritePsetsNode.cs`
- `src/flow/BimOpenFlow.Nodes.Effects/PsetValueTypes.cs` (new)
- `src/flow/BimOpenFlow.Nodes.Effects/README.md` (the `sink.writePsets` row and paragraph)
- `tests/flow/BimOpenFlow.Nodes.Effects.Tests/WritePsetsTypedTests.cs` (new)
- this checkpoint

## Chunks

- D1 `343c5bc` - the `valueType` column, `PsetValueTypes.cs`, and `WritePsetsTypedTests.cs`
- D2 (this commit) - the Spec description, the class summary, and the README

Delivered behavior: `PsetValueTypes.Create(valueType, name, text, row)` is one
dictionary of cases from a name to an `IfcPropertyValue` constructor. `Text`,
`Label`, and `Identifier` pass the text through; `Integer`, `Number`, `Real`, and
`Boolean` parse it with `NumberStyles.Integer` / `NumberStyles.Float` /
`bool.TryParse` under `CultureInfo.InvariantCulture`. Names are matched
case-insensitively after trimming. `WritePsetsNode` resolves the column with a
private `OptionalColumn` and passes `null` when it is absent, which routes to
`IfcPropertyValue.Text` exactly as before.

## Checks

`dotnet test tests/flow/BimOpenFlow.Nodes.Effects.Tests --artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-d`
run after D1 and again after D2: **54 passed, 0 failed** both times. That is the
whole project, so the four untyped `WritePsetsTests` cases, including the
byte-exact diff assertion, are included. A private artifacts path keeps bin/obj
out of the other tracks' way.

`WritePsetsTypedTests` writes all fourteen cases into one property set on a copy
of the mini IFC in a temp folder and reads the file back, asserting the whole
`IFCPROPERTYSINGLEVALUE(...)` line per case: `IFCTEXT('2HR')`,
`IFCLABEL('Baseline')`, `IFCIDENTIFIER('run-2026-09-17-01')`, `IFCINTEGER(42)`,
`IFCREAL(615.5)`, `IFCREAL(3.)` from the text `3`, `IFCREAL(689.4)` from `Real`,
`IFCBOOLEAN(.T.)` and `IFCBOOLEAN(.F.)`, the lowercase spellings `real` and
`bOOLEAN`, a padded ` Integer `, and both defaulting cells (null and empty). Two
more tests cover the absent column and the unknown-name error, and three
`TestCase` rows cover bad literals.

### Verification limits

- No test drives the node from a graph or from `psets_to_write.csv`; the
  end-to-end path is track E's `nrc-enrich-run`.
- Only the Effects project was built and tested. Nothing else references
  `WritePsetsNode`, but the wave gates are the supervisor's to run.
- Units, and value types outside the seven names, are out of scope.

## Findings

`C:\Users\cdigg\git\nrc-ifc-llm\poc\data\psets_to_write.csv` has 2438 rows and the
distinct `valueType` values are **Real (1103), Label (670), Identifier (664), Text (1)**.
The paper's data therefore needs `Label` and `Identifier`, not only `Real`; without them
track E's `nrc-enrich-run` graph would fail on 1334 of its rows. `Integer`, `Number`, and
`Boolean` appear nowhere in that file but are part of the contract.

The 14-line mini IFC fixture is a `private const` in `WritePsetsTests.cs`, which is outside
this track's fence, so `WritePsetsTypedTests.cs` repeats it. Hoisting it into
`TestSupport.cs` would remove the duplication; that is a supervisor edit, deferred.

`sink.writePsets` builds every property set in memory before writing, so a bad literal in
row 2000 throws before any bytes reach `targetPath`. That is the behavior the enrichment
graph wants, and no test asserts it yet.

## Requests to the supervisor

`docs/nodes.md` is stale for `sink.writePsets` until it is regenerated; the new
Spec text carries the column semantics.

## Blockers

None.

## Running processes

None.
