using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Converts an instance table into a boxes table (see README.md): one box per
/// row, or with a group column, one union box per sorted distinct group value.
/// The label column holds the group value (group mode) or the row's globalId,
/// falling back to instanceIndex (per-row mode). Color columns r,g,b,a are
/// carried through when all four are present (group mode: first row's color).
/// </summary>
public sealed class BoundingBoxesNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.boundingBoxes", 1, NodeCapability.Pure,
        [new("instances", PortType.Table)],
        [new("boxes", PortType.Table)],
        [new("groupColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances"))],
        "Emits the axis-aligned bounding boxes of instances, per row or unioned per group.");

    public const string NullGroupLabel = "(none)";

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var bounds = BoundsColumns(instances);
        var groupName = parameters.GetText("groupColumn");
        return [new TableValue(groupName.Length == 0
            ? PerRowBoxes(instances, bounds)
            : GroupedBoxes(instances, bounds, instances.RequireColumn(groupName)))];
    }

    // minX minY minZ maxX maxY maxZ column indices.
    private static int[] BoundsColumns(IDataTable table)
        => [table.RequireColumn("minX"), table.RequireColumn("minY"), table.RequireColumn("minZ"),
            table.RequireColumn("maxX"), table.RequireColumn("maxY"), table.RequireColumn("maxZ")];

    private static IDataTable PerRowBoxes(IDataTable instances, int[] bounds)
    {
        var n = instances.RowCount();
        var globalId = instances.ColumnIndex("globalId");
        var instanceIndex = instances.ColumnIndex("instanceIndex");
        var labels = new string[n];
        for (var i = 0; i < n; i++)
            labels[i] = globalId >= 0 ? TableOps.CanonicalText(instances[globalId, i]) ?? ""
                : instanceIndex >= 0 ? TableOps.CanonicalText(instances[instanceIndex, i]) ?? ""
                : TableOps.CanonicalText(i)!;

        var rows = new int[n];
        for (var i = 0; i < n; i++)
            rows[i] = i;
        var colors = ColorCells(instances, rows);
        return BoxTables.Build(
            NumberCells(instances, bounds[0], rows), NumberCells(instances, bounds[1], rows),
            NumberCells(instances, bounds[2], rows), NumberCells(instances, bounds[3], rows),
            NumberCells(instances, bounds[4], rows), NumberCells(instances, bounds[5], rows),
            colors?[0], colors?[1], colors?[2], colors?[3], labels);
    }

    private static IDataTable GroupedBoxes(IDataTable instances, int[] bounds, int groupCol)
    {
        var n = instances.RowCount();
        var groups = new SortedDictionary<string, List<int>>(StringComparer.Ordinal);
        var nullRows = new List<int>();
        for (var i = 0; i < n; i++)
            if (TableOps.CanonicalText(instances[groupCol, i]) is { } key)
            {
                if (!groups.TryGetValue(key, out var rows))
                    groups.Add(key, rows = []);
                rows.Add(i);
            }
            else
                nullRows.Add(i);

        var labels = new List<string>(groups.Keys);
        var groupRows = new List<List<int>>(groups.Values);
        if (nullRows.Count > 0)
        {
            labels.Add(NullGroupLabel);
            groupRows.Add(nullRows);
        }

        var count = groupRows.Count;
        var minX = new double[count]; var minY = new double[count]; var minZ = new double[count];
        var maxX = new double[count]; var maxY = new double[count]; var maxZ = new double[count];
        for (var i = 0; i < count; i++)
        {
            var union = UnionBounds(instances, bounds, groupRows[i]);
            minX[i] = union[0]; minY[i] = union[1]; minZ[i] = union[2];
            maxX[i] = union[3]; maxY[i] = union[4]; maxZ[i] = union[5];
        }

        var firstRows = new int[count];
        for (var i = 0; i < count; i++)
            firstRows[i] = groupRows[i][0];
        var colors = ColorCells(instances, firstRows);
        return BoxTables.Build(minX, minY, minZ, maxX, maxY, maxZ,
            colors?[0], colors?[1], colors?[2], colors?[3], labels.ToArray());
    }

    private static double[] UnionBounds(IDataTable instances, int[] bounds, IReadOnlyList<int> rows)
    {
        var union = new[]
        {
            double.MaxValue, double.MaxValue, double.MaxValue,
            double.MinValue, double.MinValue, double.MinValue,
        };
        foreach (var row in rows)
            for (var axis = 0; axis < 3; axis++)
            {
                union[axis] = Math.Min(union[axis], CellNumber(instances, bounds[axis], row));
                union[axis + 3] = Math.Max(union[axis + 3], CellNumber(instances, bounds[axis + 3], row));
            }
        return union;
    }

    /// <summary>r,g,b,a cell arrays for the given rows, or null unless all four columns exist.</summary>
    private static double[][]? ColorCells(IDataTable instances, IReadOnlyList<int> rows)
    {
        var r = instances.ColumnIndex("r");
        var g = instances.ColumnIndex("g");
        var b = instances.ColumnIndex("b");
        var a = instances.ColumnIndex("a");
        if (r < 0 || g < 0 || b < 0 || a < 0)
            return null;
        return [NumberCells(instances, r, rows), NumberCells(instances, g, rows),
            NumberCells(instances, b, rows), NumberCells(instances, a, rows)];
    }

    private static double[] NumberCells(IDataTable instances, int column, IReadOnlyList<int> rows)
    {
        var result = new double[rows.Count];
        for (var i = 0; i < rows.Count; i++)
            result[i] = CellNumber(instances, column, rows[i]);
        return result;
    }

    private static double CellNumber(IDataTable table, int column, int row)
        => TableOps.CellNumber(table[column, row]) ?? 0;
}
