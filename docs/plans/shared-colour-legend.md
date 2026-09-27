# One colour domain with a legend across panes

Status: building
Request: TKT-16. `view3d.color` accepts a manual domain and emits a legend table that reports the domain it actually used, so a clamped domain can be seen instead of passing silently. The 3D pane and the chart pane over the same channel share one colour scale and show the same legend. A sample graph demonstrates this over Snowdon. The rules that apply: PROJECT.md principle 5 (a new type is a parameter kind, never a wire type, so the legend is a table on an output port) and principle 6 (the catalog is the documentation, and a bad value warns rather than blocks, so a clamped domain produces a warning and a legend row, never an error). Sources: docs/proposals/core-node-sets.md Set 4 (`view3d.colormap`, `view3d.color` v2), and docs/proposals/bimopenflow-ux-proposal.md section 5 P1 (a shared colormap legend so parallel views can be compared).

Open questions (each has a default; the plan is built on the defaults; the supervisor took every default on 2026-09-26 and widened the ticket's fence as question 5 lists):

1. **Legend table columns.** Default: the "Legend table" contract below. It has columns `column`, `domain`, `role`, `label`, `value`, `r`, `g`, `b`, `count`, with one row per swatch. The stop rows carry the domain actually used. `below`, `above`, and `missing` rows appear only when their count is above 0.
2. **Colour scale: a parameter kind on `view3d.color`, or a node of its own?** Default: a node of its own, named `view.colormap` and placed in the Viz pack instead of Set 4's `view3d.colormap` in Geometry. The reason: the tables profile (the DuckDB studio) has no Geometry pack, and `HostProfileTests.TablePacks_ContainsNoBimKinds` rejects any `view3d.*` kind there. `view3d.color` and `chart.bar` each gain an optional `scale` input (Table). `view3d.color` also keeps its own `auto`/`min`/`max` parameters so that it meets the first acceptance criterion without a scale node. The ramp parameter is named `colorMap` on both nodes, not Set 4's `ramp`, because `view3d.color` already uses `colorMap` and renaming it would break stored graphs.
3. **How does a pane know that two outputs share a channel?** Default: it does not infer anything; the graph says so. One `view.colormap` node's `legend` output is wired into the `scale` input of both consumers. Each consumer passes that table through unchanged on its own `legend` output, so both panes receive identical tables and draw them with one function. The `column` column names the channel, and it is used only for the caption.
4. **How is `docs/nodes.md` regenerated?** From the repository root, run `dotnet run --project src/flow/BimOpenFlow.NodeDocs` with no trailing options. NOTES.md line 263 records that a trailing `--nologo` became the output file name. The descriptive prose lives in `src/flow/BimOpenFlow.NodeDocs/NodeNotes.cs`, which is outside the ticket fence. Default: extend the fence to that one file (C12). No test checks that `docs/nodes.md` is current, so the C12 builder reads `git diff -- docs/nodes.md` and stops if it shows packs other than Geometry and Viz. Those would be another agent's uncommitted pack edits leaking into the generated file.
5. **Fence extensions beyond the ticket's fence.** None of these paths is in a claimed ticket's fence. Decision: all approved; the ticket's fence lists them.
   - `src/flow/BimOpenFlow.Nodes.Support/{ColorMaps.cs, ColorScale.cs, README.md}`. The packs may not reference each other, so the colour code that both Geometry and Viz need goes in Support.
   - `bimopenflow/web/packages/viz/src/barChart.ts` and `bimopenflow/web/packages/viz/test/barChart.test.ts`. `BarChart` has no per-bar colour.
   - `tests/flow/BimOpenFlow.Nodes.Geometry.Tests/**`, `tests/flow/BimOpenFlow.Nodes.Viz.Tests/**`, `tests/flow/BimOpenFlow.View3dWorkflows.Tests/**`.
   - `tests/flow/BimOpenFlow.TableWorkflows.Tests/HostProfileTests.cs`, which asserts the exact list of tables-profile kinds.
   - `tests/flow/BimOpenFlow.PocParity.Tests/PocCoverageTests.cs`, whose `viz.colormap` entry should point at `view.colormap`.
   - `samples/view3d-analyses/{shared-color-legend.json, README.md}`.
   - `src/flow/BimOpenFlow.NodeDocs/NodeNotes.cs`.

   If the viz extension is refused, C8 and the bar colouring in C9 drop out: the chart pane still shows the shared legend, but its bars keep the accent colour.
6. **Overlap with TKT-15.** TKT-15 is claimed and its fence includes `bimopenflow/web/packages/panes/**`. Its acceptance criteria change the 3D pane's status line, which is in `viewPane3D.ts`. Default: the supervisor narrows both fences to named files. TKT-16 writes `scaleLegend.ts` (new), `pane.ts`, `index.ts`, `styles.ts`, `chartPane.ts`, and `viewPane3D.ts`. C10, the only chunk that edits `viewPane3D.ts`, starts after TKT-15's `viewPane3D.ts` commit lands.
7. **Studio wiring is outside the fence.** The panes can show a legend only if the app fetches a node's `legend` port. The rule is one line in `bimopenflow/web/packages/app/src/paneArea.ts`: *when the shown node has a Table output named `legend` and the active pane is view3d or chart, request that port after the main table and push `{ kind: "legend", data }`.* Nothing in `bimopenflow/web/packages/contracts` changes: `PaneInput` lives in `panes/src/pane.ts` and `TableSlice` already exists. `paneArea.ts` has uncommitted edits from TKT-22 and TKT-24. Default: C13 is queued until those land, or it is folded into TKT-28, which depends on TKT-16 and owns `app/**`. Until then the second acceptance criterion is shown by node and pane tests, not in the studio.
8. **Where does the Snowdon demonstration go?** `view3d.instances` meshes IFC files only. The documented private Snowdon file is a BOS file, and the Snowdon 3D view today goes through view recipes (`view3d.scene`), not instance tables. A Snowdon value colouring therefore needs one of TKT-30's IFC files and a seeding placeholder for it. The seeding code is in the Host, which is in TKT-26's fence. Default:
   - C11 commits the Duplex variant under `samples/view3d-analyses/`, and the tests run it.
   - Spike S1 runs on the owner's machine with a 30-minute limit. Question: does `view3d.instances` over the Snowdon architectural IFC evaluate in under 2 minutes, and does the 3D pane map that instance table onto the model the host serves?
   - If S1 passes, C14 adds `samples/snowdon-analyses/snowdon-shared-legend.json` after TKT-30 releases that folder, or TKT-13 takes it.
   - If S1 fails, the Snowdon half becomes the "scale-driven recipe step" extension point.

## Brainstorm
skipped

## Acceptance criteria
- `view3d.color` with `auto=false, min=0, max=1` over `meshVolume = [0.2, 0.5, 1.4, 3.0, null]` gives:
  - the rows with 1.4 and 3.0 the top-stop colour;
  - a `legend` table whose stop rows run from 0 to 1, with an `above` row whose count is 2 and a `missing` row whose count is 1;
  - exactly one warning that names the 2 values above the domain;
  - status Ok.
- With default parameters (`auto=true`), `view3d.color` gives exactly today's colours. The existing `ColorNodeTests` pass unchanged.
- `min >= max` with `auto=false` warns, falls back to the data range, and the legend reports `domain = auto`.
- `view.colormap` over the same values emits the same legend table. Given that table on their `scale` inputs, `view3d.color` and `chart.bar` emit it cell-for-cell unchanged on their `legend` outputs. `chart.bar` appends `r g b` per row computed from the scale, and warns when bars fall outside the domain.
- If `view.colormap` names a column that does not exist, it warns and emits an empty legend table. The node stays Ok and never fails the graph.
- Given the same legend slice:
  - the 3D pane and the chart pane render byte-identical legend DOM (the markup of the legend element);
  - the chart pane fills each bar with its row's `r g b`;
  - a legend input takes precedence over the 3D pane's table-derived category legend, and a recipe legend still takes precedence over both.
- `samples/view3d-analyses/shared-color-legend.json` evaluates all green over `data/duplex.ifc`. Its three legend outputs (colormap, 3D colouring, chart) are equal, and its `above` count is above 0 and below the number of numeric values.
- `docs/nodes.md` is regenerated and lists `view.colormap`, the new `scale` and `legend` ports, and the new `view3d.color` parameters.
- Excluded: studio wiring (C13, blocked), the Snowdon graph (C14, blocked on TKT-30 and S1), line-chart colouring, swatches in the table pane, promoting parameters to graph parameters, value colouring through view recipes, and clicking legend chips.

Evidence:
- `dotnet test tests/flow/BimOpenFlow.View3dWorkflows.Tests` passes `SharedColorLegend_OneScaleAcrossConsumers`.
- `npm test -w @bimopenflow/panes` passes the cross-pane identical-legend tests.
- After C13, two screenshots from the bim-profile studio, of node `colored` (3D tab) and node `chart` (Chart tab), show the same strip: caption "meshVolume · manual domain 0 – 1", the ramp, and a "> 1 (N)" chip.

Kill criteria: none for the node and pane work. For the Snowdon half, S1's failure moves it to an extension point (question 8).

## Design

The system that makes this easy has one colour-scale value in C#, one table convention on the wire, and one renderer in the panes.

**Support library (`BimOpenFlow.Nodes.Support`).** `Rgb` and `ColorMaps` move here unchanged from Geometry. A new `ColorScale` does four things:
- builds a scale from one column of a values table (auto or manual domain; gradient or categorical);
- counts clamped values and warns about them once;
- colours a cell;
- converts to and from the legend table.

Both packs already reference Support. The layering test forbids references from one pack to another, so Support is the only place both Geometry and Viz can share this code.

**Nodes.**
- `view3d.color`, still version 1, gains parameters `auto`/`min`/`max` (the defaults keep v1's behaviour), an optional `scale` input, and a `legend` output. Without a scale it builds its own scale through `ColorScale.Build`. With a scale it colours through that scale and passes the table through untouched. Its private `GradientColors` and `CategoricalColors` are replaced.
- `view.colormap` (new, Viz pack) is `ColorScale.Build` exposed as a node: values in, legend out.
- `chart.bar` gains an optional `scale` input and a `legend` output. With a scale it appends `r g b`, computed from the scale's `column` (or the first value column, with a warning if that column is absent), and passes the scale through. Without a scale it emits an empty legend table.

**Panes.**
- `scaleLegend.ts` parses a legend table into a `ScaleLegend` and turns it into a `LegendView`. `renderLegendView` draws any `LegendView`: a scale legend, a recipe legend, or the existing table-derived category legend.
- The 3D pane replaces its inline chip loop with `renderLegendView`. The chart pane gains a legend strip and per-bar fills.
- `PaneInput` gains `{ kind: "legend"; data: TableSlice }`.

**Colour computation happens once, in C#.** Panes draw `r g b` columns and never interpolate.

Reused: `ColorMaps` ramps, `TableColumns.CellNumber` and `CellText`, `MemoryTable`, the `LEGEND_MAX_ENTRIES` cap, the `.bof-panes-legend` styles, and the engine's optional ports (`PortSpec.Optional`, `MissingValue`).

Libraries changed: `BimOpenFlow.Nodes.Support` (gains the colour scale) and `@bimopenflow/viz` (`BarChart` gains `barColors`). No new library.

Retires:
- `src/flow/BimOpenFlow.Nodes.Geometry/ColorMaps.cs` (moved);
- `ColorNode.GradientColors` and `ColorNode.CategoricalColors`;
- the chip-building loop inside `viewPane3D.ts`'s `updateLegend`;
- the `viz.colormap → view3d.color` mapping in `PocCoverageTests`.

`ColorNode.Unmatched` stays as an alias of `ColorScale.NoValue`, because the NrcWorkflows tests read it.

Known behaviour shift: categories now key on Support's `CellText` instead of Geometry's `CanonicalText`. For float columns (not double) under `category10`, labels and palette order can change. No committed sample colours a float column categorically.

## Considered and rejected
- **A `ColorScale` parameter kind on `view3d.color` and `chart.bar`.**
  - Reason: a parameter belongs to one node, so two consumers would each hold a copy and drift apart. A new `ParamKind` touches the engine submodule's enum, the contracts package, and the app's slot registry, and the app is busy with TKT-22, TKT-23, and TKT-24.
  - Would change if: graph parameters (UX pillar 10) ship, and people want a shared domain without adding a node.
- **Set 4's sharing through parameters only (min and max promoted to graph parameters; the colormap node consumed by nothing).**
  - Reason: the studio has no graph parameters yet, auto domains differ between consumers, and `chart.bar` would need its own copy of the ramp and domain parameters.
  - Would change if: graph parameters land.
- **`chart.bar` reading `view3d.color`'s legend directly, with no scale node.**
  - Reason: a chart could be coloured only after an IFC is meshed, and chart-only graphs in the tables profile (no Geometry pack) could never get a scale.
  - Would change if: the tables profile gains the Geometry pack.
- **Naming it `view3d.colormap` in the Geometry pack (Set 4).**
  - Reason: the tables profile would lack it, and `TablePacks_ContainsNoBimKinds` rejects `view3d.*` kinds in that profile.
  - Would change if: the profiles merge (TKT-28).
- **Bumping `view3d.color` to version 2.**
  - Reason: `NodeRegistry.Find` matches `(kind, version)` exactly. Every committed graph that uses it (14 sample files) and every stored analysis would stop validating unless a migration were written. The changes are additive, with defaults that keep v1's behaviour.
  - Would change if: a default-parameter evaluation's output ever differs from v1's.
- **The chart pane interpolating colours in TypeScript from the legend table.**
  - Reason: it would be a second copy of the gradient and category rules across a language boundary.
  - Would change if: charts need restyling on the client without a host round trip.
- **The chart pane recolouring `rect.bof-viz-bar` after mount.**
  - Reason: `BarChart` skips rows with non-finite values, so rect indices drift away from row indices.
  - Would change if: `BarChart` starts tagging rects with their row index.
- **Panes guessing a shared channel by matching column names.**
  - Reason: two unrelated `area` columns would merge. A shared scale node makes the sharing explicit.

## Signatures and contracts

**Legend table** (table name `legend`; one row per swatch).

| Column | Type | Meaning |
|---|---|---|
| `column` | Text | The channel: the value column the scale colours. The same on every row. |
| `domain` | Text | `auto`, `manual`, or `categorical`. The same on every row. |
| `role` | Text | `stop`, `category`, `below`, `above`, or `missing` |
| `label` | Text | Stop: value formatted with `G4` and the invariant culture. Below: `< {min}`. Above: `> {max}`. Missing: `no value`. Category: the value's text. |
| `value` | Number, nullable | Stop: its domain value. Below and above: the bound they clamp to. Otherwise null. |
| `r` `g` `b` | Number, 0..1 | Swatch colour. Missing is 0.5 gray. |
| `count` | Integer, nullable | Rows of the values table in that category, clamped below, clamped above, or with no value. Null on stop rows. |

Row order:
- Gradient: stops, lowest first, one per control point of the ramp (viridis has 5, redgreen 3), evenly spaced over the domain. Then `below`, `above`, `missing`.
- A degenerate domain (min equals max) has one stop, coloured `Gradient(0.5)`.
- Categorical: categories in ordinal sorted order (which is palette order), then `missing`.

Clamp warning, exactly: `{kind}: {n} of {total} values in '{column}' lie outside the manual domain {min}..{max} and take its end colours ({below} below, {above} above)`.

Worked example: viridis, `auto=false, min=0, max=1`, values `[0.2, 0.5, 1.4, 3.0, null]` give these rows:
- stops 0, 0.25, 0.5, 0.75, 1, carrying ViridisStops[0..4];
- `above` "> 1", value 1, colour ViridisStops[4], count 2;
- `missing` "no value", colour 0.5 gray, count 1.

Categorical example: `category10` over `[Wall, Door, Wall, null]` gives `Door` #1f77b4 with count 1, `Wall` #ff7f0e with count 2, and `missing` with count 1; `domain = categorical`.

```csharp
// src/flow/BimOpenFlow.Nodes.Support/ColorMaps.cs  (moved verbatim from Geometry; namespace BimOpenFlow.Nodes.Support)
public readonly record struct Rgb(double R, double G, double B);
public static class ColorMaps { /* ViridisStops, RedGreenStops, Category10, FromHex, Gradient, Viridis, RedGreen, Categorical: unchanged */ }

// src/flow/BimOpenFlow.Nodes.Support/ColorScale.cs
namespace BimOpenFlow.Nodes.Support;

/// <summary>The colour scale behind a legend table: the column it colours, how its domain was chosen, and its rows.</summary>
public sealed record ColorScale(string Column, string Domain, IReadOnlyList<ColorScale.Row> Rows)
{
    public sealed record Row(string Role, string Label, double? Value, Rgb Color, long? Count);

    public const string TableName = "legend";
    public static readonly Rgb NoValue = new(0.5, 0.5, 0.5);
    public static readonly string[] ColorMapNames = ["viridis", "category10", "redgreen"];

    /// <summary>Builds the scale for one column of a values table. A gradient colorMap over a
    /// non-numeric column falls back to category10 with a warning; a manual domain with
    /// min >= max falls back to auto with a warning; values outside a manual domain are
    /// counted in below/above rows and reported in one warning.</summary>
    public static ColorScale Build(IDataTable values, int column, string colorMap,
        bool auto, double min, double max, IEvalContext context, string kind)
        => throw new NotImplementedException();

    /// <summary>Gradient: piecewise-linear between stop rows, clamped to the end stops
    /// (equal to ColorMaps.Gradient over the domain). Categorical: the category row whose
    /// label equals CellText(cell). Anything else: NoValue.</summary>
    public Rgb ColorOf(object? cell) => throw new NotImplementedException();

    /// <summary>Numeric cells below the first stop and above the last; (0, 0) for categorical scales.</summary>
    public (long Below, long Above) Clamped(IEnumerable<object?> cells) => throw new NotImplementedException();

    public IDataTable ToTable() => throw new NotImplementedException();

    /// <summary>Reads a legend table; null plus a warning when a required column is missing.</summary>
    public static ColorScale? FromTable(IDataTable table, IEvalContext context, string kind)
        => throw new NotImplementedException();

    /// <summary>The legend schema with zero rows: what a consumer emits with no scale.</summary>
    public static IDataTable EmptyTable() => throw new NotImplementedException();
}
```

Node specs. All are version 1 and Pure; new ports and parameters are appended after the existing ones.
- `view3d.color`:
  - inputs `instances`, `values`, `scale` (Table, Optional);
  - outputs `instances`, `legend`;
  - parameters `joinColumn`, `valueColumn`, `colorMap`, then new ones: `auto` (Boolean, `"true"`), `min` (Number, `"0"`), `max` (Number, `"1"`).
  - With `scale` connected: an empty `valueColumn` means the scale's `column`. It warns if `valueColumn` differs from the scale's `column`, and warns that min and max are ignored if `auto=false`.
- `view.colormap` (`ColorMapNode.cs`, `Kind = "view.colormap"`):
  - input `values`; output `legend`;
  - parameters `valueColumn` (Text, `Suggest: ColumnsOf("values")`), `colorMap` (Enum, default `viridis`, values `ColorScale.ColorMapNames`), `auto` (Boolean, `"true"`), `min` (Number, `"0"`), `max` (Number, `"1"`).
  - An unknown column warns and emits `EmptyTable()`.
- `chart.bar`:
  - inputs `table`, `scale` (Table, Optional); outputs `table`, `legend`.
  - With a scale: appends `r g b` (Number) after projection. If the projection already has `r`, `g`, or `b` columns, they are dropped with a warning first.

```ts
// bimopenflow/web/packages/panes/src/pane.ts: one new PaneInput member
  /** A legend table (view.colormap, view3d.color, chart.bar `legend` port); 3D and chart panes render it. */
  | { kind: "legend"; data: TableSlice }

// bimopenflow/web/packages/panes/src/scaleLegend.ts
import type { TableSlice } from "@bimopenflow/contracts";
import type { LegendEntry } from "./toolkitRecipe";
export type Rgb3 = readonly [number, number, number];
export type ScaleRole = "stop" | "category" | "below" | "above" | "missing";
export type ScaleDomain = "auto" | "manual" | "categorical";
export interface ScaleRow { readonly role: ScaleRole; readonly label: string; readonly value: number | null; readonly color: Rgb3; readonly count: number | null }
export interface ScaleLegend { readonly column: string; readonly domain: ScaleDomain; readonly rows: readonly ScaleRow[] }
/** What a legend strip shows, whatever produced it. */
export interface LegendView {
  readonly caption?: string;                                   // "meshVolume · manual domain 0 – 1"; "category"
  readonly gradient: readonly { readonly label: string; readonly color: Rgb3 }[]; // empty when categorical
  readonly chips: readonly { readonly text: string; readonly color: Rgb3 }[];     // "> 1 (2)", "Wall (2)", "Door (12 objects)"
  readonly omitted: number;
}
/** Null when the slice has no rows or lacks a legend column. */
export const parseScaleLegend = (slice: TableSlice): ScaleLegend | null => { throw new Error("stub"); };
export const scaleLegendView = (legend: ScaleLegend, max?: number): LegendView => { throw new Error("stub"); };
/** Keeps today's chip text: `${name} (${count} objects)`. */
export const entriesLegendView = (entries: readonly LegendEntry[], omitted: number): LegendView => { throw new Error("stub"); };
/** Replaces el's children; hides el when the view is empty. The same view gives the same DOM. */
export const renderLegendView = (el: HTMLElement, view: LegendView): void => { throw new Error("stub"); };

// bimopenflow/web/packages/viz/src/barChart.ts: BarChartOptions gains
  /** CSS fill per row for single-series charts; null or missing entries keep the default. Ignored with several series. */
  barColors?: readonly (string | null)[];

// bimopenflow/web/packages/panes/src/chartPane.ts (module-internal, exported for tests)
/** Splits r/g/b columns off a chart table: the rest for the chart, one "rgb(…)" per row; colors null when absent. */
export const splitRowColors = (data: TableSlice): { data: TableSlice; colors: (string | null)[] | null } => { throw new Error("stub"); };
```

Pane example: the numeric legend slice above renders the caption "meshVolume · manual domain 0 – 1", a 5-stop ramp labelled "0" and "1", and the chips "> 1 (2)" and "no value (1)".

App contract (C13, outside the fence): see question 7.

## Extension points
- Graph parameters for `min`/`max` (UX pillar 10), so that two scale nodes can share one domain.
- Colouring `chart.line` points and adding swatches to `view.table` through a `scale` input.
- A recipe step that colours a model loaded from BOS by a scale. This is the fast path for Snowdon if S1 fails.
- Clicking a legend chip to select the matching rows (cross-probing, UX pillar 3).
- More ramps (diverging), and more than 10 categories (category10 currently cycles).
- A count of unmatched instances specific to the 3D view. The legend counts values-table rows only.
- docs/proposals/core-node-sets.md Set 4 still says `view3d.colormap` in Geometry and "not consumed in V1". The archivist should correct it.

## Chunks
| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | Move Rgb and ColorMaps from Nodes.Geometry into Nodes.Support unchanged | `src/flow/BimOpenFlow.Nodes.Support/ColorMaps.cs` (new), `src/flow/BimOpenFlow.Nodes.Support/README.md`, `src/flow/BimOpenFlow.Nodes.Geometry/ColorMaps.cs` (delete), `tests/flow/BimOpenFlow.Nodes.Geometry.Tests/BimOpenFlow.Nodes.Geometry.Tests.csproj` (add `<Using Include="BimOpenFlow.Nodes.Support" />`) | - | `dotnet test tests/flow/BimOpenFlow.Nodes.Geometry.Tests` (108 pass) and `dotnet test tests/BimOpenToolkit.Layering.Tests` (8 pass) and `dotnet build tests/flow/BimOpenFlow.NrcWorkflows.Tests` | none |
| C2 | Add ColorScale to Nodes.Support: auto or manual domain, clamp counts and warning, cell colours, and the legend table | `src/flow/BimOpenFlow.Nodes.Support/ColorScale.cs`, `src/flow/BimOpenFlow.Nodes.Support/README.md`, `tests/flow/BimOpenFlow.Nodes.Viz.Tests/ColorScaleTests.cs` | C1 | `dotnet test tests/flow/BimOpenFlow.Nodes.Viz.Tests` (includes the worked examples, ColorOf matching ColorMaps.Gradient within 1e-12, and the ToTable/FromTable round trip) | none |
| C3 | view3d.color takes a manual domain and an optional scale input and emits the legend table | `src/flow/BimOpenFlow.Nodes.Geometry/ColorNode.cs`, `src/flow/BimOpenFlow.Nodes.Geometry/README.md`, `tests/flow/BimOpenFlow.Nodes.Geometry.Tests/ColorNodeTests.cs` (new tests only; existing ones unchanged) | C2 | `dotnet test tests/flow/BimOpenFlow.Nodes.Geometry.Tests` | none |
| C4 | HostProfileTests lists the eight spatial kinds the tables profile already serves | `tests/flow/BimOpenFlow.TableWorkflows.Tests/HostProfileTests.cs` | - | `dotnet test tests/flow/BimOpenFlow.TableWorkflows.Tests --filter FullyQualifiedName~HostProfileTests` (7 pass; red at baseline) | none |
| C5 | Add view.colormap to the Viz pack as the one scale every consumer shares | `src/flow/BimOpenFlow.Nodes.Viz/ColorMapNode.cs`, `src/flow/BimOpenFlow.Nodes.Viz/VizNodes.cs`, `src/flow/BimOpenFlow.Nodes.Viz/README.md`, `tests/flow/BimOpenFlow.Nodes.Viz.Tests/ColorMapNodeTests.cs`, `tests/flow/BimOpenFlow.TableWorkflows.Tests/HostProfileTests.cs`, `tests/flow/BimOpenFlow.PocParity.Tests/PocCoverageTests.cs` | C2, C4 | `dotnet test tests/flow/BimOpenFlow.Nodes.Viz.Tests`, the HostProfileTests filter above, and `dotnet test tests/flow/BimOpenFlow.PocParity.Tests` | none |
| C6 | chart.bar colours its bars through an optional scale input and passes the legend through | `src/flow/BimOpenFlow.Nodes.Viz/ChartBarNode.cs`, `src/flow/BimOpenFlow.Nodes.Viz/README.md`, `tests/flow/BimOpenFlow.Nodes.Viz.Tests/ChartBarNodeTests.cs` | C5 | `dotnet test tests/flow/BimOpenFlow.Nodes.Viz.Tests` | none |
| C7 | Panes parse a legend table and draw every legend through one strip renderer | `bimopenflow/web/packages/panes/src/scaleLegend.ts`, `.../panes/src/pane.ts`, `.../panes/src/index.ts`, `.../panes/src/styles.ts`, `.../panes/test/scaleLegend.test.ts` | - | `npm test -w @bimopenflow/panes` (from `bimopenflow/web`) | none |
| C8 | BarChart accepts one CSS fill per row | `bimopenflow/web/packages/viz/src/barChart.ts`, `bimopenflow/web/packages/viz/test/barChart.test.ts` | - | `npm test -w @bimopenflow/viz` | none |
| C9 | The chart pane fills bars from r/g/b columns and shows the legend input | `bimopenflow/web/packages/panes/src/chartPane.ts`, `bimopenflow/web/packages/panes/test/chartPane.test.ts` | C7, C8 | `npm test -w @bimopenflow/panes` (the legend DOM equals `renderLegendView` output for the same slice) | none |
| C10 | The 3D pane draws every legend through the shared strip, with a legend input ahead of the table-derived one | `bimopenflow/web/packages/panes/src/viewPane3D.ts`, `bimopenflow/web/packages/panes/test/viewPane3D.test.ts` | C7 (supervisor's decision: C10 goes first, and TKT-15's one-line status change, P1, follows it) | `npm test -w @bimopenflow/panes` (the legend DOM equals `renderLegendView` output for the same slice; existing legend tests unchanged) | none |
| C11 | Sample graph shared-color-legend: one view.colormap with a clamping manual domain feeding view3d.color and chart.bar over Duplex | `samples/view3d-analyses/shared-color-legend.json`, `samples/view3d-analyses/README.md`, `tests/flow/BimOpenFlow.View3dWorkflows.Tests/View3dSampleTests.cs` (add `VizNodes.All` to the registry and `SharedColorLegend_OneScaleAcrossConsumers`), `tests/flow/BimOpenFlow.View3dWorkflows.Tests/BimOpenFlow.View3dWorkflows.Tests.csproj` (reference Nodes.Viz) | C3, C5, C6 | `dotnet test tests/flow/BimOpenFlow.View3dWorkflows.Tests` | `data/duplex.ifc` |
| C12 | Node notes for view3d.color, view.colormap, and chart.bar, and regenerated docs/nodes.md | `src/flow/BimOpenFlow.NodeDocs/NodeNotes.cs`, `docs/nodes.md` | C3, C5, C6 | `dotnet run --project src/flow/BimOpenFlow.NodeDocs`, then `git diff --stat -- docs/nodes.md` (Geometry and Viz sections only; the Viz count goes from 3 to 4) | none |
| C13 | The pane area fetches a shown node's legend port and pushes it to the 3D and chart panes (blocked: app fence) | `bimopenflow/web/packages/app/src/paneArea.ts`, `bimopenflow/web/packages/app/test/paneArea.test.ts` | C7, C9, C10; TKT-22 and TKT-24 released | `npm test -w @bimopenflow/app` | none |
| C14 | Snowdon variant of the shared-legend graph (blocked: TKT-30 fence and spike S1) | `samples/snowdon-analyses/snowdon-shared-legend.json`, `samples/snowdon-analyses/README.md` | C11, S1, TKT-30 | owner's machine: seed with the private files and check that every node is green and the legends are equal | private Snowdon IFC |

C11 graph shape:
- `inst` is `view3d.instances` and `measures` is `view3d.measures`, both over `{DATA}/duplex.ifc`.
- `scale` is `view.colormap` over `measures`, with `valueColumn = meshVolume`, `auto = false`, `min = 0`, and a `max` the builder picks from the data so that at least one value clamps above but not all.
- `colored` is `view3d.color`, with `instances` from `inst`, `values` from `measures`, `scale` from `scale.legend`, and `joinColumn = instanceIndex`.
- `largest` is `table.sort` on `meshVolume` descending, followed by `top` (`table.limit` 20).
- `chart` is `chart.bar`, with `labelColumn = category`, `valueColumns = meshVolume`, and `scale` from `scale.legend`.

Parallel waves:
1. C1, C4, C7, C8.
2. C2, C9 (C9 needs C7 and C8), C10 (once TKT-15 allows).
3. C3 and C5.
4. C6.
5. C11 and C12.

C13 and C14 wait on other tickets.

Baseline gates (2026-09-26, HEAD e71e596; `app/**` has uncommitted edits from other agents):
- `npm test -w @bimopenflow/panes`: 14 files, 130 tests pass.
- `npm test -w @bimopenflow/viz`: 4 files, 43 pass.
- `dotnet test tests/flow/BimOpenFlow.Nodes.Geometry.Tests`: 108 pass.
- `dotnet test tests/flow/BimOpenFlow.Nodes.Viz.Tests`: 22 pass.
- `dotnet test tests/flow/BimOpenFlow.View3dWorkflows.Tests`: 22 pass.
- `dotnet test tests/BimOpenToolkit.Layering.Tests`: 8 pass.
- `dotnet test tests/flow/BimOpenFlow.PocParity.Tests`: 10 pass.
- HostProfileTests: 6 pass and 1 fails. `TablePacks_ContainsExactlyTheTableKinds` fails because eight `spatial.*` kinds appear that the test does not list. The failure predates this work; C4 fixes it.

## Build log
| Id | Commit | Result |
|---|---|---|
| C1 | abaec0b | Geometry 108, Layering 8 pass; NrcWorkflows builds; fence respected. |
| C7 | 8b6c096 | panes 139 tests pass, tsc clean; fence respected (5 files). Gradient labels only at the first and last stop; categorical caption is the literal 'category'. |
| C4 | 53c5c29 | HostProfileTests 7 pass; the eight spatial.* kinds listed. |
| C9 | 667cf77 | panes tests pass (chartPane 21 cases); fence respected (2 files). |
| C10 | e053355 | panes 146 tests pass, tsc clean; fence respected (2 files). Precedence recipe > legend input > table-derived; the reference-equality short-circuit was dropped. |
| C2 | c218f5e | Viz tests 34 pass, Layering 8 pass; fence respected (3 files). ColorOf interpolates between the stop rows, reproducing ColorMaps.Gradient exactly. |
| C3 | 8cf63b0 | Geometry 111 pass; fence respected (3 files). A malformed scale input falls back to the node's own scale with a warning (principle 6), untested. Note for builders: the acceptance bullet's clamped rows are the third and fourth values. |
| C5 | 2aae1fe | Viz 38 pass, HostProfileTests 7 pass; PocParity 9 of 10: the parity registry never included the Viz pack, so the retargeted viz.colormap entry fails until ParityCatalog.cs and its csproj add VizNodes (two lines, verified by the builder, assigned to C6). |
| C6 | 8f24b97 (and 87324a3 for the parity registry) | Viz 43 pass, PocParity 10 pass; fence respected. |
| C8 | f778b4a | viz 46 tests pass, tsc clean; fence respected (2 files). |

## Review findings

## Debt and extension points

## Report
