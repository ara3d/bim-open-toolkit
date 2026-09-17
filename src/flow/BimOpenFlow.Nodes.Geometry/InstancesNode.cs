using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Loads a model file and outputs its renderable instances as a table (cached by file content hash).</summary>
public sealed class InstancesNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.instances", 1, NodeCapability.Pure,
        [],
        [new("instances", PortType.Table)],
        [new("path", ParamKind.FilePath)],
        "Renderable instances of a model file as a table: one row per placed mesh, with entity ids and world bounds.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => [new TableValue(ModelGeometryCache.Load(new FilePath(parameters.GetText("path"))).ToInstanceTable())];
}
