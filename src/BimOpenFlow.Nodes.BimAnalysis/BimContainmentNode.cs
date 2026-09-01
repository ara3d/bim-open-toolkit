using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Spatial join: assigns each point row (an element center) to the smallest
/// containing box row (a room), by axis-aligned containment.</summary>
public sealed class BimContainmentNode : IFlowNode
{
    public const string Kind = "bim.containment";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs:
        [
            new PortSpec("points", PortType.Table),
            new PortSpec("boxes", PortType.Table),
        ],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("x", ParamKind.Text, BimColumns.CenterX, Suggest: SuggestSource.ColumnsOf("points")),
            new ParamSpec("y", ParamKind.Text, BimColumns.CenterY, Suggest: SuggestSource.ColumnsOf("points")),
            new ParamSpec("z", ParamKind.Text, BimColumns.CenterZ, Suggest: SuggestSource.ColumnsOf("points")),
            new ParamSpec("key", ParamKind.Text, BimColumns.Name, Suggest: SuggestSource.ColumnsOf("boxes")),
            new ParamSpec("as", ParamKind.Text, "ContainedIn"),
            new ParamSpec("ignoreZ", ParamKind.Boolean, "false"),
        ],
        "Adds a column ('as') to the points table holding the 'key' of the smallest box row "
        + "whose MinX..MaxZ box contains the point (x, y, z); rows in no box get null. With "
        + "ignoreZ, containment is tested in plan (XY) only. Typical use: element centers from "
        + "bim.bounds against room boxes from bim.rooms, when the model has no room parameters.");

    private sealed record Box(string? Key,
        double MinX, double MinY, double MinZ, double MaxX, double MaxY, double MaxZ, double Measure);

    // TODO: Numeric/CopyColumns are duplicated in BimNearestNode (and near-copies exist in
    // Geometry.TableOps.CellNumber and Viz.VizProjection); promote to BimOpenFlow.Nodes.Support.
    private static double? Numeric(object? cell)
        => cell switch
        {
            null or DBNull => null,
            double d => d,
            float f => f,
            long l => l,
            int i => i,
            short s => s,
            byte b => b,
            decimal m => (double)m,
            _ => null,
        };

    private static DataTableBuilder CopyColumns(IDataTable table)
    {
        var rows = table.RowCount();
        var builder = new DataTableBuilder(table.Name);
        foreach (var c in table.Columns)
        {
            var cells = new object?[rows];
            for (var row = 0; row < rows; row++)
                cells[row] = table[c.ColumnIndex, row];
            builder.AddColumn(cells, c.Descriptor.Name, c.Descriptor.Type);
        }
        return builder;
    }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var points = inputs.TableInput(0, Kind);
        var boxes = inputs.TableInput(1, Kind);
        var ignoreZ = parameters.GetBoolean("ignoreZ");
        var xi = points.RequireColumn(parameters.TextOr("x", BimColumns.CenterX), Kind);
        var yi = points.RequireColumn(parameters.TextOr("y", BimColumns.CenterY), Kind);
        var zi = ignoreZ ? -1 : points.RequireColumn(parameters.TextOr("z", BimColumns.CenterZ), Kind);
        var keyIndex = boxes.RequireColumn(parameters.TextOr("key", BimColumns.Name), Kind);
        var asName = parameters.TextOr("as", "ContainedIn");
        if (points.ColumnIndex(asName) >= 0)
            throw new ArgumentException($"{Kind}: points table already has a column named '{asName}'.");

        var minXi = boxes.RequireColumn(BimColumns.MinX, Kind);
        var minYi = boxes.RequireColumn(BimColumns.MinY, Kind);
        var minZi = ignoreZ ? -1 : boxes.RequireColumn(BimColumns.MinZ, Kind);
        var maxXi = boxes.RequireColumn(BimColumns.MaxX, Kind);
        var maxYi = boxes.RequireColumn(BimColumns.MaxY, Kind);
        var maxZi = ignoreZ ? -1 : boxes.RequireColumn(BimColumns.MaxZ, Kind);

        var candidates = Enumerable.Range(0, boxes.RowCount())
            .Select(row => (
                Key: TableColumns.CellText(boxes[keyIndex, row]),
                MinX: Numeric(boxes[minXi, row]), MinY: Numeric(boxes[minYi, row]),
                MinZ: ignoreZ ? null : Numeric(boxes[minZi, row]), MaxX: Numeric(boxes[maxXi, row]),
                MaxY: Numeric(boxes[maxYi, row]), MaxZ: ignoreZ ? null : Numeric(boxes[maxZi, row])))
            .Where(r => r.MinX != null && r.MinY != null && r.MaxX != null && r.MaxY != null
                && (ignoreZ || (r.MinZ != null && r.MaxZ != null)))
            .Select(r => new Box(r.Key, r.MinX!.Value, r.MinY!.Value, r.MinZ ?? 0,
                r.MaxX!.Value, r.MaxY!.Value, r.MaxZ ?? 0,
                (r.MaxX.Value - r.MinX.Value) * (r.MaxY.Value - r.MinY.Value)
                * (ignoreZ ? 1 : (r.MaxZ ?? 0) - (r.MinZ ?? 0))))
            .ToList();

        string? Containing(int row)
        {
            var x = Numeric(points[xi, row]);
            var y = Numeric(points[yi, row]);
            var z = ignoreZ ? 0 : Numeric(points[zi, row]);
            return x == null || y == null || z == null
                ? null
                : candidates
                    .Where(b => b.MinX <= x && x <= b.MaxX && b.MinY <= y && y <= b.MaxY
                        && (ignoreZ || (b.MinZ <= z && z <= b.MaxZ)))
                    .OrderBy(b => b.Measure)
                    .FirstOrDefault()?.Key;
        }

        var rows = points.RowCount();
        var builder = CopyColumns(points);
        builder.AddColumn(Enumerable.Range(0, rows).Select(r => (object?)Containing(r)).ToArray(),
            asName, typeof(string));
        return [new TableValue(builder.Build())];
    }
}
