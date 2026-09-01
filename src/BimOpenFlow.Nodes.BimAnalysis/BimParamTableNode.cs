using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The typed parameter table: one row per element, one column per requested
/// parameter, with real column types instead of the all-text ParameterText view.</summary>
public sealed class BimParamTableNode : IFlowNode
{
    public const string Kind = "bim.paramTable";

    // TODO: suggest parameter names from the file (needs a new SuggestKind through
    // contracts + web; ColumnsOfInput and TablesInFile are the only kinds today).
    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("path", ParamKind.FilePath),
            new ParamSpec("parameters", ParamKind.Text),
        ],
        "Loads a .bos file into one row per element with EntityIndex, Name, Category plus one "
        + "typed column per requested parameter ('parameters' is a comma-separated list of full "
        + "descriptor names, e.g. Rvt:Room:Volume). Columns take the short name after the last "
        + "colon (the full name on collision); Int maps to integer, Number to double, String and "
        + "Entity to text, and Point parameters expand to three .X/.Y/.Z double columns.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var path = parameters.RequiredText("path", Kind);
        var requested = parameters.RequiredText("parameters", Kind).SplitNames();
        if (requested.Count == 0)
            throw new ArgumentException($"{Kind}: parameter 'parameters' must name at least one parameter.");

        var model = BimModel.Get(path, Kind);
        var elements = model.InstanceElements().ToList();

        var builder = new DataTableBuilder("paramTable");
        var used = new HashSet<string> { BimColumns.EntityIndex, BimColumns.Name, BimColumns.Category };
        builder.AddColumn(elements.Select(e => (object?)(long)e.Index).ToArray(), BimColumns.EntityIndex, typeof(long));
        builder.AddColumn(elements.Select(e => (object?)e.Name).ToArray(), BimColumns.Name, typeof(string));
        builder.AddColumn(elements.Select(e => (object?)e.Category).ToArray(), BimColumns.Category, typeof(string));

        foreach (var fullName in requested)
        {
            var desc = model.Objects.Descriptors.FirstOrDefault(d =>
                string.Equals(d.Name, fullName, StringComparison.OrdinalIgnoreCase));
            var column = ColumnName(CommonRevitParameters.ParameterNameToUI(fullName), fullName, used,
                desc?.ParameterType == ParameterType.Point);
            if (desc == null)
            {
                context.Warn($"{Kind}: unknown parameter '{fullName}'.");
                builder.AddColumn(new object?[elements.Count], column, typeof(string));
            }
            else if (desc.ParameterType == ParameterType.Point)
            {
                AddPointColumns(builder, model, elements, desc.Name, column);
            }
            else
            {
                builder.AddColumn(elements.Select(e => CellValue(e, desc.Name)).ToArray(),
                    column, CellType(desc.ParameterType));
            }
        }
        return [new TableValue(builder.Build())];
    }

    /// <summary>The short name, or the full name when the short name (or, for a point,
    /// any of its .X/.Y/.Z expansions) is taken by a lead column or an earlier
    /// parameter; reserves the chosen name(s).</summary>
    private static string ColumnName(string shortName, string fullName, HashSet<string> used, bool isPoint)
    {
        IEnumerable<string> Expand(string b) => isPoint ? [$"{b}.X", $"{b}.Y", $"{b}.Z"] : [b];
        var name = Expand(shortName).Any(used.Contains) ? fullName : shortName;
        foreach (var n in Expand(name))
            used.Add(n);
        return name;
    }

    private static void AddPointColumns(DataTableBuilder builder, BimModel model,
        IReadOnlyList<EntityModel> elements, string paramName, string column)
    {
        foreach (var (axis, pick) in new (string Axis, Func<Point, double> Pick)[]
                 { ("X", p => p.X), ("Y", p => p.Y), ("Z", p => p.Z) })
            builder.AddColumn(elements.Select(e =>
                    model.TryGetPoint(e.Index, paramName, out var p) ? (object?)pick(p) : null).ToArray(),
                $"{column}.{axis}", typeof(double));
    }

    private static Type CellType(ParameterType type)
        => type switch
        {
            ParameterType.Int => typeof(long),
            ParameterType.Number => typeof(double),
            _ => typeof(string),
        };

    private static object? CellValue(EntityModel e, string paramName)
        => e.ParameterValues.TryGetValue(paramName, out var v)
            ? v switch
            {
                int i => (long)i,
                float f => (double)f,
                EntityModel m => m.Name,
                _ => v,
            }
            : null;
}
