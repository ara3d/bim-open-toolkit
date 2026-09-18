using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Loads a model file and outputs per-instance mesh measures: the
/// quantity table that bridges meshed geometry to schedules and SQL.</summary>
public sealed class MeasuresNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.measures", 1, NodeCapability.Pure,
        [],
        [new("measures", PortType.Table)],
        [new("path", ParamKind.FilePath)],
        "One row per placed mesh of a model file: instanceIndex, meshId, entityId, globalId, "
        + "category, surfaceArea, meshVolume, and triangleCount, computed in world space from "
        + "the mesh triangles. meshVolume is the enclosed volume and is exact only for closed "
        + "meshes with consistent winding; open shells report the absolute signed sum. Join on "
        + "entityId or globalId to bring quantities onto any other table. The loaded geometry "
        + "is cached by file content hash.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => [new TableValue(ModelGeometryCache.Load(new FilePath(parameters.GetText("path"))).ToMeasuresTable())];
}
