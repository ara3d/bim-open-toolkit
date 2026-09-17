using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The wide element table: one row per instance element with the columns
/// everyone groups by — category, type, level, room, document, workset, group.</summary>
public sealed class BimElementsNode : IFlowNode
{
    public const string Kind = "bim.elements";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec("path", ParamKind.FilePath)],
        "Loads a .bos file into one row per element: EntityIndex, LocalId, GlobalId, Name, "
        + "Category, CategoryType, Type, ClassName, Level, Elevation, Room, Document, Workset, Group. "
        + "The grouping workhorse: feed it to table.aggregate, bim.discipline, or bim.classifyRooms.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var model = BimModel.Get(parameters.RequiredText("path", Kind), Kind);
        var elements = model.InstanceElements().ToList();
        object?[] Cells(Func<EntityModel, object?> f) => elements.Select(f).ToArray();

        var b = new DataTableBuilder("elements");
        b.AddColumn(Cells(e => (long)(int)e.Index), BimColumns.EntityIndex, typeof(long));
        b.AddColumn(Cells(e => e.LocalId), BimColumns.LocalId, typeof(long));
        b.AddColumn(Cells(e => e.GlobalId), BimColumns.GlobalId, typeof(string));
        b.AddColumn(Cells(e => e.Name), BimColumns.Name, typeof(string));
        b.AddColumn(Cells(e => e.Category), BimColumns.Category, typeof(string));
        b.AddColumn(Cells(e => e.CategoryType), BimColumns.CategoryType, typeof(string));
        b.AddColumn(Cells(e => e.TypeName is { Length: > 0 } t ? t : null), BimColumns.Type, typeof(string));
        b.AddColumn(Cells(e => e.ClassName), BimColumns.ClassName, typeof(string));
        b.AddColumn(Cells(e => e.LevelName), BimColumns.Level, typeof(string));
        b.AddColumn(Cells(e => (object?)e.ElevationOrNull()), BimColumns.Elevation, typeof(double));
        b.AddColumn(Cells(e => e.RoomOf()?.Name), BimColumns.Room, typeof(string));
        b.AddColumn(Cells(e => e.DocumentTitle), BimColumns.Document, typeof(string));
        b.AddColumn(Cells(Workset), BimColumns.Workset, typeof(long));
        b.AddColumn(Cells(e => e.GroupName), BimColumns.Group, typeof(string));
        return [new TableValue(b.Build())];
    }

    private static object? Workset(EntityModel e)
        => e.ParameterValues.ContainsKey(CommonRevitParameters.ElementWorksetId)
            ? (long)e.GetParameterAsInt(CommonRevitParameters.ElementWorksetId)
            : null;
}
