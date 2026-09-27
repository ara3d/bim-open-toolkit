using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Joins a value table onto an instance table and appends r,g,b,a columns (0..1),
/// and reports the colour scale it used in a `legend` output table (Support's
/// <see cref="ColorScale"/>). With no `scale` input it builds its own scale from
/// `values`, auto or over a manual `min`..`max` domain; with a `scale` input it
/// colours through that scale instead and passes it through unchanged on `legend`.
/// Unmatched rows get gray.
/// </summary>
public sealed class ColorNode : IFlowNode
{
    public static readonly Rgb Unmatched = ColorScale.NoValue;

    public NodeSpec Spec { get; } = new(
        "view3d.color", 1, NodeCapability.Pure,
        [
            new("instances", PortType.Table),
            new("values", PortType.Table),
            new("scale", PortType.Table, Optional: true),
        ],
        [
            new("instances", PortType.Table),
            new("legend", PortType.Table),
        ],
        [
            new("joinColumn", ParamKind.Text),
            new("valueColumn", ParamKind.Text),
            new("colorMap", ParamKind.Enum, "viridis", ColorScale.ColorMapNames),
            new("auto", ParamKind.Boolean, "true"),
            new("min", ParamKind.Number, "0"),
            new("max", ParamKind.Number, "1"),
        ],
        "Adds r,g,b,a color columns to an instance table by joining a value table on a shared "
        + "column, and reports the colour scale used on a `legend` output. Without a `scale` "
        + "input the scale is built from `auto`/`min`/`max`/`colorMap`; with one, that scale "
        + "colours the cells and passes through unchanged.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var values = ((TableValue)inputs[1]).Table;
        var joinName = parameters.GetText("joinColumn");
        var instJoin = instances.RequireColumn(joinName);
        var valJoin = values.RequireColumn(joinName);

        var valueColumnParam = parameters.GetText("valueColumn");
        var colorMap = parameters.GetText("colorMap", "viridis");
        var auto = parameters.GetBoolean("auto", true);
        var min = parameters.GetNumber("min", 0);
        var max = parameters.GetNumber("max", 1);

        var scaleInput = inputs.Count > 2 ? inputs[2] as TableValue : null;

        ColorScale scale;
        IDataTable legend;
        int valCol;

        if (scaleInput is not null)
        {
            var parsed = ColorScale.FromTable(scaleInput.Table, context, Spec.Kind);
            legend = scaleInput.Table;

            if (parsed is null)
            {
                // The scale table is malformed; fall back to building our own scale so the
                // graph still colours something rather than failing (principle: warn, don't block).
                valCol = values.RequireColumn(valueColumnParam);
                scale = ColorScale.Build(values, valCol, colorMap, auto, min, max, context, Spec.Kind);
            }
            else
            {
                scale = parsed;
                if (valueColumnParam.Length > 0 && valueColumnParam != scale.Column)
                {
                    context.Warn($"{Spec.Kind}: valueColumn '{valueColumnParam}' differs from the scale's "
                        + $"column '{scale.Column}'; using '{scale.Column}'");
                }
                if (!auto)
                {
                    context.Warn($"{Spec.Kind}: 'min' and 'max' are ignored because a 'scale' input is connected");
                }
                valCol = values.RequireColumn(scale.Column);
            }
        }
        else
        {
            valCol = values.RequireColumn(valueColumnParam);
            scale = ColorScale.Build(values, valCol, colorMap, auto, min, max, context, Spec.Kind);
            legend = scale.ToTable();
        }

        // Join key to the value table's first-occurrence cell for that key, colored once the
        // scale is known (matches the pre-existing join semantics: first key occurrence wins).
        var keyToCell = new Dictionary<string, object?>();
        var total = values.RowCount();
        for (var i = 0; i < total; i++)
        {
            var key = TableOps.CanonicalText(values[valJoin, i]);
            if (key is null || keyToCell.ContainsKey(key))
                continue;
            keyToCell[key] = values[valCol, i];
        }

        var n = instances.RowCount();
        var r = new double[n]; var g = new double[n]; var b = new double[n]; var a = new double[n];
        for (var i = 0; i < n; i++)
        {
            var key = TableOps.CanonicalText(instances[instJoin, i]);
            var color = key is not null && keyToCell.TryGetValue(key, out var cell)
                ? scale.ColorOf(cell)
                : Unmatched;
            r[i] = color.R; g[i] = color.G; b[i] = color.B; a[i] = 1;
        }

        var builder = new DataTableBuilder(instances.Name);
        builder.AddColumns(instances);
        builder.AddColumn(r, "r");
        builder.AddColumn(g, "g");
        builder.AddColumn(b, "b");
        builder.AddColumn(a, "a");
        return [new TableValue(builder.Build()), new TableValue(legend)];
    }
}
