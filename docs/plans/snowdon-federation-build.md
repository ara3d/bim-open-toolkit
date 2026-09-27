# Snowdon federation: seven IFC files, one BOS, a correspondence table, and federated storey views

Status: building
Request: Build steps 1 to 4 of `docs/proposals/snowdon-federation.md` for TKT-30. Convert the seven Snowdon discipline IFC files one at a time with `IfcToBosConverter`, recording each document's length unit and keeping `Other.Category`. Union them with `AddBimData` into one seven-document BOS. A committed BimOpenFlow graph with SQL rules writes a correspondence table with candidate, confirmed, rejected, and unmatched rows. The rules are: storeys by elevation within 0.05 ft, grid axes by tag, and MEP spaces to rooms by Room Number. The graph joins in a hand-edited confirmations table. DuckDB views `FederatedStorey` and a federated `StoreyOfEntity` read the union plus that table. The Snowdon sample graphs group by these views, and the SHA-256 of the export and of the table are recorded. The investigation's numbers are the acceptance test for step 3.

Open questions (each has a default; the plan is built on the defaults; the supervisor took every default on 2026-09-26 and the ticket's fence now lists the paths of question 1):

1. **The fence globs match nothing, and the ticket fence has no tests.** `src/**/BuildingModel*/**` and `src/**/Bos*/**` match no directory under `src/`. The real directories are `Ara3D.BimOpenSchema.BuildingModel*`, `Ara3D.Ifc.Bos`, and `BimOpenFlow.Nodes.Bos`. The fence names no `tests/` path at all. **Default:** add exactly these paths:
   - `src/data/Ara3D.Ifc.Bos/**`
   - `src/data/Ara3D.BimOpenSchema.Federation/**` (new)
   - `tests/data/Ara3D.Ifc.Tests/ConverterUnitAndAxisTagTests.cs` (new file only)
   - `tests/data/Ara3D.BimOpenSchema.Federation.Tests/**` (new)
   - `tests/flow/BimOpenFlow.TableWorkflows.Tests/**`
   - `BimOpenToolkit.sln`

   None of these overlap the in-flight fences.
2. **Union as a CLI verb or a `bos.union` node.** **Default:** a CLI verb, `federate-union`, in `tools/building-model-workflows`, backed by a new data-layer library. See "Considered and rejected".
3. **Where the tables live, and in what format.** **Default:**
   - The correspondence table is Parquet in `artifacts/snowdon-federation/` next to `union.bos`. It is private and ignored by git, and it is copied into the studio database.
   - Confirmations are a committed CSV, `samples/snowdon-analyses/federation-confirmations.csv`. It starts with a header row only. CSV was chosen because a person or agent edits it by hand, git can show its diffs, and `artifacts/` is ignored.
   - Committing confirmations means committing GlobalIds and storey names from the private model. The proposal already commits such GlobalIds. If the owner objects, the file moves to `artifacts/` and only its hash is committed.
4. **Proving the converter on the 95 MB Architectural file.** **Default:** chunk C1 does this first and records the result. Its kill criterion is below.
5. **Units of elevation.** **Default:**
   - The converter keeps values in the file's units (feet for Snowdon).
   - C2 records the unit on each document's `IFCPROJECT` entity as `Ifc:LengthUnit` ("FOOT") and `Ifc:LengthUnitToMetre` (0.3048).
   - The SQL rules convert elevations to metres with that scale. A document with no unit gets Unmatched storey rows, not guessed metres.
   - The Harmonizer (outside the fence) is not used and stays as it is. Its SI assumption is listed as an extension point.
6. **How the studio picks up the views without breaking the nine sample graphs.** **Default:** one studio database, `artifacts/snowdon-federation/snowdon.duckdb`. It is a copy of the existing typed export (`snowdon-cli.duckdb`) plus a DuckDB schema `federation` that holds the materialized union tables, the correspondence table, and the views.
   - The nine graphs keep reading `main` and return the same numbers. That includes "Explore typed columns", which reads only `table_schema = 'main'`.
   - Three new graphs read `federation.*`, and all twelve graphs keep the single `{DUCKDB}` placeholder.
   - `prepare-bim-flow-duckdb.mjs` keeps existing graph paths, so an existing store must be prepared again (fresh store) to follow the new default.
7. **"The Snowdon sample graphs group by them."** **Default:** the three new federated graphs group by `FederatedStorey`. The nine typed graphs keep the typed `storey` table until TKT-31 maps the union.
   - The typed mapper takes a door's storey only from parameters (`MappingKernel.Element` reads "Storey", "Level", ...), so IFC-derived doors would get no storey.
   - It also maps Areas to `Space`.
   - So pointing the nine graphs at a typed export of the union now would publish worse numbers.
8. **W1's "142 doors and 290 spaces" is in `PROJECT.md`, which is outside the fence.** **Default:** C13 records the re-derived door and space numbers in `docs/bim-flow-duckdb.md` and in the manifest. The supervisor updates `PROJECT.md`. The "nine sample workflows" comment in `bimopenflow/web/packages/app/src/duckdbDemo.ts` is in another agent's fence and stays as it is.
9. **Four named conflicts or five.** The ticket names four storey conflicts. The proposal also names the GlobalId shared by "L2" (HVAC, Plumbing, Electrical) and "Datum" (Site). **Default:** the shared GlobalId is recorded as warning evidence (`global-id-in-other-cluster`). It does not split a storey out of its group.
10. **Location of the private files.** **Default:** the environment variable `BIM_OPEN_SNOWDON_IFC`, falling back to `C:/Users/cdigg/git/3d-format-shootout/data/misc/Snowdon-IFC`. This follows the `SnowdonSource.Path` pattern.

## Brainstorm
skipped

## Acceptance criteria

- **One documented command builds everything.** `node scripts/federate-snowdon.mjs`:
  - converts the seven files (Architectural, Structural, HVAC, Plumbing, Electrical, Facades, Site) one at a time with `IfcToBosConverter`;
  - unions them with `AddBimData(bd, title, path)` into one seven-document `union.bos` and `union.duckdb`;
  - runs the match graph through a host Run;
  - builds `snowdon.duckdb`;
  - writes `samples/snowdon-analyses/federation-manifest.json`.

  The union summary lists seven documents, each with `LengthUnit = FOOT` and `LengthUnitToMetre = 0.3048`. IfcSpace entities keep the `Other`/`Category` parameter, with values Rooms, Areas, and Spaces.
- **The same command runs without private files.** `node scripts/federate-snowdon.mjs --example` runs end to end on a code-built five-document example and exits 0.
- **Each rule's rows.** `samples/snowdon-analyses/federation-match.json` holds SQL rules that write one row per source storey, per (document, grid axis tag), and per MEP space. Each row carries its concept, rule, rule version, rule parameters, evidence columns, `rule_status` (Candidate or Unmatched), and `status` (after confirmations: Candidate, Confirmed, Rejected, or Unmatched).
- **Confirmations survive reruns.** A row in `federation-confirmations.csv` changes `status` on the next run and is never overwritten by a run. A confirmation that matches no rule row appears with `rule_status = 'NoRuleRow'`.
- **The real files reproduce the investigation's numbers:**
  - 77 storey rows.
  - 26 distinct elevation keys, of which 12 have more than one document.
  - `name-differs` on exactly the three Structural L1 levels and Site's "Project".
  - `elevation-offset` on exactly Electrical "L1 - Block 37", with a delta of about -12.7 mm.
  - `name-in-other-cluster` on exactly six parapet rows: "Block 37 - Parapet", "Block 43 - Parapet", and "Block 39 - Parapet", each in Architectural and Facades.
  - No group holds two storeys from one file.
  - Space-in-room Candidates: HVAC 40, Electrical 47, Plumbing 0. All 87 Candidates have `room_name_agrees`.
  - Unmatched spaces: HVAC 27, Electrical 33, Plumbing 8.
  - 28 distinct grid axis keys, all present in Architectural.
- **The federated views.** `federation.FederatedStorey` and `federation.FederatedStoreyOfEntity` exist in `snowdon.duckdb`.
  - Unmatched, conflicting, and rejected source storeys are their own `FederatedStorey` rows.
  - With an empty confirmations file, Snowdon has 31 rows: 12 multi-file groups, 14 single-file groups, and 5 conflict rows (three Structural L1 levels, Electrical L1 - Block 37, Site Project).
- **Studio graphs.** Three new studio graphs group by these views: federated storeys, doors by federated storey, and rooms and spaces by federated storey. The nine existing graphs still return their documented numbers (142 doors, 290 spaces, and so on).
- **Hashes.** `federation-manifest.json` records the SHA-256 of each input IFC, `union.bos`, `union.duckdb`, the confirmations CSV, `correspondence.parquet`, the typed source database, and `snowdon.duckdb`, plus the match graph hash and the acceptance counts. `check-bim-flow-duckdb.mjs` fails when the studio database's hash differs from the manifest.
- **Docs.** `docs/bim-flow-duckdb.md` and `BIMOPENFLOW.md` name `snowdon.duckdb` as the canonical Snowdon data and give the re-derived door and space numbers.
- **Out of scope:**
  - geometry in the union (`AddBimData` does not copy `Geometry`);
  - footprint checks of space claims;
  - the project, site, and building declaration rule;
  - grid line geometry checks;
  - writing matches back into BOS as an eighth document;
  - the typed BuildingModel reading the union (TKT-31);
  - changes to the Harmonizer, `PROJECT.md`, or app code.

Evidence:
- the committed `federation-manifest.json` `counts` block with the numbers above;
- `dotnet test tests/flow/BimOpenFlow.TableWorkflows.Tests --filter FullyQualifiedName~SnowdonFederationAcceptance`, reporting Passed rather than Skipped on the owner's machine;
- `node scripts/check-bim-flow-duckdb.mjs` passing with twelve green graphs over `snowdon.duckdb`.

Kill criteria:
- **C1:** if the existing converter cannot convert the Architectural file (it throws or runs out of memory), or needs more than 30 minutes or 16 GB peak working set, stop before C2. The fallback is a geometry-free conversion mode (PLAN.md item 6), which becomes its own chunk.
- **C7:** if the converted BOS lacks a fact the rules need (Room Number, `Other.Category`, storey Elevation), stop and report the missing fact instead of tuning rules to hit the numbers.

## Design

**Two layers, kept apart, as the proposal says.** The union is mechanical. Matching is SQL in a graph whose output is a table. The views read both.

1. **Converter additions (C2), in `Ara3D.Ifc.Bos`:**
   - `IfcLengthUnit.Read(IfcFile)` resolves the `LENGTHUNIT` of the project's `IfcUnitAssignment`. For an `IfcSIUnit` it applies the prefix. For an `IfcConversionBasedUnit` it multiplies the `IfcMeasureWithUnit` factor by its SI unit. Snowdon Structural: `#22=IFCCONVERSIONBASEDUNIT(#20,.LENGTHUNIT.,'FOOT',#21)` with `#21=IFCMEASUREWITHUNIT(IFCRATIOMEASURE(0.3048),#19)` and `#19` = METRE.
   - The converter writes the result as two parameters on the `IFCPROJECT` entity.
   - It also writes `Ifc:AxisTag` on each `IFCGRIDAXIS`. The tag is attribute 0, and the converter never stores it today: `IfcEntity.GetEntityLabel` reads attribute 2 (SameSense), and `ProcessAttributeAsProp` starts at index 3.
   - Already true, nothing to build: `Other.Category` arrives as an ordinary property-set parameter. IfcSpace's number arrives as `Ifc:Room:Number` and its LongName as the entity name. Storey elevation arrives as `Ifc:Elevation`.
2. **New library `Ara3D.BimOpenSchema.Federation` (data group), started in C3:**
   - `BosUnion`:
     - converts IFC files one at a time, disposing each `IfcFile`;
     - unions the results with `AddBimData(bd, title, path)`;
     - writes the union as a geometry-free parquet zip;
     - writes a raw BOS DuckDB (`BosDuckDb.LoadBimData` plus `BosDuckDbViews.CreateViews`). This load path avoids the enum shift the DuckDb README warns about for parquet-derived databases.
   - `FederationExample` builds a five-document union that shows every rule outcome. It is the fixture for tests in both the data and flow groups, and for `--example` runs. The fixture is built in code because `.gitignore` ignores `*.bos`, `*.duckdb`, and `*.ifc`.
   - `FederationStore` (C8) builds the studio database: a copy of the typed export, plus schema `federation`.
   - A library, not code inside the CLI, because four callers need it: the CLI, data tests, flow tests, and later TKT-31.
3. **CLI verbs (C4, C9)** in `tools/building-model-workflows`:
   - `federate-union`
   - `federate-duckdb`

   Both are thin wrappers over the library. The layering test lets `tools` depend only on `data` (`LayeringTests.cs`, `["tools"] = ["data"]`).
4. **The match graph (C5, C6)** uses only tables-profile nodes: `duck.source`, three `duck.query` rules, `csv.read`, `sql.query`, and `sink.exportParquet`.
   - `scripts/federate-snowdon.mjs` runs it through the studio host's existing `POST /api/analyses/{id}/runs`. That endpoint calls `sessions.Run`, derives `RunInputs` (SHA-256 of every FilePath parameter), and saves a run record. The existing `bim-flow-processes.mjs` helpers start and stop the host.
   - Nothing writes until that Run (principle 2), and the run record pins the graph hash and inputs (principle 4).
5. **Views (C8).** `federation.StoreyMembership` decides, once, which source storeys merge into their group row. `FederatedStorey` and `FederatedStoreyOfEntity` both read it, so the grouping rule has one location.
6. **Studio (C11, C12).** Three new entries go in `samples/duckdb-analyses/workflows.json`. The prepare script's default database becomes `artifacts/snowdon-federation/snowdon.duckdb`, and the check script verifies the manifest hash.

Reused: `IfcToBosConverter`, `AddBimData`, `BosDuckDb`, `BosDuckDbViews.StoreyOfEntitySql`, the tables-profile nodes, the host's Run endpoint, `bim-flow-processes.mjs`, and the existing typed export.
New: the converter's unit and axis-tag parameters, the Federation library, two CLI verbs, the match graph, three studio graphs, the pipeline script, and the manifest.

Retires: nothing in code. The studio's default database path moves from `artifacts/building-model-workflows/snowdon-cli.duckdb` to `artifacts/snowdon-federation/snowdon.duckdb`. The single-file typed export becomes an input to that database until TKT-31.

## Considered and rejected

| Option | Reason | Would change if |
|---|---|---|
| `bos.union` node | The output of a union is a BOS file. Writing it needs a `sink.exportBos` node, and the Effects README says that sink is deferred for lack of schema dependencies. BOS is not a wire type, and principle 5 forbids new ones. | `sink.exportBos` exists, or analysts need to union models inside a graph |
| `run-graph` verb in the tools CLI | The layering test forbids `tools` from referencing `flow`. The host already runs a graph and records the run over HTTP. | A headless `run` subcommand is added to the host (outside this fence); the pipeline would then call it instead of HTTP |
| Point the nine typed graphs at `export-duckdb` over the union | The typed mapper gives IFC-derived elements no storey (parameter-only lookup in `MappingKernel.Element`) and maps Areas to `Space` (`CoreMapping`), so the published counts would get worse. | TKT-31 maps the union and the correspondence table |
| Raw union tables in the studio database's `main` schema | Their names would sit beside 83 typed tables. The "Explore typed columns" graph counts `main` columns, so its answer would change. | The typed tables move to their own schema |
| Views that recompute `StoreyOfEntity` over the full union on every query | A recursive walk over every union entity on each studio query is slow. The results are materialized once per build instead. | Measured query time under 1 s on the full union |
| Confirmations as Parquet next to the BOS (the proposal's default) | Parquet cannot be edited by hand and git cannot show its diffs. `artifacts/` is ignored, so decisions would not be versioned. | Confirmations become bulk agent output, or must stay off git for privacy |
| Committed binary fixture (`.bos` or `.duckdb`) | `.gitignore` ignores `*.bos` and `*.duckdb` outside `samples/tables/`, and the root `.gitignore` is outside the fence. | The ignore rules gain an exception for fixtures |
| Rules emit Confirmed when name and GlobalId agree | Principle 3 says no identity is merged on a matching position without a decision. The GlobalId shared by L2 and Datum shows that agreement can mislead. | The owner accepts automatic confirmation for groups whose names and GlobalIds agree |
| Matches written into BOS as an eighth document with `MemberOf` relations | A BOS relation cannot carry evidence, and `MemberOf` already means IFC aggregation and group assignment. No consumer reads BOS for federation yet. | A BOS-only consumer needs federated storeys |

## Signatures and contracts

Read-only for every chunk. The signatures below were not compiled, because this role writes no files. The first chunk that owns each file compiles them before filling in the bodies.

### C2: converter (`src/data/Ara3D.Ifc.Bos`)

```csharp
namespace Ara3D.BimOpenSchema.IO;

/// <summary>The project's declared length unit: the LENGTHUNIT of IfcProject.UnitsInContext.</summary>
public readonly record struct IfcLengthUnit(string Name, double ToMetre)
{
    public const string NameParameter = "Ifc:LengthUnit";          // String, on the IFCPROJECT entity, group "IFCPROJECT"
    public const string ScaleParameter = "Ifc:LengthUnitToMetre";  // Number, same entity and group

    /// <summary>Null when the file declares no length unit.</summary>
    public static IfcLengthUnit? Read(IfcFile file) => throw new NotImplementedException();
}

public partial class IfcToBosConverter
{
    public const string AxisTagParameter = "Ifc:AxisTag";          // String, on each IFCGRIDAXIS entity, group "IFCGRIDAXIS"
}
```

Worked examples:
- `data/duplex.ifc` (`#15=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`) gives `("METRE", 1.0)`.
- Snowdon Structural gives `("FOOT", 0.3048)`.
- A prefixed SI unit such as `.MILLI.,.METRE.` gives `("MILLIMETRE", 0.001)`.
- `#94803=IFCGRIDAXIS('E',#94802,.T.)` gives the parameter `Ifc:AxisTag = "E"`.

### C3: library (`src/data/Ara3D.BimOpenSchema.Federation`, net8.0-windows, x64; references Ara3D.Ifc.Bos and Ara3D.BimOpenSchema.DuckDb)

```csharp
namespace Ara3D.BimOpenSchema.Federation;

public sealed record UnionInput(IBimData Data, string Title, string Path);
public sealed record DocumentSummary(string Title, string Path, int Entities, string? LengthUnit, double? LengthUnitToMetre);

public static class BosUnion
{
    /// <summary>Converts each file with IfcToBosConverter, disposing its IfcFile before the next.
    /// Title = file name without extension.</summary>
    public static IReadOnlyList<UnionInput> ConvertIfc(IReadOnlyList<FilePath> ifcFiles, ILogger? logger = null) => throw new NotImplementedException();

    /// <summary>One document per input, in input order, via AddBimData(bd, title, path). Geometry is not merged (null).</summary>
    public static BimData Union(IReadOnlyList<UnionInput> inputs) => throw new NotImplementedException();

    /// <summary>Parquet zip of the non-geometry tables; ReadBimDataFromParquetZip reads it back.</summary>
    public static void WriteBos(IBimData union, FilePath output) => throw new NotImplementedException();

    /// <summary>Deletes then writes a DuckDB file: BOS tables via BosDuckDb.LoadBimData, then BosDuckDbViews.CreateViews.</summary>
    public static void WriteDuckDb(IBimData union, FilePath output) => throw new NotImplementedException();

    public static IReadOnlyList<DocumentSummary> Summarize(IBimData union) => throw new NotImplementedException();
}

/// <summary>A five-document union that shows every rule outcome; the worked example in the README.</summary>
public static class FederationExample
{
    public static IReadOnlyList<UnionInput> Documents() => throw new NotImplementedException();
    public static BimData Union() => BosUnion.Union(Documents());
}
```

**FederationExample contents.** This is the contract that C5, C6, C8, and C11 assert against. Every document has one `IFCPROJECT`.

| Document | Unit | Storeys: name, elevation, GlobalId | Other contents |
|---|---|---|---|
| Arch | FOOT, 0.3048 | Parking -16.9167; L1 0.0; L2 8.0833 (`gA2`); Parapet 47.67 | Rooms (Other.Category = Rooms, `Ifc:Room:Number`, name = LongName): "101" Café on L1, "201" Corridor on L2. Area "A1" (Other.Category = Areas) on L1. Axis tags 1, 2, A, F1. IFCDOOR contained in L1. |
| Struct | FOOT, 0.3048 | Parking -16.9167; L1_Low 0.0; L2 8.0833 | Axis tags 1, 2. IFCBEAM contained in L2. |
| Elec | FOOT, 0.3048 | L1 -0.0417; L2 8.0833 (`gShared`) | Spaces (Other.Category = Spaces): E1 (Identity Data: Room Number "101", Room Name "Café"), E2 ("Unoccupied"), E3 ("999"). Axis tags 1, 2, A. IFCLIGHTFIXTURE contained in L1. |
| Site | METRE, 1.0 | Datum -241.4016 (`gShared`); Parapet 14.4536 | none |
| Plumb | no unit parameters | P-L1 0.0 | Space P1 (Room Number "Unoccupied") |

Spaces are `MemberOf` their storey, and elements are `ContainedIn` theirs.

### Union outputs (C4 `federate-union`, contract for C7, C9, C10)

`federate-union <out-dir> (<file.ifc>... | --example)` writes these files to `<out-dir>`:
- `union.bos`
- `union.duckdb`
- `union-summary.json`: `{ documents: DocumentSummary[], seconds: number, peakWorkingSetBytes: number }`

The same JSON is printed to stdout. The verb exits 0.

### Correspondence table (graph output, C5 and C6; read by C8)

One Parquet file. Column names and types are fixed:

| Column | Type | Meaning |
|---|---|---|
| concept | VARCHAR | `storey`, `grid-axis`, or `space-in-room` |
| rule | VARCHAR | `storey-by-elevation`, `grid-axis-by-tag`, or `space-in-room-by-room-number` |
| rule_version | INTEGER | 1 |
| rule_parameters | VARCHAR | `tolerance=0.05 ft (0.01524 m); offset-threshold=0.5 mm`; `tag=exact trimmed`; `unoccupied=Unoccupied` |
| source_document | VARCHAR | document title |
| source_entity_index | BIGINT | union `Entities` rowid (for grid axes: the lowest index of that tag in that document) |
| source_local_id | BIGINT | STEP id |
| source_global_id | VARCHAR | empty for grid axes |
| source_name | VARCHAR | entity name, or axis tag |
| canonical_key | VARCHAR | `storey/<round(median_m*1000)>mm`; `storey/unknown/<document>/<local_id>`; `grid-axis/<tag>`; `room/<document>/<room GlobalId>`; `room/none` |
| canonical_name | VARCHAR | most common source name in the storey group (ties broken alphabetically); the axis tag; the room's name |
| target_entity_index | BIGINT NULL | the room (space-in-room only) |
| rule_status | VARCHAR | `Candidate`, `Unmatched`, or `NoRuleRow` |
| status | VARCHAR | the latest confirmation's decision, if one exists, else rule_status |
| conflicts | VARCHAR[] | any of `name-differs`, `elevation-offset`, `name-in-other-cluster`, `same-document-in-cluster`, `length-unit-unknown`, `claimed-room-not-found`, `claimed-room-ambiguous`, `no-room-number` |
| warnings | VARCHAR[] | `global-id-in-other-cluster` |
| elevation_source | DOUBLE NULL | `Ifc:Elevation` in file units |
| length_unit | VARCHAR NULL | from the document's project entity |
| elevation_m | DOUBLE NULL | elevation_source × `Ifc:LengthUnitToMetre` |
| elevation_delta_mm | DOUBLE NULL | this storey minus the group median |
| name_agrees | BOOLEAN NULL | `lower(trim(source_name)) = lower(trim(canonical_name))` |
| global_id_shared | BOOLEAN NULL | another group member has the same GlobalId |
| cluster_documents | INTEGER NULL | distinct documents in the group, or in the tag |
| axis_copies | INTEGER NULL | axes with this tag in this document |
| claimed_room_number | VARCHAR NULL | Identity Data.Room Number |
| room_name_agrees | BOOLEAN NULL | Identity Data.Room Name equals the room's name |
| decided_by, decided_at, decision_note | VARCHAR NULL | from the confirmation |

**Storey rule semantics.** These match the spike's `t12_cluster.py`.
- Sort storeys with a known unit by `elevation_m`. A new group starts when the gap to the previous storey exceeds 0.01524 m (single linkage):

  ```sql
  SUM(CASE WHEN elevation_m - LAG(elevation_m) OVER w > 0.01524 OR LAG(elevation_m) OVER w IS NULL THEN 1 ELSE 0 END) OVER w
  ```

  where `w` is `ORDER BY elevation_m, source_document, source_local_id`.
- A group with two or more documents gives Candidate rows. A group with one document gives Unmatched rows.
- `name-differs` is set when `name_agrees` is false in a group with two or more documents.
- `elevation-offset` is set when |delta| ≥ 0.5 mm.
- `name-in-other-cluster` is set when the same lowercase name occurs in another group.
- A storey whose document has no unit gets Unmatched, `length-unit-unknown`, and no group.

**Space rule semantics.**
- The rule reads IfcSpace entities with `Other`/`Category` = `Spaces`.
- `Identity Data`/`Room Number` is joined to rooms: IfcSpace entities with `Other`/`Category` = `Rooms` and `Ifc:Room:Number` equal to the claim, from any document.
- Exactly one room found gives Candidate. "Unoccupied" gives Unmatched with `room/none`. More than one room gives `claimed-room-ambiguous`. A missing parameter gives `no-room-number`.
- Areas are excluded.

**Grid rule semantics.** One row per (document, `Ifc:AxisTag`). A tag in two or more documents gives Candidate, otherwise Unmatched.

### Confirmations CSV (committed; read by `csv.read`)

Header:

```
concept,source_document,source_local_id,canonical_key,decision,decided_by,decided_at,note
```

- `decision` is Confirmed or Rejected.
- The join key is (concept, source_document, source_local_id, canonical_key).
- The latest `decided_at` wins; on a tie, Rejected wins.
- A decision that matches no rule row appears as a row with `rule_status = 'NoRuleRow'`.

### Match graph (`samples/snowdon-analyses/federation-match.json`, analysis id `snowdon-federation-match`)

| Node | Kind | Wiring |
|---|---|---|
| `union` | `duck.source` | path `{FEDERATION_UNION}` |
| `storey-rule` | `duck.query` | from `union` |
| `grid-rule` | `duck.query` | from `union` |
| `space-rule` | `duck.query` | from `union` |
| `confirmations` | `csv.read` | path `{FEDERATION_CONFIRMATIONS}`, inferTypes false |
| `correspondence` | `sql.query` | t1 = storey-rule, t2 = grid-rule, t3 = space-rule, t4 = confirmations |
| `write` | `sink.exportParquet` | path `{FEDERATION_CORRESPONDENCE}` |

The graph validates against `HostComposition.TablePacks()`.

**Worked example.** `FederationExample` with an empty confirmations file gives 12 storey rows:
- Parking: Arch and Struct, Candidate, `storey/-5156mm`.
- `storey/0mm`, canonical name "L1": Arch L1 Candidate; Struct L1_Low Candidate with `name-differs`; Elec L1 Candidate with `elevation-offset` and delta -12.7.
- `storey/2464mm`: L2 in Arch, Struct, and Elec, Candidate. Elec L2 carries the warning `global-id-in-other-cluster`.
- Site Datum `storey/-241402mm`: Unmatched, with the same warning.
- Site Parapet `storey/14454mm` and Arch Parapet `storey/14530mm`: each Unmatched with `name-in-other-cluster`.
- Plumb P-L1: Unmatched with `length-unit-unknown`.
- That is 7 elevation keys: 6 groups with a known elevation plus the unknown key. 3 groups span documents.

It also gives 9 grid rows (tags 1, 2, and A are Candidate; F1 is Unmatched) and 4 space rows:
- E1 Candidate, `room/Arch/<101 GlobalId>`, room_name_agrees true;
- E2 Unmatched;
- E3 Unmatched with `claimed-room-not-found`;
- P1 Unmatched.

The test's confirmations are: Confirm Struct L1_Low, Reject E1, and one decision for a nonexistent local id. The resulting statuses are Confirmed, Rejected, and one NoRuleRow row.

### Studio database (C8 `FederationStore`; C9 `federate-duckdb`)

```csharp
public static class FederationStore
{
    public const string Schema = "federation";
    /// <summary>Writes output: a copy of typedDatabase (or an empty database when null), plus schema "federation"
    /// holding source_entity, source_storey_of_entity, correspondence, provenance, and the three views.</summary>
    public static void Build(FilePath? typedDatabase, FilePath unionDatabase, FilePath correspondence,
        IReadOnlyList<KeyValuePair<string, string>> provenance, FilePath output) => throw new NotImplementedException();
}
public static class FederationViews
{
    public static readonly string StoreyMembershipSql = "", FederatedStoreySql = "", FederatedStoreyOfEntitySql = "";
}
```

**Tables in the `federation` schema:**
- `source_entity(entity_index BIGINT, document VARCHAR, step_id BIGINT, global_id VARCHAR, name VARCHAR, category VARCHAR, revit_category VARCHAR)`: every union entity with a non-empty GlobalId. `revit_category` is the value of `Other`/`Category`.
- `source_storey_of_entity(entity_index, storey_index, depth)`: one row per entity, taken from `StoreyOfEntity` with the minimum depth, then the minimum storey index.
- `correspondence`: the Parquet, copied in.
- `provenance(key VARCHAR, value VARCHAR)`.

**Views:**
- `StoreyMembership(source_entity_index, source_document, source_name, federated_storey_key, federated_storey_name, merged BOOLEAN, row_status)`.
  - A storey merges into its group when status is Confirmed, or status is Candidate with no conflicts. Merged rows use `canonical_key` and `canonical_name`.
  - Any other storey gets its own row: key `canonical_key || '#' || source_document`, its source name, and `row_status` = `Conflict` when status is Candidate, otherwise the status itself.
- `FederatedStorey(federated_storey_key, name, elevation_m, status, documents INTEGER, members VARCHAR[], conflicts VARCHAR[])`.
  - Merged rows have status Confirmed when every member is Confirmed, otherwise Candidate. `elevation_m` is the median.
  - Worked example: 9 rows (Parking, L1 with Arch only, Struct L1_Low Conflict, Elec L1 Conflict, L2, Datum, two Parapets, P-L1). After confirming L1_Low: 8 rows, and the L1 row has 2 documents.
- `FederatedStoreyOfEntity(entity_index, document, category, revit_category, source_storey_index, source_storey_name, federated_storey_key, federated_storey_name, federated_storey_status, depth)`.
  - Worked example: the Elec IFCLIGHTFIXTURE maps to `storey/0mm#Elec`, status Conflict. The Arch IFCDOOR maps to `storey/0mm`.

`federate-duckdb <union.duckdb> <correspondence.parquet> <output.duckdb> [--typed <typed.duckdb>] [--provenance key=value]...` prints this JSON to stdout:

```
{ correspondence: {concept, status, rows}[], federatedStoreys: {status, rows}[], sha256: {union, correspondence, typed, output} }
```

### Pipeline and manifest (C10)

`node scripts/federate-snowdon.mjs [--example] [--ifc-dir <dir>] [--typed <db>] [--out <dir>]`. The default output directory is `artifacts/snowdon-federation`. The script does this, in order:

1. Runs `federate-union`.
2. Builds the studio host into `<out>/host` and starts the tables profile on `randomPort()` with the store `<out>/store`.
3. Writes the graph with its placeholders replaced, runs `POST /api/analyses/snowdon-federation-match/runs`, saves the record as `<out>/federation-match.run.json`, and stops the host.
4. Runs `federate-duckdb`.
5. Writes the manifest.

If `--typed` is absent and `artifacts/building-model-workflows/snowdon-cli.duckdb` is missing, the real (non-example) run first creates it with the CLI's existing `prepare` and `export-duckdb` over `Snowdon Towers Sample Architectural.bos`. It uses no storage-policy flag, which matches the current export.

`samples/snowdon-analyses/federation-manifest.json`:

```json
{ "createdUtc": "", "inputs": [{ "file": "", "bytes": 0, "sha256": "" }],
  "union": { "bosSha256": "", "duckdbSha256": "", "documents": [] },
  "confirmations": { "path": "samples/snowdon-analyses/federation-confirmations.csv", "sha256": "" },
  "match": { "graph": "samples/snowdon-analyses/federation-match.json", "graphHash": "", "correspondenceSha256": "" },
  "studio": { "typedSourceSha256": "", "database": "artifacts/snowdon-federation/snowdon.duckdb", "sha256": "" },
  "counts": {} }
```

`counts` is copied from the `federate-duckdb` summary. `--example` writes to `<out>/federation-manifest.json`, never to `samples/`.

### Studio graphs (C11)

These are added to `workflows.json`. Each has one `duck.source` with `{DUCKDB}`, and a final node named `answer`.

| Id | Reads | Shape |
|---|---|---|
| `duckdb-federated-storeys` | `federation.FederatedStorey` | query, then sort by elevation |
| `duckdb-federated-doors` | `federation.FederatedStoreyOfEntity` where category = 'IFCDOOR' | query, aggregate by storey and document, sort |
| `duckdb-federated-spaces` | the same view, where category = 'IFCSPACE' | query, aggregate by storey and revit_category (Rooms, Areas, Spaces), sort |

## Extension points

- **Union geometry.** Merge `BimGeometry` (mesh, material, transform, and entity offsets) so `/3d.html` can show the union (workflow 4).
- **Footprint check for space claims.** Would add evidence against the two stale HVAC claims (space 108, M100). Needs plan footprints from meshes, which no node derives today.
- **Project, site, and building declaration rule.** The proposal's fourth rule: building Name, LongName, and identical placements.
- **Grid line coincidence evidence**, from axis curve geometry.
- **TKT-31.** The typed BuildingModel reads the union and the correspondence table. It fills `ObjectCorrespondences`, separates Rooms, Areas, and Spaces, and moves the nine typed graphs onto the union.
- **Harmonizer.** It should read `Ifc:LengthUnitToMetre` instead of assuming IFC is SI (`UnitConversion.cs` TODO).
- **Stale confirmations.** Report confirmations whose canonical key moved after a rule or tolerance change. Today they surface only as NoRuleRow rows.
- **Match graph in the studio store.** Seed it so rule rows can be inspected in the table pane. Needs the check script to accept EffectPending sinks.
- **Headless `run` subcommand on the host.** Would replace the HTTP start and stop in the pipeline.
- **`bos.union` node**, once `sink.exportBos` exists.
- **Per-file BOS cache**, to skip reconversion if C1 shows conversion is slow.
- **Move `BosUnion.Union` into `Ara3D.BimOpenSchema.ObjectModel`** if a caller outside federation needs it.

## Chunks

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | Record what the existing converter does with the seven Snowdon IFC files: time, memory, counts, units, and the facts the rules need | `samples/snowdon-analyses/README.md` | - | Throwaway harness in git-ignored `scratch/` (not committed). Commit only when the README has one row per file with seconds, peak working set, entity, parameter, and relation counts, the IfcSpace `Other.Category` counts (Rooms, Areas, Spaces), storey `Ifc:Elevation` values compared with the proposal's feet table, whether axis tags reach the BOS, and whether mesh coordinates are in feet or metres. Kill criterion above. | private IFC files; up to 16 GB RAM; data build |
| C2 | Record each IFC file's length unit on its project and each grid axis tag in the converter | `src/data/Ara3D.Ifc.Bos/IfcToBosConverter.cs`, `src/data/Ara3D.Ifc.Bos/IfcLengthUnit.cs`, `src/data/Ara3D.Ifc.Bos/README.md`, `tests/data/Ara3D.Ifc.Tests/ConverterUnitAndAxisTagTests.cs` | C1 | `dotnet test tests/data/Ara3D.Ifc.Tests`. Asserts: Duplex gives METRE and 1.0; an inline IFC text written to temp (FOOT unit, two grid axes) gives FOOT, 0.3048, and both tags; a Snowdon Structural case skips with a named reason when the file is absent. All 10 existing tests pass. | data build |
| C3 | Add the Federation library with the BOS union, its raw DuckDB writer, and the five-document example | `src/data/Ara3D.BimOpenSchema.Federation/Ara3D.BimOpenSchema.Federation.csproj`, `.../BosUnion.cs`, `.../FederationExample.cs`, `.../README.md`, `tests/data/Ara3D.BimOpenSchema.Federation.Tests/Ara3D.BimOpenSchema.Federation.Tests.csproj`, `.../BosUnionTests.cs`, `.../FederationExampleTests.cs`, `BimOpenToolkit.sln` | C1 | `dotnet test tests/data/Ara3D.BimOpenSchema.Federation.Tests` (5 documents in order; entity count is the sum; WriteBos round-trips through ReadBimDataFromParquetZip; WriteDuckDb has EntityText and StoreyOfEntity; the example's Elec light fixture has Elec L1 as its storey). Also `dotnet test tests/BimOpenToolkit.Layering.Tests`. | data build (shares Ara3D.BimOpenSchema.IO with C2) |
| C4 | Add the `federate-union` verb that converts IFC files, or the example, into union.bos, union.duckdb, and a summary | `tools/building-model-workflows/Program.cs`, `tools/building-model-workflows/BuildingModel.Workflows.Cli.csproj`, `tools/building-model-workflows/README.md` | C2, C3 | `dotnet run --project tools/building-model-workflows -- federate-union artifacts/federate-example --example` (exit 0, 5 documents); `dotnet run ... federate-union artifacts/federate-duplex data/duplex.ifc` (1 document, METRE) | data build |
| C5 | Add the match graph with the storey-by-elevation rule, the confirmations join, and the Parquet sink | `samples/snowdon-analyses/federation-match.json`, `samples/snowdon-analyses/federation-confirmations.csv`, `tests/flow/BimOpenFlow.TableWorkflows.Tests/SnowdonFederationFixture.cs`, `tests/flow/BimOpenFlow.TableWorkflows.Tests/SnowdonFederationGraphTests.cs`, `tests/flow/BimOpenFlow.TableWorkflows.Tests/BimOpenFlow.TableWorkflows.Tests.csproj` | C3 | `dotnet test tests/flow/BimOpenFlow.TableWorkflows.Tests --filter FullyQualifiedName~SnowdonFederationGraph`. Asserts: the graph validates against TablePacks; the example's 12 storey rows match the worked example column by column; the Run writes Parquet; the test confirmations give Confirmed and NoRuleRow; a second Run leaves the CSV byte-identical. | flow build of TableWorkflows.Tests |
| C6 | Add the grid-axis-by-tag and space-in-room-by-room-number rules to the match graph | `samples/snowdon-analyses/federation-match.json`, `tests/flow/BimOpenFlow.TableWorkflows.Tests/SnowdonFederationGraphTests.cs` | C5 | Same filter as C5. Adds the example's 9 grid rows and 4 space rows, and the Rejected E1. | flow build of TableWorkflows.Tests |
| C7 | Add the Snowdon acceptance test that reproduces the investigation's storey, grid, and space numbers | `tests/flow/BimOpenFlow.TableWorkflows.Tests/SnowdonFederationAcceptanceTests.cs` | C4, C6 | Run `federate-union artifacts/snowdon-federation <seven files>`, then `dotnet test tests/flow/BimOpenFlow.TableWorkflows.Tests --filter FullyQualifiedName~SnowdonFederationAcceptance`. It must report Passed, not Skipped. The test reads `BIM_OPEN_SNOWDON_FEDERATION_DIR` (default `artifacts/snowdon-federation`), skips with a named reason when `union.duckdb` is absent, evaluates the graph without Run, and asserts every number in the acceptance criteria. | private IFC files; up to 16 GB RAM; `artifacts/snowdon-federation/`; flow build |
| C8 | Add FederationStore, which builds the studio database with the federation schema, StoreyMembership, FederatedStorey, and FederatedStoreyOfEntity | `src/data/Ara3D.BimOpenSchema.Federation/FederationStore.cs`, `src/data/Ara3D.BimOpenSchema.Federation/FederationViews.cs`, `src/data/Ara3D.BimOpenSchema.Federation/README.md`, `tests/data/Ara3D.BimOpenSchema.Federation.Tests/FederationStoreTests.cs` | C3 | `dotnet test tests/data/Ara3D.BimOpenSchema.Federation.Tests`. Uses a correspondence Parquet written in the test from the worked example's rows. Asserts: 9 FederatedStorey rows, 8 after confirming L1_Low; the fixture's door and light fixture keys; a typed database copy keeps its `main` tables unchanged. If `ATTACH ... (READ_ONLY)` cannot bind `u.StoreyOfEntity`, read it over a second connection and write the rows. | data build |
| C9 | Add the `federate-duckdb` verb that writes the studio database and prints its summary and hashes | `tools/building-model-workflows/Program.cs`, `tools/building-model-workflows/README.md` | C4, C8 | `dotnet build tools/building-model-workflows`. `dotnet run ... federate-duckdb` with no arguments exits 2 and prints usage. Real use is checked in C10. | data build (shares the Federation library with C6's build) |
| C10 | Add `federate-snowdon.mjs` and commit the manifest from a run over the seven real files | `scripts/federate-snowdon.mjs`, `samples/snowdon-analyses/federation-manifest.json`, `samples/snowdon-analyses/README.md` | C7, C9 | `node scripts/federate-snowdon.mjs --example --out artifacts/snowdon-federation-example` exits 0; then `node scripts/federate-snowdon.mjs` exits 0 and its manifest `counts` match the acceptance numbers | private IFC files; 16 GB RAM; a random port near 5400; `artifacts/snowdon-federation/`; flow build of the studio host |
| C11 | Add three studio graphs that group doors, rooms, and spaces by federated storey | `samples/duckdb-analyses/workflows.json`, `samples/duckdb-analyses/README.md`, `tests/flow/BimOpenFlow.TableWorkflows.Tests/DuckDbWorkflowCatalogTests.cs`, `tests/flow/BimOpenFlow.TableWorkflows.Tests/FederatedStudioGraphTests.cs` | C6, C8 | `dotnet test tests/flow/BimOpenFlow.TableWorkflows.Tests --filter "FullyQualifiedName~DuckDbWorkflowCatalog\|FullyQualifiedName~FederatedStudioGraph"`. The catalog holds 12 graphs; the three new ids are in `SnowdonOnly`; the three graphs are green over an example studio database built with no typed database. | flow build of TableWorkflows.Tests |
| C12 | Point the studio's prepare default at the federated database and check the new graphs and the manifest hash | `scripts/prepare-bim-flow-duckdb.mjs`, `scripts/check-bim-flow-duckdb.mjs` | C10, C11 | With a fresh store prepared from `artifacts/snowdon-federation/snowdon.duckdb` and the studio running: `node scripts/check-bim-flow-duckdb.mjs` passes. It keeps 142 and 290, adds the federated counts from the manifest, and asserts that the database SHA-256 equals `federation-manifest.json`. | ports 5218 and 5308; private data |
| C13 | Name the merged seven-file export as the canonical Snowdon data and record the re-derived W1 door and space numbers | `docs/bim-flow-duckdb.md`, `BIMOPENFLOW.md` | C12 | Every number in the new text equals a value in `federation-manifest.json` (reviewer check); relative links resolve | none |

Parallel waves (disjoint fences, no dependency between chunks in a wave):
- W0: C1
- W1: C2, C3
- W2: C4, C5, C8
- W3: C6, C9
- W4: C7
- W5: C11
- W6: C10
- W7: C12
- W8: C13

C7, C10, and C11 are kept apart because C7 and C10 share `artifacts/snowdon-federation/` and the RAM needed to convert 215 MB of IFC, while C7 and C11 build the same test project. Chunks in one wave that build overlapping projects (C2 and C3; C6 and C9) contend for the same `obj/` folders in the one checkout. The supervisor may run them one after the other.

Baseline gates:
- `dotnet test tests/data/Ara3D.Ifc.Tests --no-build --no-restore`: 10 passed.
- `dotnet test tests/data/Ara3D.BimOpenSchema.DuckDb.Tests --no-build --no-restore`: 12 passed.
- `dotnet test tests/flow/BimOpenFlow.TableWorkflows.Tests --no-build --filter FullyQualifiedName~DuckDbWorkflowCatalogTests`: no matching tests. The existing binaries are older than that test file. It was not rebuilt, to avoid writing build output into the shared checkout.
- No typed studio database exists on this machine: `artifacts/building-model-workflows/` holds no `snowdon-cli.duckdb` and no Snowdon cache. C10 creates them before building the studio database.

## Build log
| Id | Commit | Result |
|---|---|---|

## Review findings

## Debt and extension points

## Report
