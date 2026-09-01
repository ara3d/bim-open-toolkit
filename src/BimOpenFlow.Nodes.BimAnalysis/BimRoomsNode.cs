using Ara3D.DataFlowEngine.Abstractions;

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
        => throw new NotImplementedException($"{Kind}: track SRC");
}
