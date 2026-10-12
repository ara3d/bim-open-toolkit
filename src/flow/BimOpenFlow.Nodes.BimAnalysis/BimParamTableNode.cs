using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The typed parameter table: one row per element, one column per requested
/// parameter, with real column types instead of the all-text ParameterText view.</summary>
public sealed class BimParamTableNode : ISchemaNode
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
            new ParamSpec("path", ParamKind.FilePath, Bindable: PortType.Text, Suggest: SuggestSource.FilesWith(".bos")),
            new ParamSpec("parameters", ParamKind.Text, List: true),
        ],
        "Loads a .bos file into one row per element with EntityIndex, Name, Category plus one "
        + "typed column per requested parameter ('parameters' is a comma-separated list of full "
        + "descriptor names, e.g. Rvt:Room:Volume). Columns take the short name after the last "
        + "colon (the full name on collision); Int maps to integer, Number to double, String and "
        + "Entity to text, and Point parameters expand to three .X/.Y/.Z double columns.",
        Schemas: [SchemaSpec.Inferred("table")]);

    /// <summary>One requested parameter: its output column (the base name of three for a point), and
    /// the descriptor's name and type, both null when the file has no such parameter.</summary>
    private sealed record ParamColumn(string FullName, string Column, string? DescriptorName, ParameterType? Type);

    /// <summary>The columns follow from the requested names and the file's parameter descriptors, never
    /// from its rows, so this reads the model through the same cache as Eval.</summary>
    public SchemaResult Infer(string output, IReadOnlyList<SchemaInput> inputs, ParamValues parameters, ISchemaCatalog catalog)
    {
        var path = parameters.GetText("path");
        var requested = parameters.GetText("parameters").SplitNames();
        if (requested.Count == 0)
            return SchemaResult.Fail($"{Kind}: parameter 'parameters' must name at least one parameter.");
        if (!File.Exists(path))
            return SchemaResult.Fail($"{Kind}: file not found: {path}");
        KindColumn[] lead = [ColumnKinds.EntityIndex.NotNull(), ColumnKinds.Name, ColumnKinds.Category.NotNull()];
        KindColumn[] columns = [.. lead, .. Plan(BimModel.Get(path, Kind), requested).SelectMany(Columns)];
        return SchemaResult.Of(columns.ToSchema());
    }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var path = parameters.RequiredText("path", Kind);
        var requested = parameters.RequiredText("parameters", Kind).SplitNames();
        if (requested.Count == 0)
            throw new ArgumentException($"{Kind}: parameter 'parameters' must name at least one parameter.");

        var model = BimModel.Get(path, Kind);
        var elements = model.InstanceElements().ToList();

        var builder = new DataTableBuilder("paramTable");
        builder.AddColumn(elements.Select(e => (object?)(long)e.Index).ToArray(), BimColumns.EntityIndex, typeof(long));
        builder.AddColumn(elements.Select(e => (object?)e.Name).ToArray(), BimColumns.Name, typeof(string));
        builder.AddColumn(elements.Select(e => (object?)e.Category).ToArray(), BimColumns.Category, typeof(string));

        foreach (var column in Plan(model, requested))
        {
            // A descriptor without a name cannot match a requested name.
            if (column.DescriptorName is not { } name || column.Type is not { } type)
            {
                context.Warn($"{Kind}: unknown parameter '{column.FullName}'.");
                builder.AddColumn(new object?[elements.Count], column.Column, typeof(string));
            }
            else if (type == ParameterType.Point)
            {
                AddPointColumns(builder, model, elements, name, column.Column);
            }
            else
            {
                builder.AddColumn(elements.Select(e => CellValue(e, name)).ToArray(),
                    column.Column, ClrType(ShapeOf(type)));
            }
        }
        return [new TableValue(builder.Build())];
    }

    /// <summary>The output column of each requested parameter, named after the lead columns and the
    /// earlier parameters.</summary>
    private static IReadOnlyList<ParamColumn> Plan(BimModel model, IReadOnlyList<string> requested)
    {
        var used = new HashSet<string> { BimColumns.EntityIndex, BimColumns.Name, BimColumns.Category };
        return [.. requested.Select(fullName =>
        {
            var desc = model.Objects.Descriptors.FirstOrDefault(d =>
                string.Equals(d.Name, fullName, StringComparison.OrdinalIgnoreCase));
            var column = ColumnName(CommonRevitParameters.ParameterNameToUI(fullName), fullName, used,
                desc?.ParameterType == ParameterType.Point);
            return new ParamColumn(fullName, column, desc?.Name, desc?.ParameterType);
        })];
    }

    private static IEnumerable<KindColumn> Columns(ParamColumn column)
        => column.Type switch
        {
            null => [KindColumn.Plain(column.Column, ColumnType.Text)],
            ParameterType.Point => PointAxes.Select(a => KindColumn.Plain($"{column.Column}.{a}", ColumnType.Number)),
            { } type => [KindColumn.Plain(column.Column, ShapeOf(type))],
        };

    private static readonly string[] PointAxes = ["X", "Y", "Z"];

    /// <summary>The short name, or the full name when the short name (or, for a point,
    /// any of its .X/.Y/.Z expansions) is taken by a lead column or an earlier
    /// parameter; reserves the chosen name(s).</summary>
    private static string ColumnName(string shortName, string fullName, HashSet<string> used, bool isPoint)
    {
        IEnumerable<string> Expand(string b) => isPoint ? PointAxes.Select(a => $"{b}.{a}") : [b];
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

    private static ColumnType ShapeOf(ParameterType type)
        => type switch
        {
            ParameterType.Int => ColumnType.Integer,
            ParameterType.Number => ColumnType.Number,
            _ => ColumnType.Text,
        };

    private static Type ClrType(ColumnType type)
        => type switch
        {
            ColumnType.Integer => typeof(long),
            ColumnType.Number => typeof(double),
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
