using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Rasterizes instance bounding boxes onto a uniform grid and emits one boxes
/// row per occupied voxel: minX..maxZ, count (instances whose AABB overlaps
/// the voxel), and voxelId ("x,y,z" cell indices — a join key for coloring).
/// Occupancy is an AABB approximation, not triangle-accurate. When the grid
/// over the model bounds would exceed MaxVoxels, the size is coarsened to fit
/// and a warning is emitted.
/// </summary>
public sealed class VoxelizeNode : IFlowNode
{
    public const long MaxVoxels = 2_000_000;

    public NodeSpec Spec { get; } = new(
        "view3d.voxelize", 1, NodeCapability.Pure,
        [new("instances", PortType.Table)],
        [new("boxes", PortType.Table)],
        [new("size", ParamKind.Number, "1")],
        "Emits the occupied voxels of the instances' bounding boxes as a boxes table with per-voxel counts.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException();
}
