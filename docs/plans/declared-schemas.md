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
