using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Nearest-neighbour join: for each row of a, the key of the closest row of b
/// by Euclidean distance between the two coordinate triples, plus the distance.</summary>
public sealed class BimNearestNode : IFlowNode
{
    public const string Kind = "bim.nearest";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs:
        [
            new PortSpec("a", PortType.Table),
            new PortSpec("b", PortType.Table),
        ],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("x", ParamKind.Text, BimColumns.CenterX, Suggest: SuggestSource.ColumnsOf("a")),
            new ParamSpec("y", ParamKind.Text, BimColumns.CenterY, Suggest: SuggestSource.ColumnsOf("a")),
            new ParamSpec("z", ParamKind.Text, BimColumns.CenterZ, Suggest: SuggestSource.ColumnsOf("a")),
            new ParamSpec("bx", ParamKind.Text, BimColumns.CenterX, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("by", ParamKind.Text, BimColumns.CenterY, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("bz", ParamKind.Text, BimColumns.CenterZ, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("key", ParamKind.Text, BimColumns.Name, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("as", ParamKind.Text, "Nearest"),
        ],
        "Adds two columns to a: 'as' (default Nearest) holding the 'key' of the closest b row by "
        + "3D distance between (x,y,z) and (bx,by,bz), and Distance holding that distance. Rows "
        + "with null coordinates, or when b is empty, get nulls. Typical use: distance from each "
        + "room center to the nearest exit door.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track GEO");
}
