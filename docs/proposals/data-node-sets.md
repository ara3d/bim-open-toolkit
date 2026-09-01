# Proposal: the data node sets

> Proposal (Claude + Christopher Diggins, 2026-09-01). Designs an extensive
> node vocabulary for working with tables, CSV, XLSX, JSON, Parquet, DuckDB,
> and SQLite — aiming to cover ~90% of common tabular data workflows. Builds
> on `docs/nodes.md` (the shipped node reference) and
> `docs/proposals/core-node-sets.md`. Nodes are functions: every node here
> maps to one well-known operation with a named implementing function, and
> every option is a typed parameter (Boolean, Integer, Number, Text, Enum,
> DateTime, FilePath) directly on the node — no options blobs.

## First principles

A node is a pure function over immutable tables. Working backwards from what
people actually do with tabular data, every common workflow decomposes into
six layers:

1. **Get data in** — read a file or database into a table.
2. **See what you have** — schema, per-column statistics, samples.
3. **Fix it** — types, nulls, duplicates, text noise, date strings.
4. **Shape it** — select, filter, sort, join, pivot, aggregate, window.
5. **Escape hatch** — SQL, for the tail the vocabulary doesn't cover.
6. **Get data out** — write a file or database table.

Layer 4 is the relational algebra core (project, select, join, union,
group-by) plus the two additions practice demands: reshaping (pivot/unpivot)
and window functions. Layers 2 and 3 are what separate a demo vocabulary
from one that survives real files: real CSVs have wrong delimiters, real
spreadsheets have junk rows above the header, real date columns are text in
three formats. The 90% claim rests on covering layers 2 and 3 as seriously
as layer 4; the last 10% is layer 5's job, and `sql.query` already exists.

Design rules, inherited from the shipped packs and tightened:

- **One node, one function.** Every node names the function that implements
  it (a DuckDB clause or function, a ClosedXML call, a SQLite query). If no
  single real function implements it, it is not a node.
- **Typed parameters, no blobs.** Every option is a first-class parameter
  with a kind the editor can render: a Boolean is a checkbox, an Enum is a
  dropdown, an Integer is a spinner, a DateTime is a picker. The one `Json`
  parameter in this proposal (`table.inline`'s rows) *is* the data, not
  options.
- **Pure by default, cached by content.** File readers are pure with
  content-hash caching, the `bos.load` pattern. Writers are Effects and run
  only inside a Run.
- **Deterministic.** Sampling takes a seed; every ordering rule is stated.
- **Absence is reported, never silent.** Unknown columns, unmatched rows,
  failed casts: warn or error per a stated rule, configurable only where a
  workflow genuinely needs both behaviors (`onError` enums).

### Implementation backbone

Almost every transform node below compiles to one generated DuckDB SQL
statement run over the input table(s) loaded in-memory — exactly the
machinery `sql.query` already uses. This is the honest version of "nodes map
to real functions": each node is a typed, validated facade over one
documented DuckDB clause. The facade buys three things over raw SQL:
parameters the editor can render and the graph can promote, static
validation before execution, and warnings the raw clause would swallow.
XLSX nodes use ClosedXML; SQLite nodes use Microsoft.Data.Sqlite read-only.

### Spec change required: the DateTime parameter kind

Flow values stay the five kinds (Boolean, Integer, Number, Text, Table);
dates inside tables remain ISO-8601. But parameters need a **DateTime kind**:
canonical form is an ISO-8601 string in the graph document, and the editor
renders a date-time picker. Without it, every date bound on a node is a
free-text field waiting for a format bug. Used by `table.calendar` and
`date.filter` below, and available to future nodes. This is the only spec
change this proposal needs — optional input ports already exist (`sql.query`
uses them).

### Conventions used throughout

- **Column lists** are comma-separated names in a Text parameter (the
  `table.project` precedent). Names containing commas cannot be expressed;
  this is the shipped limitation, unchanged.
- **`name` parameters** naming a new output column error if the name already
  exists (the `table.derive` rule).
- **In-place column transforms** (cast, text ops, date ops) replace the
  column when `name` is blank and add a new column when it is not.
- **Readers** cache by (file content hash, parameter values); a missing file
  is an error.

---

## Pack layout

| Pack | Contents | Native dependency |
|---|---|---|
| `BimOpenFlow.Nodes.DuckDb` (exists) | file readers, DuckDB database access, `sql.query` | DuckDB |
| `BimOpenFlow.Nodes.Tables` (exists) | XLSX + SQLite access, generators, DuckDB-free combinators | ClosedXML, SQLite |
| `BimOpenFlow.Nodes.TableOps` (new) | rows, columns, reshape, window — generated-SQL transforms | DuckDB (via shared helper lib) |
| `BimOpenFlow.Nodes.Cleaning` (new) | nulls, duplicates, text, value replacement | DuckDB |
| `BimOpenFlow.Nodes.Dates` (new) | parse, extract, truncate, arithmetic, range filter | DuckDB |
| `BimOpenFlow.Nodes.Effects` (exists) | all writers | DuckDB, ClosedXML, SQLite |

Small packs over large ones, per the architecture rules: the three new packs
share the generic DuckDB helper library (a library below the packs, per the
no-pack-to-pack-references rule — this strengthens the case for graduating
`Ara3D.DuckDb` out of `Ara3D.BimOpenSchema.DuckDb`, open question 2 of the
core proposal). Cleaning and Dates nodes are the ones most likely to grow;
their own packs keep that growth contained.

---

## Set 1: Readers — `BimOpenFlow.Nodes.DuckDb`

The shipped `duck.read` (auto-dispatch on extension) stays as the zero-config
front door. The dedicated readers below exist because real files need
options, and options must be typed parameters, not a Json blob.

### `csv.read` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `path` (FilePath; glob patterns allowed, e.g. `data/*.csv`); `delimiter` (Text, default `,`); `header` (Boolean, default `true`); `skipRows` (Integer, default `0`); `quote` (Text, default `"`); `nullText` (Text, default empty); `encoding` (Enum: `utf8` \| `utf16` \| `latin1`, default `utf8`); `inferTypes` (Boolean, default `true`; false reads every column as text) |

Implements: DuckDB `read_csv`. A glob path unions all matching files (the
read-a-folder-of-monthly-exports workflow) with a `filename` column appended
so provenance survives the union. `skipRows` handles the title-lines-above-
the-header exports every ERP produces. With `header` false, columns are
named `Column1..N`.

### `parquet.read` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `path` (FilePath; glob patterns allowed) |

Implements: DuckDB `read_parquet`. Parquet is self-describing, so the node
needs no other parameters — the reason it is separate from `csv.read`.

### `json.read` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `path` (FilePath); `layout` (Enum: `auto` \| `records` \| `lines`, default `auto` — `records` is one JSON array of objects, `lines` is newline-delimited JSON); `flatten` (Boolean, default `false` — expands one level of nested objects into dotted columns) |

Implements: DuckDB `read_json` (`format` = `auto`/`array`/
`newline_delimited`); `flatten` generates one `unnest(..., recursive :=
false)` projection. Deeply nested JSON beyond one level is layer-5 territory:
read it un-flattened and use `sql.query` with DuckDB's struct syntax.

### `duck.table` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `path` (FilePath, a `.duckdb` database); `table` (Text) |

Implements: `SELECT * FROM "table"` against the read-only attached database.
The no-SQL-required companion to the shipped `duck.query`: point at a
database, name a table, get the table.

### `duck.tables` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `tables` (Table: `name`, `columnCount`, `rowCount`) |
| Params | `path` (FilePath) |

Implements: `information_schema.tables` on the read-only attachment.
Discovery: what is in this database I was handed?

Existing keepers in this pack, unchanged: **`duck.read`**, **`duck.query`**,
**`sql.query`** (the escape hatch: up to four flowing tables as `t1..t4`,
one validated read-only SELECT/WITH).

---

## Set 2: XLSX, SQLite, and generators — `BimOpenFlow.Nodes.Tables`

### `xlsx.read` — extend to v2, Pure

v1 params (`path`, `sheet`) plus: `headerRow` (Integer, default `1` — rows
above it are skipped, the junk-rows-above-the-header fix); `range` (Text,
default empty = the used range; an A1-style rectangle like `B3:F100`).

Implements: ClosedXML worksheet range read, as today. Typing rules
unchanged: one CLR type per column wins, otherwise text; dates read as
ISO-8601 text (`date.parse` then makes them real dates).

### `xlsx.sheets` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `sheets` (Table: `name`, `index`, `rowCount`, `columnCount`) |
| Params | `path` (FilePath) |

Implements: ClosedXML workbook worksheet enumeration. Discovery for
workbooks: see what exists before naming a sheet in `xlsx.read`.

### `sqlite.table` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `path` (FilePath); `table` (Text) |

Implements: `SELECT * FROM "table"` read-only, with v1's column-type
unification rules. The no-SQL companion to the shipped `sqlite.query`.

### `sqlite.tables` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `tables` (Table: `name`, `columnCount`, `rowCount`) |
| Params | `path` (FilePath) |

Implements: `sqlite_master` plus per-table counts, read-only.

### `table.inline` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `rows` (Json: an array of objects, e.g. `[{"type":"Wall","rate":120.5}]`) |

Small hand-typed lookup tables (rate cards, category mappings, thresholds)
without leaving the graph or shipping a side file. Column types are inferred
from the JSON values (bool/integer/number/text); heterogeneous columns are
an error, not a silent widening. The `Json` kind here is the data itself,
which is what the kind is for.

### `table.range` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table, one column) |
| Params | `name` (Text, default `value`); `start` (Number, default `0`); `stop` (Number); `step` (Number, default `1`) |

Implements: DuckDB `generate_series(start, stop, step)`. Test scaffolding,
bin edges, index columns.

### `table.calendar` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table, one ISO-8601 date column) |
| Params | `name` (Text, default `date`); `start` (DateTime); `end` (DateTime, inclusive); `step` (Enum: `day` \| `week` \| `month` \| `quarter` \| `year`, default `day`) |

Implements: `generate_series` over timestamps with an interval step. The
calendar-spine workflow: left-join actuals onto a complete date range so
gaps show as nulls instead of vanishing — the standard fix for misleading
time-series charts. First user of the DateTime parameter kind.

Existing keepers in this pack, unchanged: **`sqlite.query`**,
**`table.join`** (extended below), **`table.setOp`**, **`table.project`**.

---

## Set 3: Rows and columns — `BimOpenFlow.Nodes.TableOps`

Existing keepers (Bos pack): **`table.filter`**, **`table.derive`**,
**`table.aggregate`**, **`table.sort`**.

### `table.join` — extend to v2, Pure

v1 params plus `mode` gains values: `left` \| `inner` \| `full` \| `semi` \|
`anti` (default `left`). Semi keeps a-rows that match (no b columns
attached); anti keeps a-rows that do not — the two standard which-rows-are-
missing questions, otherwise awkward to express. Warning behavior unchanged:
unmatched counts and duplicate b-keys always surface.

Implements: the corresponding DuckDB join types.

### `table.distinct` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `columns` (Text, comma-separated; empty = whole-row distinct) |

Implements: `SELECT DISTINCT` (empty) or `DISTINCT ON (columns)` keeping the
first row per key in input order. With columns named, output keeps all
columns; use `table.dedupe` when you need keep-first/keep-last control.

### `table.limit` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `count` (Integer); `offset` (Integer, default `0`) |

Implements: `LIMIT count OFFSET offset` over the table's deterministic
order. Top-N after `table.sort`; paging through inspection.

### `table.sample` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `mode` (Enum: `rows` \| `fraction`, default `rows`); `rows` (Integer, default `100`); `fraction` (Number, 0–1, default `0.1`); `seed` (Integer, default `1`) |

Implements: `USING SAMPLE reservoir(n ROWS) REPEATABLE (seed)` /
`bernoulli(p%) REPEATABLE (seed)`. The seed keeps evaluation deterministic
and memoizable — a sample node without a seed would break the purity
contract.

### `table.concat` — new, Pure

| | |
|---|---|
| Inputs | `a` (Table), `b` (Table) |
| Outputs | `table` (Table) |
| Params | `columns` (Enum: `strict` \| `byName`, default `strict`) |

Implements: `UNION ALL` (strict: identical column sequences required, the
`check.union` rule) or `UNION ALL BY NAME` (byName: columns matched by name,
missing ones null-filled — the stack-twelve-monthly-exports-with-drifting-
columns workflow). Chain for more than two, as with `check.union`.
`table.setOp` remains the key-based row algebra; this is plain stacking.

### `table.rename` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `renames` (Text: comma-separated `old=new` pairs) |

Implements: projection with aliases. Unknown old names warn and are skipped
(the `table.project` rule); a new name colliding with a remaining column is
an error.

### `table.drop` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `columns` (Text, comma-separated) |

Implements: `SELECT * EXCLUDE (columns)`. The complement of
`table.project`: keep everything except. Unknown names warn.

### `table.cast` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `column` (Text); `type` (Enum: `boolean` \| `integer` \| `number` \| `text` \| `date` \| `datetime`); `onError` (Enum: `error` \| `null`, default `error`); `name` (Text, default empty = replace in place) |

Implements: `CAST` (onError error) / `TRY_CAST` (onError null, with a
warning counting the rows that became null). The workhorse fix for
numbers-as-text columns out of CSV and XLSX. `date`/`datetime` casts accept
ISO-8601 only; other formats go through `date.parse`.

### `table.splitColumn` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `column` (Text); `separator` (Text, default `-`); `names` (Text, comma-separated new column names); `keep` (Boolean, default `false` — keep the original column) |

Implements: one `split_part(column, separator, i)` per requested name.
Fewer parts than names yields nulls; extra parts are dropped. The
compound-key column (`Level-Zone-Type`) splitter.

---

## Set 4: Reshape and window — `BimOpenFlow.Nodes.TableOps`

### `table.pivot` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `groupBy` (Text, comma-separated row-key columns); `nameColumn` (Text — its distinct values become new columns); `valueColumn` (Text); `aggregate` (Enum: `first` \| `sum` \| `count` \| `min` \| `max` \| `avg`, default `first`) |

Implements: DuckDB `PIVOT ... ON nameColumn USING agg(valueColumn) GROUP BY
groupBy`. Long to wide. New columns are ordered by sorted distinct value for
determinism. This is also `bos.parameters` generalized: that node is exactly
a pivot of the long parameter table.

### `table.unpivot` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `keep` (Text, comma-separated id columns that stay as-is); `columns` (Text, comma-separated columns to unpivot; empty = every column not in `keep`); `nameColumn` (Text, default `name`); `valueColumn` (Text, default `value`) |

Implements: DuckDB `UNPIVOT`. Wide to long — the one-column-per-month
spreadsheet into tidy rows. Unpivoted columns of mixed types widen to text
with a warning.

### `table.transpose` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `headerColumn` (Text; empty = first column supplies new headers) |

Rows become columns. Implemented in-memory over `IDataTable` (it is a small
utility, not a query — the one node in this set that is not generated SQL).
All value cells widen to text. Intended for small summary tables headed to
reports; a guard errors above 1,000 rows.

### `table.window` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table, input plus one column) |
| Params | `function` (Enum: `rowNumber` \| `rank` \| `denseRank` \| `lag` \| `lead` \| `cumSum` \| `movingAvg` \| `percentOfTotal`); `column` (Text; the value column — unused for rowNumber/rank/denseRank); `partitionBy` (Text, comma-separated, default empty); `orderBy` (Text, `table.sort` syntax); `offset` (Integer, default `1` — lag/lead only); `windowSize` (Integer, default `3` — movingAvg only: this row and the N−1 before it); `name` (Text, the new column) |

Implements: one `OVER (PARTITION BY ... ORDER BY ...)` window per function —
`row_number()`, `rank()`, `dense_rank()`, `lag/lead(column, offset)`,
`sum(column) ROWS UNBOUNDED PRECEDING`, `avg(column) ROWS windowSize−1
PRECEDING`, `column / sum(column) OVER (PARTITION BY ...)`. One enum instead
of eight nodes because the parameter shape is shared and the editor can
show/hide the irrelevant ones per function. Covers running totals,
period-over-period deltas (lag → derive), rankings, and share-of-total —
the four analytics asks that otherwise all fall through to SQL.

### `table.schema` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `schema` (Table: `column`, `type`, `index`) |
| Params | — |

The table's shape *as a table*, so it can flow: diff two schemas with
`table.setOp`, check required columns, drive documentation sinks.

### `table.profile` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `profile` (Table: one row per column — `column`, `type`, `count`, `nullCount`, `distinctCount`, `min`, `max`, `mean`) |
| Params | — |

Implements: DuckDB `SUMMARIZE`. The look-before-you-clean step: which
columns are null-riddled, what ranges are suspicious. `min`/`max`/`mean` are
null for non-numeric columns; `min`/`max` are lexical for text.

---

## Set 5: Cleaning — `BimOpenFlow.Nodes.Cleaning`

### `table.fillNulls` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `columns` (Text, comma-separated); `strategy` (Enum: `constant` \| `forward` \| `backward`, default `constant`); `value` (Text, canonical form, cast to each column's type — constant only); `partitionBy` (Text, default empty — forward/backward reset at partition boundaries) |

Implements: `coalesce(column, value)` (constant) or `last_value(column
IGNORE NULLS) OVER (...)` (forward; backward reverses the frame). Fill
order is the table's deterministic row order. Forward-fill is the
merged-cells-out-of-Excel fix: the category column that only has a value on
its first row.

### `table.dropNulls` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `columns` (Text, comma-separated; empty = all columns); `mode` (Enum: `any` \| `all`, default `any` — drop the row when any / when all listed columns are null) |

Implements: a generated `WHERE ... IS NOT NULL` conjunction/disjunction.
Reports the dropped-row count as a warning, never silently.

### `table.dedupe` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `keys` (Text, comma-separated); `keep` (Enum: `first` \| `last`, default `first`); `orderBy` (Text, `table.sort` syntax; empty = input row order) |

Implements: `row_number() OVER (PARTITION BY keys ORDER BY ...)` with
`QUALIFY rn = 1`. The keep-the-latest-record-per-id workflow (`keep` `last`
with `orderBy` a timestamp column). Duplicate count surfaces as a warning.

### `table.replace` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `column` (Text); `find` (Text); `replaceWith` (Text); `match` (Enum: `exact` \| `substring` \| `regex`, default `exact`); `caseSensitive` (Boolean, default `true`) |

Implements: `CASE WHEN column = find` (exact), `replace(column, find,
replaceWith)` (substring), `regexp_replace(column, find, replaceWith, 'g')`
(regex). Text columns only. Recoding sentinel values (`N/A` → empty,
`Unknown` → null via empty `replaceWith` on an exact match) and typo repair.

### `text.transform` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `columns` (Text, comma-separated; empty = every text column); `op` (Enum: `trim` \| `upper` \| `lower` \| `normalizeSpace`) |

Implements: `trim`, `upper`, `lower`, `regexp_replace(trim(c), '\s+', ' ',
'g')` applied in place. Join keys that fail on invisible whitespace are the
single most common join bug; this is the standard pre-join step.

### `text.extract` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table, input plus one column) |
| Params | `column` (Text); `pattern` (Text, a regular expression); `group` (Integer, default `1` — capture group; `0` is the whole match); `name` (Text, the new column) |

Implements: `regexp_extract(column, pattern, group)`; no match yields null.
Pulling the level number out of `"Level 03 - Zone B"`, the unit out of
`"240 mm"`. Pairs with `table.cast` to make the extract numeric.

---

## Set 6: Dates — `BimOpenFlow.Nodes.Dates`

Dates arrive as text (the XLSX and CSV readers guarantee it). This set turns
them into real temporal values and back into the columns reports need.
All nodes follow the in-place-unless-named convention via a `name` param.

### `date.parse` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `column` (Text); `format` (Text, strptime syntax e.g. `%d/%m/%Y`; empty = ISO-8601); `onError` (Enum: `error` \| `null`, default `error`); `name` (Text, default empty = in place) |

Implements: `strptime(column, format)` / `TRY_CAST` for ISO. The entry
point to this set: everything below requires a parsed date/datetime column
and errors on a text column, pointing here.

### `date.part` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table, input plus one Integer column) |
| Params | `column` (Text); `part` (Enum: `year` \| `quarter` \| `month` \| `week` \| `dayOfMonth` \| `dayOfWeek` \| `dayOfYear` \| `hour` \| `minute` \| `second`); `name` (Text) |

Implements: `date_part(part, column)`. `dayOfWeek` is ISO (Monday = 1).
Feeds group-bys (totals by month number) and filters (weekends).

### `date.truncate` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `column` (Text); `period` (Enum: `year` \| `quarter` \| `month` \| `week` \| `day` \| `hour`); `name` (Text, default empty = in place) |

Implements: `date_trunc(period, column)`. The standard time-series
group-by key: truncate to month, aggregate, chart. Unlike `date.part`, the
result is still a date, so it sorts and joins correctly across years.

### `date.diff` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table, input plus one Integer column) |
| Params | `a` (Text, column); `b` (Text, column); `unit` (Enum: `years` \| `months` \| `days` \| `hours` \| `minutes` \| `seconds`, default `days`); `name` (Text) |

Implements: `date_diff(unit, a, b)` — the count of unit boundaries from `a`
to `b`, negative when `b` is earlier. Durations: planned vs actual, age of
open issues.

### `date.offset` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `column` (Text); `amount` (Integer, may be negative); `unit` (Enum: `years` \| `months` \| `days` \| `hours` \| `minutes`, default `days`); `name` (Text, default empty = in place) |

Implements: `column + amount * INTERVAL '1 unit'` with DuckDB's calendar
rules for month/year arithmetic. Due dates, look-back windows.

### `date.filter` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `column` (Text); `from` (DateTime, inclusive; empty = open start); `to` (DateTime, exclusive; empty = open end) |

Implements: `WHERE column >= from AND column < to`, half-open so adjacent
ranges never overlap. Exists alongside the general `table.filter` because a
date bound belongs in a DateTime parameter with a picker — promoted to a
graph parameter, it becomes the report's date-range control (UX pillar 10) —
not as a date literal spliced into an expression string.

---

## Set 7: Writers — `BimOpenFlow.Nodes.Effects`

All Effects: they run only inside a Run. All output the standard one-row
summary table (`path`, `rowCount`, plus noted extras). All create parent
directories as needed and replace the target file atomically
(write-temp-then-rename).

### `sink.exportCsv` — extend to v2, Effect

v1 params plus: `delimiter` (Text, default `,`); `header` (Boolean, default
`true`). Implements: RFC-4180 writer, as shipped.

### `sink.exportParquet` — new, Effect (carried over from the core proposal)

| | |
|---|---|
| Inputs | `in` (Table) |
| Outputs | `out` (Table, summary) |
| Params | `path` (FilePath); `compression` (Enum: `zstd` \| `snappy` \| `none`, default `zstd`) |

Implements: DuckDB `COPY TO ... (FORMAT PARQUET)`. The Power BI / pipeline
hand-off.

### `sink.exportJson` — new, Effect

| | |
|---|---|
| Inputs | `in` (Table) |
| Outputs | `out` (Table, summary) |
| Params | `path` (FilePath); `layout` (Enum: `records` \| `lines`, default `records`); `indent` (Boolean, default `false` — records only) |

Implements: DuckDB `COPY TO ... (FORMAT JSON, ARRAY true/false)`. `records`
for APIs and web apps, `lines` for streaming pipelines.

### `sink.exportXlsx` — new, Effect

| | |
|---|---|
| Inputs | `in` (Table) |
| Outputs | `out` (Table, summary + `sheet`) |
| Params | `path` (FilePath); `sheet` (Text, default `Sheet1`); `mode` (Enum: `replaceFile` \| `replaceSheet`, default `replaceFile` — replaceSheet updates one sheet of an existing workbook, creating the file if absent); `autoWidth` (Boolean, default `true`); `headerBold` (Boolean, default `true`) |

Implements: ClosedXML. `replaceSheet` is the refresh-the-data-tab-of-the-
report-workbook workflow: humans own the other sheets, the graph owns this
one. Chain several nodes with different `sheet` names to build a multi-sheet
workbook.

### `sink.exportSqlite` — new, Effect

| | |
|---|---|
| Inputs | `in` (Table) |
| Outputs | `out` (Table, summary + `table`) |
| Params | `path` (FilePath); `table` (Text); `mode` (Enum: `replace` \| `append` \| `failIfExists`, default `replace`) |

Implements: Microsoft.Data.Sqlite — `DROP TABLE IF EXISTS` + `CREATE TABLE`
+ batched inserts in one transaction (replace); `append` requires a
compatible column set and errors otherwise. Hand-off to any tool that speaks
SQLite, and the poor-man's incremental store.

### `sink.exportDuckDb` — new, Effect

| | |
|---|---|
| Inputs | `in` (Table) |
| Outputs | `out` (Table, summary + `table`) |
| Params | `path` (FilePath, a `.duckdb` database); `table` (Text); `mode` (Enum: `replace` \| `append` \| `failIfExists`, default `replace`) |

Implements: DuckDB `CREATE OR REPLACE TABLE ... AS` / `INSERT INTO` on a
writable connection — the *only* node that ever opens a DuckDB file
writable. Round-trip: build a curated database with the graph, query it
elsewhere with `duck.query`/`duck.table`.

---

## Coverage: the 90% argument

The common tabular workflows, from first principles, and their node chains:

| Workflow family | Chain |
|---|---|
| Ingest & inspect a file | `csv.read` / `xlsx.read` / `json.read` / `parquet.read` → `table.profile`, `table.schema`, `table.sample` |
| Read a folder of files | `csv.read` (glob) — `filename` column preserves provenance |
| Fix types and headers | `xlsx.read` v2 (`headerRow`) → `table.rename` → `table.cast` → `date.parse` |
| Clean messy values | `text.transform` → `table.replace` → `table.fillNulls` → `table.dropNulls` → `table.dedupe` |
| Enrich from a second source | reader → `text.transform` (key hygiene) → `table.join` (left/inner) |
| Which rows are missing? | `table.join` (semi/anti) |
| Stack periodic exports | `table.concat` (byName) or `csv.read` glob |
| Filter, top-N | `table.filter` / `date.filter` → `table.sort` → `table.limit` |
| Summarize | `table.aggregate`; share-of-total via `table.window` (percentOfTotal) |
| Time series | `date.parse` → `date.truncate` → `table.aggregate` → `table.calendar` + `table.join` (gap fill) → `table.window` (movingAvg, lag) |
| Wide ↔ long | `table.pivot` / `table.unpivot`; report transposes via `table.transpose` |
| Rank / running totals / deltas | `table.window` |
| Small lookup data | `table.inline`, `table.range` |
| Database in | `duck.tables` → `duck.table` / `duck.query`; `sqlite.tables` → `sqlite.table` / `sqlite.query` |
| Database out / round-trip | `sink.exportDuckDb` / `sink.exportSqlite` |
| Report / hand-off | `sink.exportXlsx` (replaceSheet) / `sink.exportCsv` / `sink.exportParquet` / `sink.exportJson` / `sink.report` |
| The long tail | `sql.query` — full DuckDB SQL over up to four flowing tables |

What is deliberately **out**, and why:

- **Multi-statement SQL / DDL over external databases.** The graph reads
  external databases read-only and writes only through its own sinks.
  Anything else is a database administration task, not a flow.
- **Deep JSON restructuring** beyond one flatten level — `sql.query` with
  struct syntax is strictly better than a forest of path-extraction nodes.
- **Fuzzy joins, ML imputation, statistical modeling.** Real workflows, not
  *common* ones; each would be its own pack with its own dependencies.
- **Streaming / larger-than-memory data.** The engine materializes tables;
  DuckDB pushes the practical ceiling into the hundreds of millions of rows,
  which is beyond the target workloads.
- **Cell-level spreadsheet editing** (formulas, formatting beyond the two
  Booleans on `sink.exportXlsx`). The currency is tables, not worksheets.

## Census

| Set | Exists | Extend | New |
|---|---|---|---|
| Readers (DuckDb) | 3 (`duck.read`, `duck.query`, `sql.query`) | 0 | 5 (`csv.read`, `parquet.read`, `json.read`, `duck.table`, `duck.tables`) |
| XLSX/SQLite/generators (Tables) | 2 (`xlsx.read`, `sqlite.query`) | 1 (`xlsx.read` v2) | 6 (`xlsx.sheets`, `sqlite.table`, `sqlite.tables`, `table.inline`, `table.range`, `table.calendar`) |
| Rows & columns (TableOps) | 6 (`filter`, `derive`, `sort`, `join`, `setOp`, `project`) | 1 (`table.join` v2) | 8 (`distinct`, `limit`, `sample`, `concat`, `rename`, `drop`, `cast`, `splitColumn`) |
| Reshape & window (TableOps) | 1 (`table.aggregate`) | 0 | 6 (`pivot`, `unpivot`, `transpose`, `window`, `schema`, `profile`) |
| Cleaning | 0 | 0 | 6 (`fillNulls`, `dropNulls`, `dedupe`, `replace`, `text.transform`, `text.extract`) |
| Dates | 0 | 0 | 6 (`parse`, `part`, `truncate`, `diff`, `offset`, `filter`) |
| Writers (Effects) | 1 (`sink.exportCsv`) | 1 (v2) | 6 (`exportParquet`, `exportJson`, `exportXlsx`, `exportSqlite`, `exportDuckDb`) |

Thirty-seven new kinds, three extensions, one spec change (the DateTime
parameter kind), three new packs (`TableOps`, `Cleaning`, `Dates`). Every
node is a typed facade over one named function; nothing here requires new
engine machinery beyond the DateTime parameter kind.

## Suggested build order

1. **DateTime parameter kind** (spec + editor) — unblocks Dates.
2. **Readers + writers** (`csv.read`, `parquet.read`, `json.read`,
   `sink.exportParquet/Json/Xlsx`) — highest workflow leverage per node.
3. **Rows & columns** (`distinct`, `limit`, `rename`, `drop`, `cast`,
   `concat`, join v2) — mostly one generated clause each.
4. **Cleaning + Dates** — the messy-data delta.
5. **Reshape & window** (`pivot`, `unpivot`, `window`, `profile`) — the
   analytics tier.
6. **Database access** (`duck.table/tables`, `sqlite.table/tables`,
   `sink.exportSqlite/DuckDb`, `inline`, `range`, `calendar`, `transpose`,
   `schema`, `sample`, `splitColumn`, text nodes) — completes the census.

## Open questions

1. **Variadic `table.concat`.** Stacking twelve monthly exports through
   eleven chained concats is tolerable but ugly. Same engine question as
   `check.union` (core proposal, open question 1); the glob path on
   `csv.read` removes the most common case.
2. **`duck.read` vs the dedicated readers.** Keep both (auto front door +
   typed control), or retire `duck.read` once `csv.read`/`parquet.read`/
   `json.read` land? Leaning keep: zero-config reading is a real workflow.
3. **Where `table.filter`/`derive`/`aggregate`/`sort` live.** They ship in
   the Bos pack for historical reasons but are BIM-free; `TableOps` is their
   natural home. Relocate now (no shipped graphs to migrate) or leave?
4. **Multi-column ops.** `table.cast`, `table.replace`, and the date nodes
   take one column; comma-separated multi-column variants would cut chain
   length but multiply the error-reporting matrix. Start single-column,
   revisit against real graphs.
5. **`table.profile` output stability.** `SUMMARIZE`'s output columns vary
   by DuckDB version; the node should project a fixed column set so graphs
   don't break on engine upgrades. Confirm the fixed set against the pinned
   DuckDB version.
6. **Temporal value kinds.** Dates stay ISO-8601 text in tables (only the
   *parameter* kind is new). If date-heavy graphs multiply, a first-class
   Date column type in `IDataTable` is the deeper fix; this proposal works
   without it.
