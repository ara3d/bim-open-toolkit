using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Adds a room-classification column derived from room names by ordered
/// regular-expression rules, with a built-in ruleset for common room types.</summary>
public sealed class BimClassifyRoomsNode : IFlowNode
{
    public const string Kind = "bim.classifyRooms";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("table", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("column", ParamKind.Text, BimColumns.Name,
                Suggest: SuggestSource.ColumnsOf("table")),
            new ParamSpec("rules", ParamKind.Json),
            new ParamSpec("as", ParamKind.Text, BimColumns.RoomClass),
        ],
        "Adds a room class column ('as', default RoomClass) by matching the name column against "
        + "ordered case-insensitive regex rules; first match wins, no match gets Other. The "
        + "built-in ruleset covers Office, Meeting, Circulation, Stair, Elevator, Sanitary, "
        + "Kitchen, Storage, Mechanical, Residential, and Parking; 'rules' is an optional JSON "
        + "array of {\"class\": ..., \"pattern\": ...} that replaces it.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track CLS");
}
