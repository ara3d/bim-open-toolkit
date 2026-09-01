using Ara3D.DataFlowEngine.Abstractions;

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
        + "DoorName, Level, FromRoom, ToRoom — the room names from the door's from/to-room "
        + "parameters, with Outside standing in for a missing side. The rows are the undirected "
        + "edges of the room navigation graph; feed them to bim.hops for reachability.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track NAV");
}
