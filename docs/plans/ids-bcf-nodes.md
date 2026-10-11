# IDS and BCF nodes

Built 2026-10-11 in one session (bcfc489d) from the request "build and test new
nodes for IDS and BCF; node tests should not require actual graphs; also create
sample graphs". Serves workflow 3 (hand the answer to someone: a BCF a
colleague opens in Revit or Solibri) and the kept rule-check scope through the
Checking context (TKT-167). Tickets: TKT-50, TKT-181, TKT-187; TKT-182 decided
the column names the same day.

## Design

IDS (Information Delivery Specification) is a second way to produce the
verdict table the Compliance pack already produces; BCF (BIM Collaboration
Format) is a second way to consume one. Both packs therefore speak the issue
table of TKT-182 (`IssueColumns` in bim-open-data's ObjectModel): `GlobalId`,
`Title`/`CheckTitle`, `Description`/`Citation`, `Verdict`, and the rest. Nothing
downstream (`view3d.color`, `table.aggregate`, `chart.bar`, `report.html`) had
to change.

Where the code went:

| Piece | Repository | Why there |
|---|---|---|
| `Ara3D.Ids`: `IdsModel` (from a `.bos` or the `EntityText` and `ParameterText` tables), `IdsFacets`, `IdsEvaluator`, `IdsTables` | bim-open-data | the evaluator is BIM data code with no flow dependency; it replaces a skeleton that never compiled (TKT-187) and needs no DuckDB, so it targets net8.0 |
| `BcfReader` beside the existing `BcfWriter` | bim-open-data | the format's code lives with the format |
| `BimOpenFlow.Nodes.Ids` (`ids.check`, `ids.specifications`) and `BimOpenFlow.Nodes.Bcf` (`bcf.topics`, `bcf.write`, `bcf.read`) | this repository, `src/flow` | BIM node packs live here; one pack per format, like `Nodes.Bos` per dependency |

`ids.check` takes the two text tables rather than a model path so a node test
needs no file but the IDS itself, and so the check runs over whatever tables a
graph already holds. `bcf.topics` exists so the file's contents can be seen on
the canvas before Run; `bcf.write` is the only Effect node.

Decisions worth knowing:

- Node kinds are `ids.*` and `bcf.*`, prefix = pack, not the `check.ids` TKT-50
  named; `check.*` is the generic Compliance pack in bim-open-flow.
- Entity facets match the IFC class exactly; `IncludeSubtypes` warns and is
  ignored. A `USERDEFINED` predefined type is read from `ObjectType`.
- An IDS `dataType` is checked at the level BOS records: number, logical
  (`.T.`/`.F.`), or text. BOS keeps no IFC measure type.
- Numbers are compared in the model's own units; the Duplex is in metres.
- Classification, material, part-of and document facets give
  `InfoNotAvailable` with a warning. A required specification that applies to
  nothing gets one model-level `Fail` row with an empty GlobalId.

## Build log

- bim-open-data `1a5f7c7`: Ara3D.Ids, 25 tests; ifctester 0.8.5 parity on the
  Duplex (DC-W1 8 pass 6 fail; IDS-OC and IDS-EC 0 pass 218 fail unenriched).
- bim-open-data `b6899a7`: BcfReader, 4 round-trip tests (34 in the project).
- Toolkit: the two packs with 6 and 10 node tests over in-memory tables and
  temporary files; the studio's bim profile, docs/nodes.md (regenerated; the
  TKT-207 session committed the regeneration in `e604e03`), node notes,
  layering count 3 to 5; `samples/checking-analyses` (six graphs) with
  `CheckingGraphTests` (13 tests) over `samples/nrc`, including the engine Run
  of both writers and a committed `samples/nrc/bcf/dc-w1-failures.bcf`.
- Numbers: DC-W1 as an IDS gives 14 doors, 8 Pass, 6 Fail, the same as
  `nrc-dc-w1-verdicts`; the NRC carbon IDS over the enriched Duplex gives 218
  Pass for IDS-OC and 217 Pass, 1 Fail (the roof, no embodied-carbon row) for
  IDS-EC; the failing doors become one BCF topic of 6 elements with a viewpoint.

## Review and fixes

A fresh-context reviewer (platonic:reviewer, 2026-10-11) found eight defects
and ten design notes; four defects could give a false Pass. Fixed in
bim-open-data `e12cf2e` (the IDS loader's warnings were discarded, so a
misspelled facet passed everything), `05b07c0` (enumerations are stored as
`.DOOR.` with dots and never matched; a space's Name is its LongName in BOS;
no warning on a model not in metres; IFCDESCRIPTIVEMEASURE is text), `eea5884`
(the summary dropped specifications with no rows and merged two with one name;
type-object property sets are not in BOS, now a warning and TKT-237), and
`2002858` (BCF 2.1 lists viewpoints beside the topic, so every selection was
lost; a recovered id list is stripped from the description). In the toolkit:
`ids.check` takes its summary from `IdsTables.Summary` and both nodes pass the
loader's warnings on; the checking tests assert the roof and the door
specification's support.

Skipped, with reasons:

- A prohibited specification fails every applicable entity without reading its
  requirements. IDS 1.0 leaves the combination ill-defined and ifctester's
  reading is uncertain; the choice errs toward Fail, never toward Pass.
- `BcfIssues.Find`, the preset check, `SummaryRow` and the Effect gate repeat
  helpers that are internal to bim-open-flow's Effects pack or sit in
  Nodes.Support. Moving them into Nodes.Support is a bim-open-flow change,
  which another session had open on 2026-10-11; recorded as debt below.
- `bcf.read` puts an AuthoringToolId under GlobalId when a component has no
  IfcGuid, and fails the node on one malformed viewpoint. Both wait for a real
  BCF from a Revit user to show which shape matters.
- The model path appears twice in two sample graphs (`bos.load.path` and
  `bcf.write.model`); a graph input (TKT-204's `$model`) would share it, and
  that is a sample-wide change.

## Left open

- `ifc_ids_check` MCP tool (TKT-50); the run record naming the BCF by hash
  waits on TKT-12 (TKT-181); GLB, USD and `.frag` nodes (TKT-181).
- Unit conversion of IDS values into the model's units; subtypes via ids-lib's
  schema metadata; the relation-based facets.
- `ids.check` parses the IDS on every evaluation; cache by content hash if an
  IDS ever grows large.
- The two IDS files exist twice, as toolkit samples (`samples/nrc/ids`) and as
  bim-open-data test fixtures (`tests/data/Ara3D.Ids.Tests/ids`); the copies are
  byte-identical today and nothing checks that they stay so.
- `RequireRun` and `SummaryRow` belong in `BimOpenFlow.Nodes.Support` so the
  Effects pack and the Bcf pack share them; `BcfIssues.Find` should be
  `TableColumns.ColumnIndex`.
