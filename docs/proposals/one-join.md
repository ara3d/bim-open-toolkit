# One join: the same parameters and results from `table.join` and `rel.join`

> Proposal, 2026-09-28, from the sample-flow review (TKT-93's review, the
> tables reviewer's pattern 1). Not built. The decisions it needs from the
> owner are in TKT-99.

## The problem

A person who wants to put two tables side by side meets three nodes that
each work differently:

| | `sql.query` / `rel.sql` | `table.join` | `rel.join` |
|---|---|---|---|
| Wire kind | Table / Relation | Table | Relation |
| Inputs | `t1`..`t4` / `t1`..`t3` | `a`, `b` | `left`, `right` |
| Keys | inside the SQL text | `aKey`, `bKey` (`bKey` defaults to `aKey`) | `leftKey`, `rightKey` (both required) |
| Kind parameter | written in SQL | `mode`, default `left` | `kind`, default `inner` |
| Kinds offered | any | left, inner, full, semi, anti | inner, left, right, full, semi, anti |
| Key matching | typed (DuckDB) | canonical cell text | typed (DuckDB) |
| Duplicate right keys | every match (fan-out) | first b row wins, with a warning | every match (fan-out) |
| Right key column | as selected | dropped | kept, renamed `<key>_right` |
| Name collisions | as selected | suffix `_b` | suffix `_right` |
| Keys per join | any | one | one (the plan operator already takes a list) |

Learning one teaches nothing about the other two. Worse, the same question
gives different columns in the two packs and, when the right table has
duplicate keys, a different row count.

How the samples use them (32 join nodes, counted 2026-09-28):

- 27 of 32 use the same key name on both sides.
- `rel.join` is set to `inner` 14 times; one node relies on the `inner`
  default.
- `semi` and `anti` appear 9 times: "which doors have no width", "which CSV
  rows match no entity". They carry the honest-absence checks.
- `right` is never used.
- `sql.query` joins in 2 table-profile samples and `federation-match`.

## The design

One specification, two nodes. The wire kind stays fixed per port (project
principle 5), so a Table join and a Relation join remain two kinds. They get
the same parameters, the same results, and one set of test vectors that both
must pass.

Ports: `left`, `right`. Output: `table` or `relation`, as today.

| Parameter | Kind | Default | Meaning |
|---|---|---|---|
| `leftKey` | Text, suggests columns of `left` | none, required | One key column, or a comma list (`Storey, Name`) |
| `rightKey` | Text, suggests columns of `right` | same as `leftKey` | Same number of columns as `leftKey` |
| `kind` | Enum | `left` | `left`, `inner`, `full`, `semi`, `anti` (and `right` for `rel.join` only, kept for saved graphs) |

Results:

- **Every match.** A right key that appears twice gives two output rows, as
  in SQL. The node warns with the count: "right has 3 duplicate keys, so 5
  left rows appear more than once". First-match-wins drops data quietly
  once someone stops reading warnings.
- **Unmatched rows are counted.** Every kind warns "12 left rows and 3
  right rows had no match", so an inner join that loses doors shows it.
- **One key column.** When a key has the same name on both sides the output
  has it once. When the names differ, both columns are kept.
- **One suffix.** A right column whose name collides with a left column
  gets `_right`, in both nodes.
- **`semi` and `anti`** return only left's columns, as today.
- **Default `left`.** Enrichment ("attach the storey name to each door") is
  the common case, and a left join keeps unmatched rows visible instead of
  dropping them. That is principle 3, honest absence.

Key matching: `table.join` keeps comparing canonical cell text, and
`rel.join` keeps comparing typed values. Converting one to the other's
matching is where the two nodes can't agree cheaply: making `table.join`
typed would bring DuckDB into the Tables pack, which is DuckDB-free by
design. The test vectors cover the cases where the two agree: text keys,
and integer keys of the same type on both sides. A vector with `1` on one
side and `"1"` on the other documents the difference: `table.join` matches
them and `rel.join` does not.

### The SQL nodes

`sql.query` and `rel.sql` stay for joins a node can't express: non-equality
conditions, `UNION`, `CROSS JOIN`, window functions. Both get four inputs
(`rel.sql` has three today). The samples use them for a join only where the
sample is about SQL.

### The editor

When both inputs are wired and `leftKey` is empty, the editor fills it with
the first column name the two schemas share (`CustomerId`, `ProductId` in
the table samples; `EntityIndex` in most NRC flows). Joining becomes: drag
two wires and read the result. This belongs with the editor UX wave
(`docs/plans/editor-ux-wave.md`), not with the node change.

## Compatibility

There is no node-version migration in the engine. `table.sort` handled its
old `by` parameter as a hidden legacy parameter, and the same pattern works
here:

- `table.join` accepts `aKey`, `bKey`, `mode` as hidden legacy parameters.
- The port rename from `a`, `b` to `left`, `right` has no such escape.
  Saved graphs name ports in their edges. Either the host rewrites the two
  port names when it loads a graph, or `table.join` keeps `a` and `b`. The
  owner decides (TKT-99).
- `rel.join`'s default changes from `inner` to `left`. The one sample that
  relies on the default gets `kind: inner` written into it, so no sample
  answer changes. A saved graph that relied on the default would change.
- `table.join`'s fan-out changes answers only where the right table has
  duplicate keys. The sample-flow test (`tests/flow/BimOpenFlow.SampleFlows.Tests`)
  shows which goldens move, and each moved number needs a reason before it
  is approved.

Samples under `samples/notebooks/graphs` hold 13 of the 32 joins. The
notebook session must be told before their graphs change
(`docs/sample-flows-test.md`, "Renaming, deleting, or changing a sample flow").

## Chunks

1. **Test vectors.** A JSON file of join cases: left rows, right rows,
   parameters, expected rows, expected warnings. One test runs them against
   both nodes. Today's divergences are marked expected-to-fail, so the file
   records the current state first.
2. **`rel.join`.** Optional `rightKey`, comma-list keys, default `left`, one
   key column when names match, unmatched counts. Write `kind: inner` into
   the one sample that relied on the default.
3. **`table.join`.** Fan-out, comma-list keys, the new parameter names with
   legacy aliases, `_right` suffix, unmatched counts; ports as decided.
4. **Samples.** Regenerate goldens and explain every number that moved.
   Rewrite `category-mix` with join nodes, and keep `customer-revenue` as
   the SQL counterpart. Tell the notebook session.
5. **`rel.sql` gets `t4`.**
6. **Editor.** Pre-fill `leftKey` from the shared column. Hand it to the
   editor UX wave.

Chunks 2 and 3 can run at the same time once chunk 1 is committed.

## Not proposed

- **One node over both wire kinds.** A port has one wire kind, and adding
  "Table or Relation" would be a new wire-typing rule touching the spec, the
  engine and every surface.
- **Retiring `table.join`.** It is the only join in the DuckDB-free Tables
  pack, and five samples and the table-file profile use it.
- **More than two inputs.** Chained joins read as steps; a three-way join is
  two nodes. TKT-77 (variadic ports) is a separate question.
