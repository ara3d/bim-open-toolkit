using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.Support;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The room navigation graph: one edge per door, connecting the rooms on its
/// two sides (Outside when a side has no room).</summary>
public sealed class BimNavGraphNode : IFlowNode
{
    public const string Kind = "bim.navGraph";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("path", ParamKind.FilePath),
            new ParamSpec("doorCategories", ParamKind.Text, "Doors"),
        ],
        "Loads a .bos file into one row per door in the given categories: Door (entity index), "
        + "DoorName, Level, FromRoom, ToRoom — the rooms from the door's from/to-room parameters, "
        + "labelled 'Name Number' (so two Corridors on different floors stay distinct), with "
        + "Outside standing in for a missing side. The rows are the undirected edges of the room "
        + "navigation graph; feed them to bim.hops for reachability.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var path = parameters.RequiredText("path", Kind);
        var categories = parameters.GetText("doorCategories", "Doors");
        var model = BimModel.Get(path, Kind);
        var doors = model.ElementsInCategories(categories).ToList();

        var builder = new DataTableBuilder("navGraph");
        builder.AddColumn(doors.Select(d => (object?)(long)d.Index).ToArray(), BimColumns.Door, typeof(long));
        builder.AddColumn(doors.Select(d => (object?)d.Name).ToArray(), BimColumns.DoorName, typeof(string));
        builder.AddColumn(doors.Select(d => (object?)d.LevelName).ToArray(), BimColumns.Level, typeof(string));
        builder.AddColumn(doors.Select(d => (object?)SideLabel(d, CommonRevitParameters.FIFromRoom)).ToArray(),
            BimColumns.FromRoom, typeof(string));
        builder.AddColumn(doors.Select(d => (object?)SideLabel(d, CommonRevitParameters.FIToRoom)).ToArray(),
            BimColumns.ToRoom, typeof(string));
        return [new TableValue(builder.Build())];
    }

    private static string SideLabel(EntityModel door, string roomParameter)
        => door.GetParameterAsEntity(roomParameter) is { } room ? RoomLabel(room) : BimColumns.Outside;

    /// <summary>"Name Number" when the room has a number, else just Name.</summary>
    private static string RoomLabel(EntityModel room)
        => room.GetParameterAsString(CommonRevitParameters.RoomNumber) is { Length: > 0 } number
            ? $"{room.Name} {number}"
            : room.Name;
}
