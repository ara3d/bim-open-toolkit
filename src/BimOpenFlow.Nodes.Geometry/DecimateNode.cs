using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Thins an instance table to the visually significant rows: drops rows whose
/// bounds diagonal is under minDiagonal, then keeps the ceil(keepFraction * n)
/// largest remaining rows by bounds volume (ties resolved by row order).
/// Kept rows preserve their original order. This is instance thinning —
/// triangle counts per mesh are untouched.
/// </summary>
public sealed class DecimateNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.decimate", 1, NodeCapability.Pure,
        [new("instances", PortType.Table)],
        [new("instances", PortType.Table)],
        [
            new("keepFraction", ParamKind.Number, "0.25"),
            new("minDiagonal", ParamKind.Number, "0"),
        ],
        "Keeps only the largest instances: a minimum bounds diagonal, then the top fraction by volume.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var minX = instances.RequireColumn("minX");
        var minY = instances.RequireColumn("minY");
        var minZ = instances.RequireColumn("minZ");
        var maxX = instances.RequireColumn("maxX");
        var maxY = instances.RequireColumn("maxY");
        var maxZ = instances.RequireColumn("maxZ");

        var keepFraction = parameters.GetNumber("keepFraction", 0.25);
        if (!(keepFraction >= 0 && keepFraction <= 1))
        {
            context.Warn($"keepFraction {keepFraction} is outside [0,1]; clamping");
            keepFraction = double.IsNaN(keepFraction) ? 0.25 : Math.Clamp(keepFraction, 0, 1);
        }
        var minDiagonal = parameters.GetNumber("minDiagonal");

        var candidates = new List<(int Row, double Volume)>();
        for (var i = 0; i < instances.RowCount(); i++)
        {
            var ex = Extent(instances, maxX, minX, i);
            var ey = Extent(instances, maxY, minY, i);
            var ez = Extent(instances, maxZ, minZ, i);
            var diagonal = Math.Sqrt(ex * ex + ey * ey + ez * ez);
            if (diagonal >= minDiagonal)
                candidates.Add((i, Math.Max(ex, 0) * Math.Max(ey, 0) * Math.Max(ez, 0)));
        }

        var keepCount = (int)Math.Ceiling(keepFraction * candidates.Count);
        var rows = candidates
            .OrderByDescending(c => c.Volume)
            .ThenBy(c => c.Row)
            .Take(keepCount)
            .Select(c => c.Row)
            .OrderBy(r => r)
            .ToList();

        return [new TableValue(instances.SelectRows(rows, instances.Name))];
    }

    private static double Extent(IDataTable table, int maxCol, int minCol, int row)
        => (TableOps.CellNumber(table[maxCol, row]) ?? 0) - (TableOps.CellNumber(table[minCol, row]) ?? 0);
}
