using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>The view3d node pack: tables the 3D pane consumes.</summary>
public static class GeometryNodes
{
    public static IReadOnlyList<IFlowNode> All { get; } =
    [
        new InstancesNode(),
        new ColorNode(),
        new IsolateNode(),
        new CameraNode(),
    ];
}
