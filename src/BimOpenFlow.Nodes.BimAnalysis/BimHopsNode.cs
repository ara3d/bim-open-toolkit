using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Breadth-first hop distances from a start room over an undirected edge
/// table, exposing unreachable rooms as nulls.</summary>
public sealed class BimHopsNode : IFlowNode
{
    public const string Kind = "bim.hops";

    // TODO: a bim.shortestPath node listing the actual room sequence between two rooms.
    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("edges", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("from", ParamKind.Text, BimColumns.FromRoom, Suggest: SuggestSource.ColumnsOf("edges")),
            new ParamSpec("to", ParamKind.Text, BimColumns.ToRoom, Suggest: SuggestSource.ColumnsOf("edges")),
            new ParamSpec("start", ParamKind.Text),
        ],
        "Walks the undirected graph whose edges are the (from, to) column pairs, breadth-first "
        + "from the 'start' room, into one row per room seen in either column: Room, Hops (0 for "
        + "the start, null for unreachable rooms), ordered by Hops then Room. An unknown start "
        + "room is an error. Typical input: the bim.navGraph edge table.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track NAV");
}
