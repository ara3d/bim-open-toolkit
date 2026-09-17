using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>One row per level, ordered by elevation, with element and room counts.</summary>
public sealed class BimLevelsNode : IFlowNode
{
    public const string Kind = "bim.levels";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec("path", ParamKind.FilePath)],
        "Loads a .bos file into one row per level, ordered by elevation: EntityIndex, Name, "
        + "Elevation, ElementCount (elements whose Level parameter points here), RoomCount. "
        + "Levels are the elements carrying a level-elevation parameter or categorized as Levels.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var model = BimModel.Get(parameters.RequiredText("path", Kind), Kind);
        // TODO: levels are drawn from InstanceElements(), so a level entity with no
        // category is invisible even when it carries the elevation parameter.
        var elements = model.InstanceElements().ToList();
        var levels = elements
            .Where(e => e.ParameterValues.ContainsKey(CommonRevitParameters.LevelElevation)
                        || string.Equals(e.Category, "Levels", StringComparison.OrdinalIgnoreCase))
            .OrderBy(Elevation)
            .ToList();
        var roomCategories = new HashSet<string>(["Rooms", "Spaces"], StringComparer.OrdinalIgnoreCase);
        object?[] Cells(Func<EntityModel, object?> f) => levels.Select(f).ToArray();
        long CountOnLevel(EntityIndex level, Func<EntityModel, bool> predicate)
            => elements.Count(e => predicate(e)
                && e.GetParameterAsEntity(CommonRevitParameters.ElementLevel) is { } l && l.Index == level);

        var b = new DataTableBuilder("levels");
        b.AddColumn(Cells(e => (long)(int)e.Index), BimColumns.EntityIndex, typeof(long));
        b.AddColumn(Cells(e => e.Name), BimColumns.Name, typeof(string));
        b.AddColumn(Cells(e => Elevation(e)), BimColumns.Elevation, typeof(double));
        b.AddColumn(Cells(e => CountOnLevel(e.Index, _ => true)), BimColumns.ElementCount, typeof(long));
        b.AddColumn(Cells(e => CountOnLevel(e.Index, r => roomCategories.Contains(r.Category))),
            BimColumns.RoomCount, typeof(long));
        return [new TableValue(b.Build())];
    }

    private static double Elevation(EntityModel e)
        => e.ParameterValues.TryGetValue(CommonRevitParameters.LevelElevation, out var v) && v is float f
            ? f
            : 0;
}
