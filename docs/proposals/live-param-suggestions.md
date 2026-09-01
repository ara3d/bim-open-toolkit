# Proposal: live parameter suggestions

> **AI-assisted design document** (Claude Fable 5 + Christopher Diggins, 2026-09-01).
> Goal: parameters like "column name" or "table name" should offer live pull-downs
> populated from the actual data flowing through the graph. This document records
> the architecture and UX design, grounded in the codebase as of commit b57371f.
>
> **Status: implemented** (2026-09-01) — autosave in `state/src/sync.ts`;
> `SuggestSource` in `Params.cs`; endpoint in `SuggestEndpoints.cs` with the
> DuckDB probe injected from `HostComposition`; datalist comboboxes in
> `app/src/suggestInput.ts` wired into canvas islands and the params pane;
> annotations across the node packs; `docs/nodes.md` renders the sources.
> Section 6's combobox differs in one detail: the shipped control is a native
> datalist on the existing island inputs, not an EnumSlot variant.

## 1. The one-sentence version

Keep parameter values as plain strings, add a declarative "where suggestions come
from" field to `ParamSpec`, serve suggestions from the standing eval session on
the host, and switch the app to debounced autosave so that session is always
close to current. The dropdown becomes a **combobox** — suggestions are an
affordance, never a constraint.

## 2. Why not specialized data types

The stored value stays a canonical string (as `spec/dataflow-graph/format.md` §4
requires). Suggestion source is a separate, orthogonal piece of metadata. Two
reasons:

1. **A hard "ColumnName" type breaks authoring order.** People wire graphs before
   upstream data exists, paste flows from elsewhere, or point a reader at a file
   that isn't there yet. If the value type only admits known columns, all of that
   fails. Today unknown columns produce eval-time warnings (e.g. `context.Warn`
   in `TableRenameNode`) — that is the right model: suggestions guide, validation
   warns, nothing blocks.
2. **Suggestion source is orthogonal to value shape.** `table.rename`'s `renames`
   param is a comma-separated list, not a single column name, but it still wants
   column suggestions. A `ParamKind.ColumnName` could not express that; a
   separate field can.

## 3. Declaring suggestion sources

Extend `ParamSpec` (`src/Ara3D.DataFlowEngine.Abstractions/Params.cs`):

```csharp
record ParamSpec(string Name, ParamKind Kind, string Default = "",
    IReadOnlyList<string>? EnumValues = null,
    SuggestSource? Suggest = null);

// e.g. Suggest = SuggestSource.ColumnsOf("input")     // columns of the table on input port "input"
//      Suggest = SuggestSource.TablesInFile("path")   // tables in the file named by param "path"
```

`Suggest` is a small closed set of declarative descriptors, so it flows through
`contracts.json` → `ApiMapping.ToDescriptor` → `ParamDescriptor` → the frontend
catalog with no per-node code, and `docs/nodes.md` documents it automatically.
`EnumValues` remains the static case; `Suggest` is the dynamic one.

A node-implemented provider interface is a possible later escape hatch, but the
two descriptors above cover nearly every current node (rename, drop, cast,
split, pivot, join keys, date-filter column, `duck.table`'s table name, …).
Start declarative only.

## 4. Where suggestion data comes from

Almost everything already exists:

- **Columns of an upstream table**: after any eval pass, `EvalSnapshot.Results`
  holds live `IDataTable` outputs in memory, and
  `GET /results/{nodeId}/{port}?take=0` already returns columns-only for free.
  No schema-inference system is needed.
- **Tables in a file**: `DuckTablesNode` / `FileReadCache` already do this,
  content-hash memoized, so repeat probes are cheap.

Add one dedicated endpoint rather than having the frontend reverse-engineer
sources from `getResult`:

```
GET /api/analyses/{id}/suggestions/{nodeId}/{param}
→ { status: "ok" | "unready" | "unavailable", values: [{ value, detail? }], reason? }
```

The handler in `EvalEndpoints.cs` looks up the node's `ParamSpec.Suggest` and
resolves it against the standing `EvalSession` snapshot:

- `ColumnsOf`: follow the edge into that port, read the upstream `NodeResult`'s
  table column descriptors. `detail` carries the column type so the dropdown can
  show `Name — Text`.
- `TablesInFile`: probe through `FileReadCache` (no upstream node exists in this
  case, which is why frontend-only `getResult(take=0)` is not enough).

The `status` field drives UX: `unready` means "connect an input to see columns",
`unavailable` means "upstream failed" — both still permit free text.

Why an endpoint instead of frontend-only: it handles the file-probe case, keeps
the source logic next to the declaration it interprets, and gives one place to
extend later.

## 5. Freshness: debounced autosave

The one real architectural gap: `AnalysisSessions` evaluates only the **saved**
document. Dirty in-browser edits are invisible to the host, so suggestions would
reflect the last PUT. Two ways out:

- A speculative "evaluate this candidate document" endpoint (POST the dirty doc,
  get suggestions). This forks the session, misses the standing `MemoCache`, and
  complicates the per-session lock. Avoid it.
- **Debounced autosave**: PUT the document ~400 ms after any structural or param
  change. The host re-evaluates (memoization makes unchanged subgraphs
  near-free — `MemoKey` excludes node id, `FileReadCache` absorbs file reads,
  effect nodes are already gated behind `EffectPending`), pushes `EvalUpdate`
  over the existing SSE stream, and the session is always current.

Autosave is the better answer because it delivers the larger goal — the data
flow evaluated in real time, as much as possible — not just fresher dropdowns.
Results panes, node status badges, and suggestions all go live off the same
mechanism.

The cost: "save" stops being an explicit user action. Since `/history` already
exists, reframe explicit save as "snapshot / name this version" and let the
working document sync continuously. That is a product decision, but the plumbing
(PUT + SSE + single-threaded session lock) needs no redesign.

One guard: whole-graph passes are synchronous under the session lock, so a slow
graph could make PUTs queue. Coalesce pending PUTs per analysis (evaluate only
the latest) so typing bursts do not stack passes.

## 6. The UX

- **Combobox, not a strict select.** Extend `EnumSlot` in
  `bimopenflow/web/packages/app/src/canvasControls.ts` (it already has the
  canvas-drawn dropdown with modal option list) into a variant that also accepts
  typed text, filters as you type, and always allows a value not in the list.
  Same editor in `paramsPane.ts`. It reuses existing slot heights, so the
  `canvasSlots.ts` layout math needs no new cases.
- **Fetch lazily, on open.** Do not prefetch suggestions for every param on
  every graph change — request when the dropdown opens, cache per
  `(nodeId, param)`, invalidate when an SSE `EvalUpdate` reports the upstream
  node changed. With autosave the answer is warm on the host, so open-to-list is
  near-instant.
- **Empty states teach.** "Connect a table to see columns" for unready, the
  upstream error for unavailable — with the text field still usable in both.
  Top-down authoring stays pleasant instead of punished.
- **Warn, don't block, on mismatch.** If suggestions are known and the current
  value is not among them, show the same subtle warning treatment eval warnings
  get. The two will agree, since eval produces the same warning.
- **Multi-value params** like `renames`: give the token at the cursor
  column-completion rather than switching to a chip editor — smaller change,
  and it is the same mechanism the expression/SQL editor autocomplete (already
  P0 in `bimopenflow-ux-proposal.md` §4 item 9) needs, so the suggestion source
  gets reused there.

## 7. Order of work

1. Debounced autosave with PUT coalescing — stands alone, immediately makes the
   whole app feel live.
2. `ParamSpec.Suggest` + contract change + suggestions endpoint, `ColumnsOf`
   only; annotate two or three nodes (`table.rename`, `table.drop`,
   `date.filter`). Regenerate contracts and `docs/nodes.md`; note the field in
   the spec.
3. Combobox slot in canvas + params pane, wired to the endpoint.
4. `TablesInFile` for `duck.table`, then sweep the remaining node packs'
   declarations.
5. Later, only if needed: a schema-inference hook on `IFlowNode` so suggestions
   work without executing upstream. Likely unnecessary given how cheap memoized
   passes are; it is the escape hatch if huge source files make first-eval
   latency a problem.
