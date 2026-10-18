using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Bcf;

/// <summary>The bcf.* pack: BCF 3.0 (BIM Collaboration Format) issues in and out of a graph.
/// Registered by the studio's bim profile.</summary>
public static class BcfNodes
{
    public static IReadOnlyList<IFlowNode> All { get; } =
    [
        new BcfIssueNode(),
        new BcfTopicsNode(),
        new BcfWriteNode(),
        new BcfReadNode(),
    ];
}
