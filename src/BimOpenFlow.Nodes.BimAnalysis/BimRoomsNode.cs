using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>One row per room (or space): identity, level, size, contained element
/// count, and bounding box when present.</summary>
public sealed class BimRoomsNode : IFlowNode
{
    public const string Kind = "bim.rooms";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("path", ParamKind.FilePath),
            new ParamSpec("categories", ParamKind.Text, "Rooms,Spaces"),
        ],
        "Loads a .bos file into one row per room: EntityIndex, Name, Number, Level, Elevation, "
        + "Volume, UnboundedHeight, ElementCount (elements whose Room/Space parameter points here), "
        + "and when bounds exist MinX..MaxZ, SizeX/Y/Z, CenterX/Y/Z, FootprintArea. Rooms are the "
        + "elements whose category is in the comma-separated 'categories' list.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var model = BimModel.Get(parameters.RequiredText("path", Kind), Kind);
        var categories = parameters.GetText("categories", "Rooms,Spaces") is { Length: > 0 } c ? c : "Rooms,Spaces";
        var rooms = model.ElementsInCategories(categories).ToList();
        var containedCounts = model.InstanceElements()
            .Select(e => RoomOf(e)?.Index)
            .Where(i => i != null)
            .GroupBy(i => i!.Value)
            .ToDictionary(g => g.Key, g => (long)g.Count());
        object?[] Cells(Func<EntityModel, object?> f) => rooms.Select(f).ToArray();
        object?[] BoundsCells(Func<(Point Min, Point Max), double> f)
            => Cells(e => model.GetBounds(e.Index) is { } bb ? f(bb) : null);

        var b = new DataTableBuilder("rooms");
        b.AddColumn(Cells(e => (long)(int)e.Index), BimColumns.EntityIndex, typeof(long));
        b.AddColumn(Cells(e => e.Name), BimColumns.Name, typeof(string));
        b.AddColumn(Cells(e => e.GetParameterAsString(CommonRevitParameters.RoomNumber)), BimColumns.Number, typeof(string));
        b.AddColumn(Cells(e => e.LevelName), BimColumns.Level, typeof(string));
        b.AddColumn(Cells(Elevation), BimColumns.Elevation, typeof(double));
        b.AddColumn(Cells(e => FirstNumber(e, CommonRevitParameters.RoomVolume, CommonRevitParameters.SpaceVolume)),
            BimColumns.Volume, typeof(double));
        b.AddColumn(Cells(e => FirstNumber(e, CommonRevitParameters.RoomUnboundedHeight, CommonRevitParameters.SpaceUnboundedHeight)),
            BimColumns.UnboundedHeight, typeof(double));
        b.AddColumn(Cells(e => containedCounts.GetValueOrDefault(e.Index)), BimColumns.ElementCount, typeof(long));
        b.AddColumn(BoundsCells(bb => bb.Min.X), BimColumns.MinX, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Min.Y), BimColumns.MinY, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Min.Z), BimColumns.MinZ, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Max.X), BimColumns.MaxX, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Max.Y), BimColumns.MaxY, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Max.Z), BimColumns.MaxZ, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Max.X - bb.Min.X), BimColumns.SizeX, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Max.Y - bb.Min.Y), BimColumns.SizeY, typeof(double));
        b.AddColumn(BoundsCells(bb => bb.Max.Z - bb.Min.Z), BimColumns.SizeZ, typeof(double));
        b.AddColumn(BoundsCells(bb => (bb.Min.X + bb.Max.X) / 2.0), BimColumns.CenterX, typeof(double));
        b.AddColumn(BoundsCells(bb => (bb.Min.Y + bb.Max.Y) / 2.0), BimColumns.CenterY, typeof(double));
        b.AddColumn(BoundsCells(bb => (bb.Min.Z + bb.Max.Z) / 2.0), BimColumns.CenterZ, typeof(double));
        b.AddColumn(BoundsCells(bb => (double)(bb.Max.X - bb.Min.X) * (bb.Max.Y - bb.Min.Y)),
            BimColumns.FootprintArea, typeof(double));
        return [new TableValue(b.Build())];
    }

    private static object? Elevation(EntityModel e)
        => e.GetParameterAsEntity(CommonRevitParameters.ElementLevel) is { } level
            ? NumberOrNull(level, CommonRevitParameters.LevelElevation)
            : null;

    private static object? NumberOrNull(EntityModel e, string name)
        => e.ParameterValues.TryGetValue(name, out var v) && v is float f ? (double)f : null;

    private static object? FirstNumber(EntityModel e, string first, string second)
        => NumberOrNull(e, first) ?? NumberOrNull(e, second);

    private static EntityModel? RoomOf(EntityModel e)
        => e.GetParameterAsEntity(CommonRevitParameters.FISpace)
           ?? e.GetParameterAsEntity(CommonRevitParameters.FIRoom);
}
