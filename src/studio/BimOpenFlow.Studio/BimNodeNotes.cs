namespace BimOpenFlow.Studio;

/// <summary>Hand-written behavioral notes for the BIM packs' node kinds (Bos, Geometry), which
/// docs/nodes.md prints under each node; the generic packs' notes are NodeNotes.Generic.</summary>
public static class BimNodeNotes
{
    public static readonly IReadOnlyDictionary<string, string> All = new Dictionary<string, string>
    {
        ["bos.load"] =
            "Loads the .bos file into an in-memory DuckDB once and outputs three materialized "
            + "text views: `entities`, `parameters`, and `relations`, each deterministically ordered. "
            + "Results are cached per (file content hash, harmonize flag), so re-evaluations of "
            + "unchanged content never reload and edits to the file are picked up automatically. "
            + "With `harmonize` true, the data is passed through the BOS harmonizer (appends SI "
            + "canonical columns) before the views are built. A missing file is an error.",

        ["bos.query"] =
            "The input table is loaded into an in-memory DuckDB as table `t`. The query must be "
            + "read-only. The node predates `sql.query`, which generalizes it to four inputs.",

        ["view3d.instances"] =
            "One row per placed mesh, with entity ids and world bounds. The loaded geometry "
            + "is cached by file content hash.",

        ["view3d.color"] =
            "Numeric value columns map through a gradient normalized over the column's "
            + "min..max range; text values map categorically, with palette indices assigned by "
            + "sorted distinct value so colors are stable under row reordering. A non-numeric "
            + "value column with a gradient colorMap warns and falls back to category10. "
            + "Instance rows with no match in the value table get gray; alpha is always 1. "
            + "With `auto` false, the gradient's domain is the manual `min`..`max` instead of "
            + "the column's own range; values outside it take the end colours and are counted "
            + "in the `legend` output's below/above rows, with one warning naming the count. "
            + "`min >= max` warns and falls back to the automatic domain. An optional `scale` "
            + "input (typically `view.colormap`'s `legend`, so this pane and a chart share one "
            + "domain) replaces the node's own scale entirely — `auto`/`min`/`max`/`colorMap` "
            + "are ignored (with a warning when `auto` is false) and the scale's own value "
            + "column is used, with a warning if `valueColumn` names a different one. Either "
            + "way, `legend` reports the domain actually used — `auto`, `manual`, or "
            + "`categorical` — so a clamped manual domain is visible instead of silent.",

        ["view3d.isolate"] =
            "The ids table is matched on its column with the same name as `joinColumn`, or its "
            + "first column when no such column exists.",

        ["view3d.hide"] =
            "The exact inverse of `view3d.isolate`: rows whose join key appears in the ids "
            + "table are removed; rows with a null join key are kept. Same ids-column lookup "
            + "(same name as `joinColumn`, else the first column).",

        ["view3d.opacity"] =
            "Writes only the `a` column (added with default 1 when absent); existing colors are "
            + "untouched, and the 3D pane honors `a` even without r/g/b — 0 hides, fractions "
            + "fade. The ids input is optional: without it every row gets the alpha; with it, "
            + "scope `matched` fades the matching rows and `others` fades everything else, while "
            + "unassigned rows keep their current alpha.",

        ["view3d.spacing"] =
            "Explode-by-column: groups are the sorted distinct values of `groupColumn` and group "
            + "i moves i x spacing along the axis. Offsets accumulate onto existing offsetX/Y/Z "
            + "columns so spacing nodes chain, and the bounds columns are shifted to match. "
            + "Null-group rows stay in place.",

        ["view3d.arrange"] =
            "Parts-catalog layout: each group gets a cell in a square XY grid sized by the "
            + "largest group footprint plus the gap, moved so its bounds minimum lands at the "
            + "cell origin; Z is unchanged. Offset/bounds column handling matches "
            + "`view3d.spacing`.",

        ["view3d.decimate"] =
            "Instance thinning, not mesh simplification: drops rows with a bounds diagonal "
            + "under `minDiagonal`, then keeps the top `keepFraction` of the remainder by bounds "
            + "volume (ties to the earlier row), preserving row order. An out-of-range fraction "
            + "warns and clamps.",

        ["view3d.boundingBoxes"] =
            "Emits a boxes table (see the Geometry README): one box per row, or with "
            + "`groupColumn`, one union box per sorted distinct group value with null-group rows "
            + "under \"(none)\". Labels fall back globalId, then instanceIndex, then row number; "
            + "r/g/b/a carry through when all four columns exist (group mode: first row's "
            + "color).",

        ["view3d.voxelize"] =
            "AABB rasterization, not triangle-accurate: every voxel overlapped by an instance "
            + "bounding box is emitted with a `count` of overlapping instances and a `voxelId` "
            + "join key for coloring. The grid spans the union bounds; a size that would exceed "
            + "2,000,000 voxels is doubled until it fits, with a warning.",
    };
}
