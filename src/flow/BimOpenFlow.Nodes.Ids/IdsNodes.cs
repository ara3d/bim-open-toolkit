using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Ids;

/// <summary>The ids.* pack: buildingSMART IDS 1.0 (Information Delivery Specification) files
/// read as checks over BOS tables. Registered by the studio's bim profile.</summary>
public static class IdsNodes
{
    public static IReadOnlyList<IFlowNode> All { get; } =
    [
        new IdsCheckNode(),
        new IdsSpecificationsNode(),
    ];
}
