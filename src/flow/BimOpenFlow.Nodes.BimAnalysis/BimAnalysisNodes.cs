using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The bim.* analysis pack: the workflows people otherwise write in code
/// over raw BIM Open Schema data — grouping tables, parameter tables, bounding boxes
/// and dimensions, room classification, and navigation graphs.</summary>
public static class BimAnalysisNodes
{
    public static IReadOnlyList<IFlowNode> All { get; } =
    [
        new BimElementsNode(),
        new BimRoomsNode(),
        new BimLevelsNode(),
        new BimBoundsNode(),
        new BimParamTableNode(),
        new BimParamCoverageNode(),
        new BimDisciplineNode(),
        new BimClassifyRoomsNode(),
        new BimContainmentNode(),
        new BimNearestNode(),
        new BimNavGraphNode(),
        new BimHopsNode(),
    ];
}
