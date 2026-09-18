# Table graph: from the current engine to the four layers

> Proposal, 2026-09-17. Companion to `table-graph-layers.md`. Compares the
> four-layer design with what BimOpenFlow did at `main` `8ecc3df` and lays
> out the steps to move between them. The status section at the end records
> what landed on `worktree-table-graph-layers` on 2026-09-18.

## Where the current engine stands

The engine is `ara3d-dataflow` (submodule, about 4,100 lines of C#), the node
packs and host are `src/flow` (about 11,800 lines), the editor is
`bimopenflow/web` (about 11,750 lines of TypeScript). Measured against the
four layers:

| Layer   | Today                                                                 | Gap |
|---------|-----------------------------------------------------------------------|-----|
| Plan    | A `GraphDocument` of nodes, edges, and string parameters. No operator tree; each node is an opaque `Kind` string with a C# `Eval`. | The document is a plan of nodes, not of relational operators. |
| Schema  | None. Columns are known only after a node has run. `SuggestEndpoints.ColumnsOfInput` reads the upstream node's materialized result. | Whole layer missing. |
| Compile | None. Nodes that need SQL build strings by hand and run them against a fresh in-memory DuckDB per node. | Whole layer missing. |
| Execute | `Evaluator` runs every node, every pass, single-threaded, and keeps all outputs in memory. `ValueHash` hashes every cell of every output. | Exists, but it is the whole engine rather than a layer. |

Specifics that matter:

- **Wires carry rows.** `FlowValue.Table` wraps `IDataTable` with fully
  materialized `Rows` (`Ara3D.DataFlowEngine.Abstractions/FlowValue.cs:45`).
  The memo key hashes every cell (`Ara3D.DataFlowEngine/ValueHash.cs:70`),
  so a lazy table cannot exist under the current rules.
- **Each node round-trips through DuckDB.** `sql.query` and
  `TableOps.QueryOver` write input tables into a new in-memory DuckDB, run
  one statement, and read every row back (`SqlQueryNode.cs:30`,
  `Nodes.Bos/TableOps.cs:26`). A five-node chain is five copies in and five
  out.
- **Expressions already have a tree.** `Ara3D.DataFlowEngine.Expressions`
  has a lexer, parser, type checker with `ScalarType`, and an evaluator
  (1,303 lines). The document stores the string and every `Eval` re-parses
  it (`TableFilterNode.cs:23`). This is the closest thing to a finished
  layer-1 component.
- **Sources are absolute paths in parameters.** `duck.source` emits the path
  as a `TextValue` on a wire (`DuckSourceNode.cs:15`). `DuckSourceCache`
  pools connections by path, not by name. The one name-based registry is
  `ModelCatalog`, which resolves model files and is not consulted during
  evaluation.
- **Click-to-inspect works** by pulling a page of the node's materialized
  output from the host snapshot (`EvalEndpoints.GetResult`, page size 1000;
  client page 200). It depends on the node having status `Ok`.
- **Pure versus Effect** (`NodeCapability`) and the `Runs` freeze/replay
  layer gate side effects. They do not gate materialization.

## What carries over unchanged

- The document format: nodes, edges, values, layout, canonical JSON, and
  migrations. A relational plan is built *from* the document, not stored in
  place of it.
- `GraphValidation` and `GraphTopology`.
- `EvalSession`, its observers, the SSE update stream, and the editor's
  table pane. They subscribe to node status and fetch a slice by node id and
  port. Neither cares where the slice came from.
- The expression lexer, parser, and type checker.
- `IDataTable` as the inspection type, with `DuckDbUtils.ReadTable` as the
  reader.
- All 73 node kinds keep working during the migration, because the change
  introduces a second wire kind rather than replacing `Table`.

## The migration in six chunks

Each chunk is one commit, leaves the existing graphs working, and can be
verified on its own.

### 1. Add a `Relation` wire kind

Add `ValueKind.Relation` and `RelationValue(Plan plan, Schema schema)` next
to `TableValue` in `FlowValue.cs`. Add the `Plan` operator records and
`Schema` type in a new project `Ara3D.DataFlowEngine.Plan` with no
dependencies. Hash a `RelationValue` by plan hash, not by rows, in
`ValueHash`. Nothing produces or consumes the kind yet.

Verification: plan equality and hash tests, no database.

### 2. Move the expression tree into the plan

`Ara3D.DataFlowEngine.Expressions` already produces `TypedExpr`. Make the
plan's `Expr` that tree, or a thin projection of it, so `Derive`, `Filter`,
and `Aggregate` operators hold a checked tree. Keep the parameter stored as
text in the document. Parse and check once when the plan is built, not on
every evaluation.

Verification: existing expression tests pass; a `Filter(plan, expr)` can be
constructed from the string parameter and round-trips.

### 3. Add the Schema layer

New project `Ara3D.DataFlowEngine.Schema`: `infer(Plan, ICatalog)` with one
rule per operator and `SchemaError` as a value. `ICatalog` has one method.
The DuckDB catalog reads a CSV header or `information_schema`; the test
catalog is a dictionary. `SuggestEndpoints.ColumnsOfInput` is switched to
call `infer` when the upstream value is a `RelationValue`, which removes its
dependency on the upstream having run.

Verification: inference tests per operator against the fake catalog.

### 4. Add the Compile layer

New project `Ara3D.DataFlowEngine.Compile`: `compile(Plan) -> string`
emitting one CTE per operator. `RawSql` wraps the user's text with its inputs
under fixed names, reusing `BosDuckDbQueries.ReadOnlyQuery` for the
single-statement check.

Verification: string-comparison tests per operator and for a three-node
chain.

### 5. Add the connection registry and the Execute layer

`IConnectionRegistry` maps a source name to a file root, a DuckDB file, or a
connection string. `DuckSourceCache` becomes its DuckDB implementation,
keyed by name. `execute(sql, registry, limit)` attaches each named source as
a DuckDB catalog, runs the statement, and returns an `IDataTable` through
the existing `ReadTable`. The result's columns are checked against the
inferred schema.

`EvalEndpoints.GetResult` gains a branch: when the node's output is a
`RelationValue`, it calls `execute(compile(plan), registry, take)` instead of
paging a stored table, and caches by plan hash and limit. The client is
unchanged.

Verification: a two-row CSV under a registered name, one inspection call,
one row-count call.

### 6. Port the table nodes to emit relations

Rewrite the relational node kinds to build a plan from their inputs and
parameters and return a `RelationValue`. Start with the ones that already
shell out to DuckDB: `duck.source`, `duck.table`, `csv.read`,
`parquet.read`, `duck.query`, `sql.query`, `table.filter`, `table.derive`,
`table.sort`, and the join and aggregate nodes in `Nodes.TableOps`. Each
port is a small commit of its own.

`duck.source` becomes a plan node carrying a source name rather than a
path on a wire. Sample graphs in `samples/duckdb-analyses/workflows.json`
get a migration that maps their absolute paths to registry names.

Nodes that genuinely need rows in C# (`Nodes.BimAnalysis`, `Nodes.Geometry`,
`Nodes.Compliance`) keep taking `Table`. A `Materialize` adapter turns a
`Relation` into a `Table` where the two meet, so mixed graphs work
throughout.

## What changes for the user

- Column lists and type errors appear on edit, not after a run.
- A chain of relational nodes runs as one DuckDB statement instead of one
  per node with a full copy between each.
- Saved graphs carry source names, so the same graph opens on another machine
  with a different registry.
- Inspection of a filter over a large table returns as fast as DuckDB can
  scan it with a limit, instead of after the whole upstream has materialized.

## Status on 2026-09-18

All six chunks landed on branch `worktree-table-graph-layers`, with one
difference from the plan: the relational node kinds were added as a new
`rel.*` pack rather than rewriting the existing `table.*` and `duck.*`
nodes in place. The old nodes keep working unchanged, and `rel.materialize`
bridges a relation into their `Table` wires. Porting the old kinds one at a
time is the remaining work of chunk 6.

| Chunk | Where | Tests |
|-------|-------|-------|
| 1. Relation wire kind | `ara3d-dataflow` branch `relation-value` (`a7dccd5`): `RelationValue`, `PortType.Relation`, hash tag `0x06`, run-record JSON | 5 in the engine |
| 2. Expression tree in the plan | `BimOpenFlow.Relations/Plan`: reuses the engine's parsed AST, renders it back canonically | 19 |
| 3. Schema layer | `BimOpenFlow.Relations/Schema`: one rule per operator, `ICatalog`, `SchemaCache` | 27 |
| 4. Compile layer | `BimOpenFlow.Relations/Compile`: one CTE per node, symbolic sources | 29 |
| 5. Registry and Execute | `BimOpenFlow.Relations.DuckDb`: `ConnectionRegistry`, `DuckDbSession`, `DuckDbCatalog`, `DuckDbExecutor`, `ResultCache` | 15 |
| 6. Nodes and host | `BimOpenFlow.Nodes.Relations` (11 kinds); `IRelationResults` in Host.Api; `RelationHostResults` and registry-from-roots in the host | 9 pack, 2 host, 1 API |

The host derives the connection registry from its model roots: each root
folder is a CSV source named after the folder, and each `.duckdb` file
directly inside a root is a database source named after the file. A
`sources.json` with explicit names and connection strings is the natural
next step and is not written.

Two test failures on the branch predate it and touch no file it changed:
`TablePacks_ContainsExactlyTheTableKinds` (an unlisted `duck.source`) and
`EmptyStore_SeedsBimAndView3dSamples` (an extra `snowdon-toolkit` sample).

## What stays open

- Memory policy for the materialization cache. Today every intermediate
  table is retained. With relations, only inspected or sunk results are.
  The cache needs a size bound; today's memo cache has none.
- The `Runs` freeze layer hashes external inputs by content. It needs a rule
  for a source reached through the registry: hash the resolved file, or
  record the registry entry and its version.
- Whether the client should show the inferred schema on the node before
  clicking. The API needs one new endpoint or a field on the node status.
