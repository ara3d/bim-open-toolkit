using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Joins a value table onto an instance table and appends r,g,b,a columns (0..1).
/// Numeric values map through a gradient normalized over the value column's range;
/// text values map categorically (stable: sorted distinct values). Unmatched rows get gray.
/// </summary>
public sealed class ColorNode : IFlowNode
{
    public static readonly Rgb Unmatched = new(0.5, 0.5, 0.5);

    public NodeSpec Spec { get; } = new(
        "view3d.color", 1, NodeCapability.Pure,
        [new("instances", PortType.Table), new("values", PortType.Table)],
        [new("instances", PortType.Table)],
        [
            new("joinColumn", ParamKind.Text),
            new("valueColumn", ParamKind.Text),
            new("colorMap", ParamKind.Enum, "viridis", ["viridis", "category10", "redgreen"]),
        ],
        "Adds r,g,b,a color columns to an instance table by joining a value table on a shared column.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var values = ((TableValue)inputs[1]).Table;
        var joinName = parameters.GetText("joinColumn");
        var instJoin = instances.RequireColumn(joinName);
        var valJoin = values.RequireColumn(joinName);
        var valCol = values.RequireColumn(parameters.GetText("valueColumn"));
        var map = parameters.GetText("colorMap", "viridis");

        var numeric = values.Columns[valCol].IsNumeric();
        if (!numeric && map != "category10")
            context.Warn($"colorMap '{map}' needs a numeric value column; using category10");

        var colors = numeric && map != "category10"
            ? GradientColors(values, valJoin, valCol, map == "redgreen" ? ColorMaps.RedGreenStops : ColorMaps.ViridisStops)
            : CategoricalColors(values, valJoin, valCol);

        var n = instances.RowCount();
        var r = new double[n]; var g = new double[n]; var b = new double[n]; var a = new double[n];
        for (var i = 0; i < n; i++)
        {
            var key = TableOps.CanonicalText(instances[instJoin, i]);
            var c = key != null && colors.TryGetValue(key, out var found) ? found : Unmatched;
            r[i] = c.R; g[i] = c.G; b[i] = c.B; a[i] = 1;
        }

        var builder = new DataTableBuilder(instances.Name);
        builder.AddColumns(instances);
        builder.AddColumn(r, "r");
        builder.AddColumn(g, "g");
        builder.AddColumn(b, "b");
        builder.AddColumn(a, "a");
        return [new TableValue(builder.Build())];
    }

    /// <summary>Join key to gradient color, normalized over the value column's min..max (first key occurrence wins).</summary>
    private static Dictionary<string, Rgb> GradientColors(
        IDataTable values, int joinCol, int valueCol, IReadOnlyList<Rgb> stops)
    {
        var n = values.RowCount();
        var min = double.MaxValue;
        var max = double.MinValue;
        for (var i = 0; i < n; i++)
            if (TableOps.CellNumber(values[valueCol, i]) is { } v)
            {
                min = Math.Min(min, v);
                max = Math.Max(max, v);
            }

        var result = new Dictionary<string, Rgb>();
        for (var i = 0; i < n; i++)
        {
            var key = TableOps.CanonicalText(values[joinCol, i]);
            if (key is null || result.ContainsKey(key))
                continue;
            if (TableOps.CellNumber(values[valueCol, i]) is not { } v)
                continue;
            result[key] = ColorMaps.Gradient(stops, max > min ? (v - min) / (max - min) : 0.5);
        }
        return result;
    }

    /// <summary>Join key to categorical color; palette index by sorted distinct value text, so
    /// assignment is stable under row reordering.</summary>
    private static Dictionary<string, Rgb> CategoricalColors(IDataTable values, int joinCol, int valueCol)
    {
        var n = values.RowCount();
        var distinct = new SortedSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < n; i++)
            if (TableOps.CanonicalText(values[valueCol, i]) is { } text)
                distinct.Add(text);

        var indices = new Dictionary<string, int>();
        foreach (var text in distinct)
            indices.Add(text, indices.Count);

        var result = new Dictionary<string, Rgb>();
        for (var i = 0; i < n; i++)
        {
            var key = TableOps.CanonicalText(values[joinCol, i]);
            if (key is null || result.ContainsKey(key))
                continue;
            if (TableOps.CanonicalText(values[valueCol, i]) is { } text)
                result[key] = ColorMaps.Categorical(indices[text]);
        }
        return result;
    }
}
