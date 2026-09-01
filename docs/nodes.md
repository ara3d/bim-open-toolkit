# BimOpenFlow node reference

> GENERATED FILE — do not edit by hand. This file is produced by the
> `BimOpenFlow.NodeDocs` tool from the node packs' `NodeSpec` declarations.
> To change it, change the specs or the generator and regenerate.

A node is a pure function over flow values. Values travel along graph edges
as one of five kinds — Boolean, Integer, Number, Text, or Table — and tables
are the currency: almost everything useful is an immutable table flowing
from node to node. A node reads its input values and parameters, and
returns its output values. It holds no state between evaluations.

**Pure vs Effect.** Pure nodes may be evaluated freely and their results
memoized; evaluating one twice with the same inputs gives the same answer
and touches nothing outside the graph. Effect nodes (file writers, report
generators) execute only inside an explicit Run — the engine refuses to
evaluate them otherwise — so re-evaluation for display can never write to
disk behind your back.

**Required vs optional inputs.** A node is normally not ready to evaluate
until every input port is connected. A port marked optional is the
exception: left unconnected, it does not block evaluation — the node
receives a placeholder in that position and treats the input as absent.
The placeholder never flows along an edge and is never an output.

**Parameters.** Parameters are configuration, not wires: every value is
stored in canonical string form in the graph document, and each parameter
declares a kind (Boolean, Integer, Number, Text, Enum, FilePath, ModelRef,
Expression, Json) that says how the string is interpreted and edited. Enum
parameters list their allowed values; an empty default means the parameter
starts blank.

**File-reading nodes and caching.** Nodes that read files (`bos.load`,
`duck.read`, `xlsx.read`, `view3d.instances`) are pure despite touching
disk: the cache key is a hash of the file's content, so an unchanged file
is never re-read and an edited file is picked up automatically — the key
is the content itself, not the path or a timestamp.

## Packs

| Pack | Nodes | Kinds |
|---|---|---|
| BOS — `BimOpenFlow.Nodes.Bos` | 6 | `bos.load`, `bos.query`, `table.filter`, `table.derive`, `table.aggregate`, `table.sort` |
| Geometry — `BimOpenFlow.Nodes.Geometry` | 4 | `view3d.instances`, `view3d.color`, `view3d.isolate`, `view3d.camera` |
| Compliance — `BimOpenFlow.Nodes.Compliance` | 4 | `check.rule`, `check.required`, `check.rollup`, `check.union` |
| Effects — `BimOpenFlow.Nodes.Effects` | 3 | `sink.exportCsv`, `sink.writePsets`, `sink.report` |
| DuckDB — `BimOpenFlow.Nodes.DuckDb` | 3 | `duck.read`, `duck.query`, `sql.query` |
| Tables — `BimOpenFlow.Nodes.Tables` | 5 | `xlsx.read`, `sqlite.query`, `table.join`, `table.setOp`, `table.project` |

## BOS — `BimOpenFlow.Nodes.Bos`

Loading BIM Open Schema (.bos) files and the core table transforms: filter, derive, aggregate, sort.

### `bos.load` (v1) — Pure

Loads a BIM Open Schema (.bos) file and outputs its entity, parameter, and relation text tables.

Loads the .bos file into an in-memory DuckDB once and outputs three materialized text views: `entities`, `parameters`, and `relations`, each deterministically ordered. Results are cached per (file content hash, harmonize flag), so re-evaluations of unchanged content never reload and edits to the file are picked up automatically. With `harmonize` true, the data is passed through the BOS harmonizer (appends SI canonical columns) before the views are built. A missing file is an error.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `entities` | Table |
| `parameters` | Table |
| `relations` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |
| `harmonize` | Boolean | `false` | — |

### `bos.query` (v1) — Pure

Runs one read-only SQL query over the input table, available as 't'.

The input table is loaded into an in-memory DuckDB as table `t`. The query must be read-only. The node predates `sql.query`, which generalizes it to four inputs.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `sql` | Text | — | — |

### `table.filter` (v1) — Pure

Keeps rows where the Boolean expression is true; null results exclude the row.

The expression must be statically Boolean; a non-Boolean expression is an error. A row is kept only when the expression is true — a null result excludes the row (SQL WHERE semantics).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `expr` | Expression | — | — |

### `table.derive` (v1) — Pure

Outputs the input table plus one computed column.

The new column's type comes from the expression's static type; rows where the expression is null get a null cell. It is an error if the column name already exists, or if the expression is always null (no type can be inferred).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `name` | Text | — | — |
| `expr` | Expression | — | — |

### `table.aggregate` (v1) — Pure

Groups by the comma-separated groupBy columns (may be empty) and computes comma-separated 'func(column) as name' aggregates (count/sum/min/max/avg).

Runs via DuckDB. Each aggregate is written `func(column) as name` with funcs count, sum, min, max, avg; only count accepts `*`. Sums are cast (BIGINT for integer columns, DOUBLE otherwise) so the result type is predictable. `groupBy` may be empty (one summary row); when present, output rows are ordered by the group columns for determinism.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `groupBy` | Text | — | — |
| `aggregates` | Text | — | — |

### `table.sort` (v1) — Pure

Sorts by comma-separated column names, each optionally suffixed with ' desc'.

Runs via DuckDB. Each comma-separated term is a column name with an optional ` desc` (or explicit ` asc`) suffix. Column names containing commas or spaces cannot currently be expressed.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `by` | Text | — | — |

## Geometry — `BimOpenFlow.Nodes.Geometry`

The view3d pack: the tables the 3D pane consumes — instances, colors, isolation, camera.

### `view3d.instances` (v1) — Pure

Renderable instances of a model file as a table: one row per placed mesh, with entity ids and world bounds.

One row per placed mesh, with entity ids and world bounds. The loaded geometry is cached by file content hash.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |

### `view3d.color` (v1) — Pure

Adds r,g,b,a color columns to an instance table by joining a value table on a shared column.

Numeric value columns map through a gradient normalized over the column's min..max range; text values map categorically, with palette indices assigned by sorted distinct value so colors are stable under row reordering. A non-numeric value column with a gradient colorMap warns and falls back to category10. Instance rows with no match in the value table get gray; alpha is always 1.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `values` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `joinColumn` | Text | — | — |
| `valueColumn` | Text | — | — |
| `colorMap` | Enum | `viridis` | `viridis`, `category10`, `redgreen` |

### `view3d.isolate` (v1) — Pure

Keeps only the instance rows whose join column value appears in the ids table.

The ids table is matched on its column with the same name as `joinColumn`, or its first column when no such column exists.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `ids` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `joinColumn` | Text | — | — |

### `view3d.camera` (v1) — Pure

A named camera as a one-row table: position and look-at target.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `camera` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `name` | Text | `default` | — |
| `posX` | Number | `0` | — |
| `posY` | Number | `0` | — |
| `posZ` | Number | `0` | — |
| `targetX` | Number | `0` | — |
| `targetY` | Number | `0` | — |
| `targetZ` | Number | `0` | — |

## Compliance — `BimOpenFlow.Nodes.Compliance`

The verdict-bearing vocabulary: rule checks, required-data checks, rollups, and unions of verdict tables.

### `check.rule` (v1) — Pure

Per row: expr true = Pass, false = Fail (NeedsReview where reviewExpr is true), null = InfoNotAvailable.

Per row: `expr` true is Pass; false is Fail, unless `reviewExpr` is also true, which makes it NeedsReview; a null result (missing data) is InfoNotAvailable. An empty `reviewExpr` means false never escalates to NeedsReview. The output is the input columns plus the verdict columns (`verdict`, `checkId`, `checkTitle`, `citation`).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `checkId` | Text | — | — |
| `title` | Text | — | — |
| `citation` | Text | — | — |
| `expr` | Expression | — | — |
| `reviewExpr` | Expression | — | — |

### `check.required` (v1) — Pure

Required data check: missing column = InfoNotAvailable everywhere; null cell = Fail; else Pass.

If any listed column is missing from the table, the node warns and every row is InfoNotAvailable. Otherwise a row with a null cell in any listed column is Fail, else Pass. Data absence is reported, never skipped.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `checkId` | Text | — | — |
| `title` | Text | — | — |
| `citation` | Text | — | — |
| `columns` | Text | — | — |

### `check.rollup` (v1) — Pure

Groups a verdict table by checkId into counts and the worst verdict per check.

Input must be a verdict table. Output has one row per checkId in first-appearance order, with per-verdict counts (`passCount`, `failCount`, `needsReviewCount`, `infoNotAvailableCount`) and `worst`, the worst verdict present by severity Fail > NeedsReview > InfoNotAvailable > Pass.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**: none

### `check.union` (v1) — Pure

Concatenates two verdict tables with identical columns; chain for more.

Both inputs must be verdict tables with identical column-name sequences; the output is a's rows followed by b's. The spec cannot express variadic inputs, so the node takes exactly two — chain unions to combine more tables.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**: none

## Effects — `BimOpenFlow.Nodes.Effects`

Every Run-gated sink: CSV export, IFC property-set write-back, and HTML reports.

### `sink.exportCsv` (v1) — Effect

Writes the input table as RFC-4180 CSV (header row, invariant formatting). Outputs a one-row summary (path, rowCount).

Effect: runs only inside a Run. Writes the table as RFC-4180 CSV with a header row and invariant formatting.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |

### `sink.writePsets` (v1) — Effect

Byte-exact pset write-back: reads sourcePath, appends psets from the input table, writes targetPath. Outputs a one-row summary (targetPath, entitiesTouched, valuesWritten).

Effect: runs only inside a Run. Input rows (`entityId`, `psetName`, `paramName`, `paramValue`) are grouped by (entityId, psetName) in first-appearance order; each group becomes one IfcPropertySet attached to the entity, appended to a byte-exact copy of the source file. An entity id not present in the source file is an error. v1 limitation: every value is written as IFCTEXT; typed measures come later.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `sourcePath` | FilePath | — | — |
| `targetPath` | FilePath | — | — |

### `sink.report` (v1) — Effect

Writes a standalone HTML report (title + table). Outputs a one-row summary (path, rowCount).

Effect: runs only inside a Run. The report is a minimal standalone HTML page: the title followed by the table.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |
| `title` | Text | — | — |

## DuckDB — `BimOpenFlow.Nodes.DuckDb`

File readers backed by DuckDB and SQL over flowing tables. BIM-free; every value is a plain table.

### `duck.read` (v1) — Pure

Loads a CSV, Parquet, or JSON file into a table using DuckDB's readers.

With `format` auto, the reader is inferred from the file extension (.csv, .parquet, .json); any other extension is an error telling you to set `format`. The loaded table is cached by (file content hash, reader), so unchanged files never reload. A missing file is an error.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |
| `format` | Enum | `auto` | `auto`, `csv`, `parquet`, `json` |

### `duck.query` (v1) — Pure

Runs one read-only SQL query against a .duckdb database file.

The database file is opened read-only (the node can never mutate it), and the SQL is validated as a single SELECT or WITH statement before it runs.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |
| `sql` | Text | — | — |

### `sql.query` (v1) — Pure

Runs one read-only SQL query over the connected input tables t1..t4 (t = t1).

Connected inputs load into an in-memory DuckDB as `t1`..`t4`, and `t` is a view of `t1`, so single-table queries can just say `FROM t`. Ports `t2`..`t4` are optional: unconnected ones are simply absent from the database. The SQL is validated as a single read-only SELECT or WITH statement. The dialect is DuckDB's.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `t1` | Table | required |
| `t2` | Table | optional |
| `t3` | Table | optional |
| `t4` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `sql` | Text | — | — |

## Tables — `BimOpenFlow.Nodes.Tables`

XLSX and SQLite readers plus table combinators: join, set operations, and projection. BIM-free, DuckDB-free.

### `xlsx.read` (v1) — Pure

Reads a worksheet (named, or the first) from an .xlsx file; row 1 is the header.

An empty `sheet` means the first worksheet; a named sheet that does not exist is an error. Row 1 of the used range is the header (blank headers become Column1, Column2, ...). Each column's type is inferred: if all non-null cells share one CLR type that type wins, otherwise the column is text. Dates are read as ISO-8601 text. The result is cached by (file content hash, sheet).

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |
| `sheet` | Text | — | — |

### `sqlite.query` (v1) — Pure

Runs one read-only SQL query against a SQLite database file.

The database file is opened read-only, and the SQL is validated as a single SELECT or WITH statement. SQLite columns are dynamically typed per row, so each result column is unified: one non-null CLR type wins, a mix of integer and real widens to real, anything else lands as text.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `path` | FilePath | — | — |
| `sql` | Text | — | — |

### `table.join` (v1) — Pure

Joins b's columns onto a by key (bKey defaults to aKey); left keeps all a rows, inner keeps matches.

Joins b's columns onto a by key, matching on canonical cell text; `bKey` defaults to `aKey` when blank. Mode `left` keeps every a row (unmatched rows get null b cells); `inner` keeps only matches. Unmatched rows and duplicate keys in b are warned about, never silent — with duplicates, the first b occurrence wins. b's key column is dropped from the output, and a b column whose name collides with an a column (case-insensitive) is suffixed `_b`.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `aKey` | Text | — | — |
| `bKey` | Text | — | — |
| `mode` | Enum | `left` | `left`, `inner` |

### `table.setOp` (v1) — Pure

Keeps a's rows by key-set operation with b: union, intersect, or subtract.

Row-set algebra on a key column; a's columns and row order pass through. `intersect` keeps a rows whose key appears in b, `subtract` keeps those whose key does not, and `union` appends b rows whose key is absent from a. Union requires b to have exactly a's column set (matched case-insensitively); any missing or extra column is an error.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `op` | Enum | `intersect` | `union`, `intersect`, `subtract` |
| `key` | Text | — | — |

### `table.project` (v1) — Pure

Keeps the comma-separated columns, in that order; unknown names warn.

Keeps the named columns in the given order. A name with no matching column warns and is skipped rather than erroring; naming no columns at all is an error.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values |
|---|---|---|---|
| `columns` | Text | — | — |
