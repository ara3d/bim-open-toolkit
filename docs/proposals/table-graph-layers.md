# Table graph: a four-layer design

> Proposal, 2026-09-17. Describes how a node graph that joins databases,
> CSV files, and other tabular sources into new tables should be built so
> that planning, typing, compiling, and running data are separate layers.
> Nothing here is implemented yet. It does not depend on any earlier
> BimOpenFlow node design.

## The problem

A user drops sources on a canvas, wires them through filters, joins, and
aggregates, and ends at one or more output tables. They expect to click any
node and see the rows at that point. The design question is what travels
along a wire, and how the parts of the system depend on each other.

The answer this document gives: a wire carries a **relation**, which is a
logical plan plus its schema. Rows never travel along wires. Rows appear only
when a node is inspected or a sink is run, and they are produced by a layer
that the rest of the system does not depend on.

## The four layers

```
  Plan     ->  Schema   ->  Compile  ->  Execute
  (values)     (typing)     (to SQL)     (rows)
```

Dependencies point right to left only. Plan knows nothing. Schema and Compile
know Plan. Execute knows Compile. The graph editor sits on top and calls each
layer through one or two functions.

| Layer   | Input                | Output               | Touches I/O          |
|---------|----------------------|----------------------|----------------------|
| Plan    | operator arguments   | immutable plan tree  | never                |
| Schema  | plan + catalog       | typed columns, or an error | catalog only (headers, `information_schema`) |
| Compile | plan                 | SQL text             | never                |
| Execute | SQL + connection     | table                | yes                  |

Each layer is a separate project or package with its own tests. A layer is
finished when the layers to its right can be replaced without editing it.

### Layer 1: Plan

A plan is an immutable tree of operator records. Each record names one
relational operator and holds its arguments. Inputs are child plans.

```
Plan =
  | ReadCsv(path, options)
  | ReadTable(connection, schema, table)
  | RawSql(sql, inputs: Plan[])
  | Select(input, columns)
  | Rename(input, map)
  | Cast(input, column, type)
  | Derive(input, name, expression)
  | Filter(input, predicate)
  | Distinct(input)
  | Sort(input, keys)
  | Limit(input, count)
  | Join(left, right, keys, kind)
  | Union(inputs)
  | Aggregate(input, groupBy, aggregates)
  | Pivot(input, ...)
  | Unpivot(input, ...)
  | Window(input, ...)
```

Expressions inside `Derive`, `Filter`, and `Aggregate` are a small expression
tree of their own: column references, literals, operators, and function calls.
Not SQL strings. Keeping expressions structured is what lets the Schema layer
type them and the Compile layer emit them for more than one backend.

What this layer provides:

- Constructors, one per operator.
- Structural equality and a stable hash. Two nodes with identical upstream
  chains hash the same. Every cache downstream is keyed on this hash.
- A visitor or fold, so the other layers can walk a plan without knowing its
  shape in detail.
- Optional rewrites, such as pushing a filter beneath a join. Rewrites are
  plan-to-plan functions and are not required for a first version.

What this layer does not do: read a file, open a connection, know a column
type, or hold a row. A plan can be built and tested with no database present.

A saved graph document is the plan for every node plus canvas layout. It
holds no data and no rows, so it is small and diffs cleanly.

### Layer 2: Schema

```
infer(plan: Plan, catalog: ICatalog) -> Schema | SchemaError
```

A `Schema` is an ordered list of `(name, type, nullable)`. The type
vocabulary is deliberately short: boolean, integer, number, text, date,
timestamp, binary, and unknown.

`ICatalog` is a one-method interface: given a source description, return its
schema. The DuckDB implementation reads a CSV header or queries
`information_schema`. A fake implementation returns whatever a test says.
This is the only I/O on the design-time side, and it is cheap.

Each operator has one inference rule:

- `Filter`, `Sort`, `Limit`, `Distinct` return their input schema unchanged.
- `Select` and `Rename` reorder or relabel.
- `Join` concatenates left and right, prefixing collisions.
- `Aggregate` returns the group keys followed by one column per aggregate.
- `Derive` appends a column whose type is the type of its expression.

Errors are values, not exceptions: unknown column, join keys of different
types, an expression that applies arithmetic to text. The editor shows them
on the node before anything runs.

Schema results are memoized by plan hash. Editing a node invalidates it and
everything downstream, and nothing else.

### Layer 3: Compile

```
compile(plan: Plan) -> string
```

Each operator becomes one common table expression. The full graph compiles
to a single statement:

```sql
WITH
  n1 AS (SELECT * FROM read_csv('walls.csv')),
  n2 AS (SELECT * FROM n1 WHERE height > 3.0),
  n3 AS (SELECT * FROM pg.levels),
  n4 AS (SELECT n2.*, n3.name AS level_name
         FROM n2 JOIN n3 ON n2.level_id = n3.id)
SELECT * FROM n4
```

Compile is pure text generation, so its tests are string comparisons. The
name `compile` is used generically; there can be several compilers over the
same plan. The first is DuckDB SQL. A second, worth building early because it
is cheap, renders a plan as a one-line English description for node tooltips
and a "what does this node do" panel.

`RawSql` compiles to its own text with its inputs exposed under fixed names.
This is the escape hatch. Everything the typed operators cannot express goes
here, and it keeps the operator set from growing to cover every case.

### Layer 4: Execute

```
execute(sql: string, connection, limit?: int) -> ITable
```

This is the only layer that touches rows. It owns:

- Connections and attaching external databases as DuckDB catalogs.
- Cancellation and timeouts.
- A materialization cache keyed by plan hash and limit.
- Validating the returned columns against the inferred schema, and reporting
  a mismatch as a node error rather than returning surprise columns.

Execute never sees a plan. It sees SQL and a connection. That is what makes
the executor swappable: SQLite, Postgres, or an in-memory engine can sit
behind the same signature if a compiler exists for them.

## What a table is

Nothing above depends on a specific table type. `ITable` is whatever Execute
returns and the inspector displays, and it is chosen by the boundary between
those two.

Two candidates:

- **`IDataTable` from the Ara 3D SDK.** Name, `Columns`, `Rows`, and
  `this[column, row]`. Already used across the toolkit, so results plug into
  existing grids and exporters with no adapter. Column values are boxed
  `object`, which costs on large previews but not on the thousand-row samples
  the inspector shows.
- **Apache Arrow.** DuckDB produces it natively with no copy, columns are
  typed and contiguous, and streaming a large result is built in. It is the
  better choice if full-table sinks flow through this layer at scale.

Recommendation: define the Execute return type as an interface owned by the
Execute layer, provide `IDataTable` as the first implementation, and add an
Arrow-backed implementation later if a profile shows the boxing cost. The
interface needs only column names, column types, row count, and a way to read
a cell. Everything else is an extension method.

## The editor on top

The graph editor uses the layers through a handful of calls:

| Editor action        | Layer call                                   |
|----------------------|----------------------------------------------|
| Add or edit a node   | build a new `Plan`; the old one is unchanged |
| Draw column lists    | `infer(plan, catalog)`                       |
| Mark a red edge      | `infer` returned `SchemaError`               |
| Tooltip              | `describe(plan)`                             |
| Click to inspect     | `execute(compile(plan), conn, limit: 1000)`  |
| Row count badge      | `execute(compile(Aggregate(plan, count)))`   |
| Run a sink           | `execute(compile(plan), conn)`               |

Eager recompute on every edit is a policy of the editor, not of the layers.
It should be a per-graph toggle, on by default under a row-count threshold.

## Modularity checks

Each layer is small enough to hold in one head and to test in isolation:

- Plan: constructors, equality, hash, fold. No dependencies.
- Schema: one inference rule per operator, one catalog interface. Tests use a
  fake catalog.
- Compile: one emitter per operator. Tests compare strings.
- Execute: one function, one cache. Tests need DuckDB and a two-row CSV.

A layer is over-coupled if any of these become false: Plan imports a database
library; Schema needs a connection for anything but source lookup; Compile
returns rows; Execute receives a `Plan`.

## Open questions

- Whether expressions should be a full tree from day one, or a string that
  the Compile layer passes through and the Schema layer types as `unknown`.
  The tree is more work and unblocks typed errors; the string ships sooner.
- Whether sources should be resolved by name through a connection registry so
  a saved graph carries no connection strings.
- Whether the schema layer is allowed to be stale. If a CSV gains a column
  between design and execution, Execute reports the mismatch, but the editor
  needs a way to refresh the catalog.
