# Declared schemas: TKT-206 to TKT-213

Written 2026-10-11 by the session that ran the owner's design discussion on the Schependomlaan storeys graph, for a coordinator who has not seen that discussion. It plans one idea: a graph's table shapes are known without running it, and the user works inside a domain of known AEC tables rather than typing column names into blank fields.

Workflows served (PROJECT.md): 2, "Ask or delegate in Claude, and keep the session", whose Done line is the benchmark scoring correct, and 5, "Measure it against doing without it", whose scores include tokens. The measure this plan moves: a graph Claude builds from the catalog alone, with no exploratory `evaluate`, answers a benchmark question; and every column picker in the editor is filled before any run.

## The idea, in the owner's words and in the code's

The owner's observation: a known table within a schema is like a class definition, its columns are properties with a name and a type; a joined table is a new class; a graph's static structure, which columns reach which node, can be read off the graph without evaluating it; and a BIM professional works inside a domain of such classes (doors, walls, rooms, storeys, schedules, floor plans, issues) and should explore that domain, not guess.

In the code this is four things, each a ticket:

1. A **column vocabulary**: one registry of column kinds with a type, a unit, a meaning and a role (TKT-206). The property definitions.
2. **Declared output schemas** on nodes: static for view nodes, inferred from the inputs for generic nodes, declared dynamic where the data decides (TKT-207, TKT-208). The class definitions and the rules that derive a join's or an aggregate's class.
3. A **static schema pass** over a graph, served to the editor, the static site and Claude, with warnings before any run (TKT-209) and pickers filled from it (TKT-210). The type check.
4. **Table types** and a **domain pack**: named AEC classes with structural conformance, typed ports, a palette grouped by domain, next-node suggestions, and generated domain nodes (TKT-211, TKT-212). The domain the user explores. Which nouns come first is TKT-213, a question for the owner.

## What exists today (checked 2026-10-11)

- `NodeSpec` (ara3d-dataflow, `src/Ara3D.DataFlowEngine.Abstractions/NodeSpec.cs`) declares kind, version, capability, input and output ports, parameters and a description. It says nothing about the columns an output carries. Columns are learned only by evaluating: the editor's `ColumnsOfInput` suggestions read the recorded columns of the upstream result (`SuggestEndpoints.cs` on the host, `staticApi.ts` on the public page).
- The relation layer (`deps/bim-open-flow/src/flow/BimOpenFlow.Relations`) already has the schema machinery: `Schema`, `Column`, `ColumnType` (a closed vocabulary of eight types) in `Schema/`, `SchemaInference` with one rule per plan operator (select, rename, cast, derive, filter, distinct, sort, limit, join, union, aggregate), `ICatalog` with `StaticCatalog`, and `DuckDbCatalog.QuerySchema`, which infers a SQL query's schema by `DESCRIBE` over empty typed views. It serves only the `rel.*` nodes. The `table.*` nodes (27 of them) have no schema at all.
- `BimColumns.cs` (this repository, `src/flow/BimOpenFlow.Nodes.BimAnalysis`) is a list of about 50 column name constants with no types or meanings. `VerdictSchema.cs` in bim-open-flow and the BCF reader in bim-open-data hold their own lists. TKT-182 asks for one convention for the issue and verdict columns and recommends PascalCase and a constants class in bim-open-data's ObjectModel.
- The BOS DuckDB views (`BosDuckDbViews.cs` in bim-open-data): `EntityText`, `ParameterText`, `RelationText`, `StoreyOfEntity`, `StoreyOfElement`. They are the middle layer the `duck.table` graphs read by hand.
- The `bim.*` pack is the domain layer that exists: `bim.elements` (one row per element with Category, Level, Elevation, Room, Document, Workset), `bim.rooms`, `bim.levels`, `bim.bounds`, `bim.paramTable`, `bim.paramCoverage`, `bim.discipline`, `bim.classifyRooms`, `bim.containment`, `bim.nearest`, `bim.navGraph`, `bim.hops`. Each takes a `.bos` path. None declares its columns to the catalog.
- The editor's column picker (TKT-205, bim-open-flow `2932c1c`) opens with every column the suggestions endpoint returns. It guesses which parameters take several columns from the parameter's name, because the catalog does not say.
- The graph sources wave (`docs/plans/graph-sources.md`) is landing in parallel: TKT-202 makes `duck.source` emit a hashed Database value; TKT-203 makes parameters bindable sockets and changes `NodeSpec`, `contracts.json` and the catalog, which TKT-207 also changes.

## Design

### Column kinds (TKT-206)

A `ColumnKind` is a record: name, scalar type, optional unit, one-line meaning, role. Roles: `Key` (EntityIndex, GlobalId, LocalId), `Label` (Name, StoreyName), `Category` (Category, Discipline, RoomClass, ValueType), `Measure` (Elevation, Volume, FootprintArea, Count, FillRate), `Reference` (StoreyIndex, Door, FromRoom). The registry lives in `Ara3D.BimOpenSchema.ObjectModel` in bim-open-data, where TKT-182 already proposed to put the issue columns, because bim-open-flow and this repository both depend on it and it is the lowest layer that knows what a BIM column means. It is exported as `docs/columns.json` so the TypeScript editor and the skill guides read it without a build.

A column kind is not a wire type and not a parameter kind. It is metadata on a column of a table, and tables stay the currency.

### Schemas on the node spec (TKT-207)

`Column`, `ColumnType` and `Schema` move down from the relation layer into the engine abstractions so both layers share them. `NodeSpec` gains one `SchemaSpec` per table-shaped output:

- `Static(Schema)`: the node always produces these columns. Readers of known views, every `bim.*` node, `check.*`, `table.range`, `table.calendar`.
- `Inferred`: the node implements `ISchemaNode.Infer(inputSchemas, parameters, catalog)` and returns a `SchemaResult` (a schema or an error). Every generic table operator, SQL nodes, file readers.
- `Dynamic`: the shape depends on the data. `table.pivot`, `table.transpose`. The pass reports "unknown until run" rather than guessing, per PROJECT.md principle 3 (honest absence).

An old client that does not read the member sees the catalog it saw before.

### Inference rules (TKT-208)

The relation layer's rules are the rule set; the table nodes call the same functions over their parameters rather than copying them. Join: left columns, then right columns, with the relation layer's `_right` suffix on collisions. Aggregate: the group columns, then one column per `func(column) as name` with the function's result type (count is Integer, sum keeps the column's type, avg is Number). Derive: the expression typer already in `Ara3D.DataFlowEngine.Expressions` gives the type. SQL: `DESCRIBE` over empty typed views, as `DuckDbCatalog.QuerySchema` does now. Readers: a CSV or Parquet header, a database's table definition (through TKT-202's Database value when wired), the registry for `bim.*`.

A golden test ties the two worlds together: for every sample graph, the inferred schema of every node equals the recorded columns of its results. A difference is either a wrong rule or a node whose declared columns drifted from what it emits; both are defects.

### The pass and what it feeds (TKT-209, TKT-210)

`GraphSchemas.Infer(document, registry, catalog)` walks the graph in evaluation order and returns a `SchemaResult` per port without evaluating anything. The host serves it beside the results, the editor session recomputes it on every edit (it is cheap: no data moves), MCP `getAnalysis` includes it, and the static site falls back to recorded columns. From it:

- Pickers are filled before any run, with the type and meaning beside each column, and the relevant subset first: numeric columns for a chart's values, `Key` columns for a join or a 3D selector.
- Warnings before any run: a parameter naming a column that is not in the inferred input schema, with the nearest match; a sum over Text. PROJECT.md principle 6: warn, never block.
- Wire peek shows the shape before the data.
- Claude reads the shape from the catalog and the analysis instead of evaluating to find out, which is the token saving workflow 5 scores.

### Table types and the domain pack (TKT-211, TKT-212, TKT-213)

A `TableType` is a named set of required and optional column kinds plus a key: Element, Door, Wall, Window, Space, Storey, Parameter, Bounds, Issue, Verdict. Conformance is structural: a table is a Door table if it has the Door type's required columns with compatible types, whatever else it carries, so a join of doors to rooms is still a Door table and still a Room table. That matches the owner's "joined tables are new classes" without a nominal type system nobody would maintain. A port may declare the type it expects; the pass warns on a non-conforming wire.

The palette groups the domain nodes by type above the generic packs, and selecting a node proposes the nodes whose first input the selection's output conforms to. That is the "explore the domain, not guess" criterion in one feature.

The domain pack is generated from one declaration file (type, BOS view or SQL, column kinds) rather than written node by node, so the BOS views and the pack cannot drift and the same generator can produce a pack for IDS verdicts, BCF issues or a COBie sheet. `bim.elements` and the rest of the existing pack declare their static schemas from the registry.

Decisions the owner makes in TKT-213: the first set of nouns and their required columns; structural against nominal conformance; whether a floor plan is a type or a view; wide against long parameter tables.

## Order

| Wave | Ticket | Repositories | Why it waits |
|---|---|---|---|
| A | TKT-206 column vocabulary | bim-open-data, bim-open-flow, toolkit | TKT-182's casing decision (recommendation already in the ticket; apply it) |
| A | TKT-207 schemas on the node spec | ara3d-dataflow, bim-open-flow | coordinate with TKT-203 on `NodeSpec`, `contracts.json`, the catalog: land the engine member first, in its own commit |
| B | TKT-208 inference rules | bim-open-flow, toolkit | TKT-207; TKT-134 (project aliases) before or with it |
| C | TKT-209 the pass | bim-open-flow, toolkit, `.claude/skills/bim-flow` | TKT-208 |
| D | TKT-210 pickers | bim-open-flow | TKT-209; the multi-value flag from TKT-203 |
| D | TKT-211 table types | bim-open-data, bim-open-flow | TKT-206, TKT-209, and TKT-213's answer for the first set |
| E | TKT-212 domain pack | toolkit | TKT-211, TKT-202 |

Waves A and B are worth starting now; D and E wait on the owner's TKT-213 answer and on the graph sources wave.

## Fences and shared files

- `NodeSpec.cs`, `contracts.json` and its generated TypeScript and C#, the catalog writer in `BimOpenFlow.NodeDocs`, and `docs/nodes*` are touched by TKT-203 (graph sources wave) and TKT-207. Whichever starts second reads the other's commits first; each commits its addition to the shared file by path at once.
- `SuggestEndpoints.cs` is touched by TKT-137, TKT-202 (graph sources wave) and TKT-210. TKT-210 waits for both.
- `BimColumns.cs` and every `bim.*` node file: TKT-206 changes the names' source, TKT-212 adds the schemas. Sequential.
- Every `deps.json` pin, PROJECT.md, the plan files and the tickets: coordinator-owned.
- Cross-repository order for one ticket: engine (ara3d-dataflow) first, then bim-open-flow, then this repository, each committed and pushed in its own checkout under `deps/`, and the coordinator moves the pins.

## Acceptance for the plan as a whole

- A new `table.aggregate` wired to `bim.elements` offers Category, Level and the rest in its Group By picker before any node has run, each with its type and meaning.
- A graph whose `table.join` names a key that is not in either input shows a warning naming the key, before Run.
- The Schependomlaan storeys question is answered by a graph with no hand join, built by Claude from `getNodeCatalog` without an exploratory `evaluate`, with the transcript committed under the benchmark.
- Every sample graph's inferred schemas equal its recorded columns (the golden test).

## Risks and open design points

- **Two inference engines.** The relation layer's rules were written over plan operators, the table nodes over parameters. Sharing the rules means lifting them to functions over (schema, rule arguments) that both call. Doing it as a copy would create the duplication principle 4 forbids; say so in the review if a builder copies.
- **SQL schemas cost a DuckDB session.** `DESCRIBE` over empty views is fast but not free; the editor session should cache per (sql, input schemas). The relation layer's `SchemaCache` is the precedent.
- **Dynamic nodes break the chain.** A `table.pivot` upstream makes every downstream schema unknown. That is honest; the pass should say which node made it unknown, so the user can see why a picker is empty.
- **Structural typing and column renames.** A rename that drops `EntityIndex` silently makes a table stop being an Element table. The pass's conformance warning on typed ports is what catches it.
- **The noun question (TKT-213)** gates only waves D and E. Do not let it gate the vocabulary or the inference.
- **Script nodes (TKT-162)** will have to declare their schema too, in whichever language they use; a script node without one is `Dynamic`.

## Architecture implications

The engine abstractions grow the schema types and one member on `NodeSpec`; the format spec documents it. The relation and table layers share one rule set, which is a step toward the single evaluation path the table-graph-layers design wanted. The column vocabulary sits in bim-open-data because it is about what BOS columns mean, not about dataflow. The catalog becomes the documentation of shapes as well as of ports, which is PROJECT.md principle 6 made literal, and it is what lets Claude plan a graph without running it. Nothing here adds a wire type: tables stay the currency, and the types in this plan describe tables.

## Build log

- Coordinator's chunking (2026-10-11, before wave A). The plan's table is kept with four changes. TKT-206 splits in two: A1 builds the registry, `IssueColumns` and the BCF names in bim-open-data; A3, after A1, renames the flow's verdict columns to PascalCase across bim-open-flow's C#, its web packages and bim-open-notebook, makes `BimColumns.cs` read the registry, and generates `docs/columns.json` and `docs/columns.md`. TKT-134 (project aliases) runs in wave A as A4, since TKT-208 builds on it. TKT-208's golden test needs a graph walker, which is TKT-209's `GraphSchemas.Infer`; so wave B builds the node rules (B1 shared rules and table nodes, B2 SQL and readers, B3 `bim.*`, `bos.load` and `check.*`), and wave C starts with the walker and the golden test (C1), then the editor (C2), the guide and benchmark transcript (C3), and the pickers of TKT-210 (C4). Waves D and E (TKT-211, TKT-212) wait on TKT-213.
- A1 (registry): bim-open-data `8109520` (`ColumnKind`, `ColumnScalarType`, `ColumnRole`, `ColumnKinds` with `All`, `Find`, `ToJson`, split by area into five files; `IssueColumns`, 12 constants including `Type` and `Reason`), `b462770` (the BCF table reads `IssueColumns`; its verdict columns are `CheckTitle` and `Citation`; matching stays case-insensitive). The namespace is `Ara3D.BimOpenSchema`. The registry holds 66 kinds (the commit message says 74); no kind has a unit, because no producing code fixes one; `Volume`, `Type` and `Room` each carry two meanings. Tests: ObjectModel 37, IO.Bcf 30. `Ara3D.Ids` needed no change; it does not build (`IfcDataTypes` is missing in `BosModel.cs`), a pre-existing fault outside the toolkit solution. Debt: no test ties `IdsVerdict`'s properties to `IssueColumns`. A3 dispatched.
- A2 (TKT-207, schemas on the node spec): ara3d-dataflow `33519fd` (`Column`, `ColumnType`, `Schema`, `SchemaResult`, `SchemaError`, `StaticCatalog` move into Abstractions; `SchemaSpec` with `Static(output, schema, kinds?)`, `Inferred(output)`, `Dynamic(output)`; `ISchemaNode.Infer(output, IReadOnlyList<SchemaInput>, ParamValues, ISchemaCatalog)` where `SchemaInput(PortType, Connected, SchemaResult?, FlowValue?)` lets a Database or scalar input reach the rule; `ISchemaCatalog` with `CsvSchema`, `TableSchema`, `QuerySchema`; `NodeSpec.Schemas` as a last optional parameter; `SchemaProblems()` validation; the `ToScalarType`/`ToColumnType` conversions in Expressions), `f43afc5` (format spec and READMEs); bim-open-flow `6f28707` (contracts alone: `OutputSchema`, `SchemaColumn`, `SchemaMode`, `NodeDescriptor.schemas?`, contract `ColumnType` widened from 4 to 8 values), `e5a0a6b` (the relation layer on the engine types, with a global using and an `ICatalog = ISchemaCatalog` alias so A4's files stayed untouched; `ApiMapping`), `92908d8` (`MarkdownEmitter` Columns tables, MCP `getNodeCatalog`, `table.range` Static, `table.pivot` and `table.transpose` Dynamic, the graph package's test catalog, a `default` case in `viz/src/format.ts`), `497769a` (Relations.DuckDb tests); toolkit `e604e03` (docs regenerated). Tests: engine 123, Expressions 489, NodeGraph 51, Runs 32, Conformance 13 (3 skipped), TestKit 24, Migrations 9; Relations 111, Relations.DuckDb 38, Nodes.Relations 32, TableOps 73, Tables 78, DuckDb 67, GraphText 30, Host.Api 69, Host 49, MCP Flow 64; graph 384, viz 48. Midway, `33519fd` left bim-open-flow unbuildable for another session's seven builders until `e5a0a6b`; the coordinator moved bim-open-flow's ara3d-dataflow pin at once (`54bdab3`). Left: `table.range` names its column from the `name` parameter, so Static is wrong and it must be Inferred (B1); the `ICatalog` alias goes once nothing uses it (B1); `NodeRegistry` does not call `SchemaProblems()` and the BIM packs have no such test (B3); the docs print a column's kind name, not its meaning (TKT-207 criterion 4, B3).
- A3 (TKT-206, second half): bim-open-flow `9afb78f` (verdict columns `Verdict`, `CheckId`, `CheckTitle`, `Citation` read from `IssueColumns` in Compliance, Reports, GraphText and `NodeNotes.cs`), `1c273da` (panes; column lookup tries the exact name, then ignores case), `79457f7` (`NodeDocs/ColumnDocs.cs`); bim-open-notebook `b69305c` (verdict detection ignores case); bim-open-data `7c5801d` (the `Value` kind's meaning); toolkit `01d3d7f` (`BimColumns` members read the registry; `Outside` stays, it is a cell value), `f1e3920` (`docs/columns.json`, `docs/columns.md`, written by the `nodedocs` verb; `ColumnKindTypeTests.cs`), `c23ffc3` (`nrc-dc-w1-verdicts` graph and golden, PoC parity and NRC tests). Old camelCase records still render because every reader matches ignoring case. The type test found one clash: chart, scale and colour tables carry a numeric lowercase `value`, the registry's `Value` is Text; the test now compares exact-case names, and the registry says so. Tests: Reports 13, Compliance 30, GraphText 30, ObjectModel 37, BimAnalysis 99, PocParity 10, NrcWorkflows 33; panes 97, client 77, app 199, notebook 284. Left: `check.rollup`'s count columns stay camelCase; `ColumnKinds.Find` ignores case, so inference must look names up exactly (B3); the git-ignored `site/app/site.js` keeps the old names until rebuilt.
- A4 (TKT-134, aliases): bim-open-flow `f0a36af` (one `Projection` parser in `Relations/Plan/Projection.cs`; `Select` carries terms, the compiler emits `"col" AS "Alias"`, `InferSelect` returns aliased names and fails on a duplicate; `table.project` applies the same terms; plan text and hash unchanged for plain names; Nodes.Tables now references Relations). Tests: Relations 111, Relations.DuckDb 38, Nodes.Relations 32, Nodes.Tables 78. The sample criterion failed as written: `duck.table` loads the whole Snowdon door table, whose list columns cannot be hashed, and the ticket's `duck.read` reads files. Filed TKT-238 (`duck.table` gains a `columns` parameter of the same terms; the nine sample nodes convert there) and TKT-239 (list columns are not hashable); TKT-134 closed with its sample criterion moved to TKT-238.
- Wave A gate (coordinator): built from `git archive` exports of every repository's HEAD into a short temporary path (the checkout's `deps/` carried other sessions' uncommitted work; the folder needs the `deps/.deps-root` marker, and the scratchpad path was too long for MSBuild): ara3d-dataflow `f43afc5`, bim-open-flow `497769a`, bim-open-data `2002858`, bim-open-notebook `b69305c`, toolkit `9db60cd5`. Build 0 errors. Every suite passes except failures that are not this wave's: SampleFlows 26 of 615 (the viz, IDS and BCF samples other sessions are adding have no goldens yet, three of them fail `NoOpSortFilterLimit`; `bos-to-relations` and `bfast-buffers` fail in any export folder, and fail the same way with the old pins), Studio 1 of 40 (`CommittedCatalog_MatchesThePacks`: another session's `ids` description; fixed by the regeneration below). Passing: engine 123, Expressions 489, Conformance 13 (3 skipped), NodeGraph 51, Runs 32, TestKit 24, Migrations 9, Layering 20, Ids 7, BimAnalysis 116, Geometry 111, Bcf 10, Ask 29, PocParity 10, View3d 23, Bos 12, Snowdon 56, BimWorkflows 89, NrcWorkflows 83. Docs regenerated from the export. Pins: bim-open-flow pins ara3d-dataflow `f43afc5` and bim-open-data `2002858` (`e901063`); the toolkit pins ara3d-dataflow `f43afc5`, bim-open-flow `e901063`, bim-open-notebook `b69305c`. TKT-206 closed; TKT-207 stays open for criterion 4. TKT-240 filed for the small debts.
- Wave B dispatched (coordinator): the plan still fits; three changes from what wave A produced. B1 lifts the relation layer's rules into shared functions and declares the core `table.*` nodes, and also makes `table.range` Inferred and removes the `ICatalog` alias; B2 does the SQL nodes and every reader through `ISchemaCatalog`; B3 does `bim.*`, `bos.load`, `check.*` (as far as another session's uncommitted Compliance edits allow), the `ids.*` and `bcf.*` packs, a `SchemaProblems()` test over the studio registry, and TKT-207's last criterion (the kind's meaning in the docs). B4 (the remaining `table.*` nodes and the Cleaning pack) waits for B1's rules.
- B2 (SQL and readers): ara3d-dataflow `a1697a5` (`ISchemaCatalog.FileQuerySchema(sql, files)` and `FileSchema(format, path, options)`; `StaticCatalog` implements them); bim-open-flow `b8a48f5` (`DuckDbCatalog` implements them, committed straight after the engine), `5af8847` (DuckDB pack: `sql.query`, `duck.query`, `duck.table`, `duck.read`, `csv.read`, `parquet.read`, `json.read` Inferred, `duck.tables` Static, `duck.source` has no table schema; `CachedCatalog` keyed by path, length and write time, or by SQL and input schemas; `Nodes.Support/SchemaGuards.cs`), `487b5cf` (`xlsx.read`, `sqlite.table`, `sqlite.query`, `bfast.buffer` Inferred; `xlsx.sheets`, `sqlite.tables`, `bfast.read` Static; `TablesCatalog` wraps an inner catalog for xlsx and SQLite); toolkit `77ccbf27` (docs). DATE and TIMESTAMP infer as Text because the nodes emit ISO text. Tests: engine 124, DuckDb 104, Relations.DuckDb 42, Nodes.Tables 122, Host.Catalog 37, Nodes.Relations 32, Relations 124; Host 47 with 2 failures from B1's changes (`TheProvingNodesDeclareTheirSchemas` still expects `table.range` Static; the graph package's test catalog needs `BOF_WRITE_NODE_CATALOG=1`), left for the gate. For C1: the host composes `new CachedCatalog(new TablesCatalog(new DuckDbCatalog(registry)))`; until then `xlsx.read` and `sqlite.*` say the format is not read. Debts added to TKT-240.
