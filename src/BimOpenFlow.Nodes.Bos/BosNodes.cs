using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Bos;

/// <summary>The BOS node pack, ready for registry composition
/// (e.g. NodeRegistry.Combine(BosNodes.All, ...)).</summary>
public static class BosNodes
{
    public static IReadOnlyList<IFlowNode> All { get; } =
    [
        new BosLoadNode(),
        new BosQueryNode(),
        new TableFilterNode(),
        new TableDeriveNode(),
        new TableAggregateNode(),
        new TableSortNode(),
    ];
}
