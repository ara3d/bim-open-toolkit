using Ara3D.Geometry;
using Ara3D.Ifc.Mesher.Approach1;
using Ara3D.IfcLoader;
using Ara3D.Models;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>One renderable occurrence of a mesh: transform, world bounds, and the IFC entity it came from.</summary>
public sealed record GeometryInstance(
    int InstanceIndex,
    int MeshId,
    Matrix4x4 Transform,
    int EntityId,
    string GlobalId,
    string Category,
    Bounds3D Bounds);

/// <summary>
/// Renderable geometry extracted from a model file: meshes addressed by meshId
/// (their index) and the instances that place them. The host serves this to the
/// viewer; nodes only see the instance table derived from it.
/// </summary>
public sealed class ModelGeometry
{
    public IReadOnlyList<TriangleMesh3D> Meshes { get; }
    public IReadOnlyList<GeometryInstance> Instances { get; }

    public ModelGeometry(IReadOnlyList<TriangleMesh3D> meshes, IReadOnlyList<GeometryInstance> instances)
    {
        Meshes = meshes;
        Instances = instances;
    }

    public static ModelGeometry Load(FilePath path)
    {
        using var file = new IfcFile(path, includeGeometry: false);
        var result = new Approach1Mesher().Build(file);
        if (result.Model is null)
            throw new InvalidOperationException(
                $"Meshing failed for {path}: {string.Join("; ", result.Errors)}");
        return FromModel(result.Model, file);
    }

    /// <summary>Adapts a meshed model: drops mesh-less instances and resolves each instance's IFC entity.</summary>
    public static ModelGeometry FromModel(Model3D model, IfcFile file)
    {
        var localBounds = new Bounds3D?[model.Meshes.Count];
        var instances = new List<GeometryInstance>();
        foreach (var inst in model.Instances)
        {
            if (inst.MeshIndex < 0 || inst.MeshIndex >= model.Meshes.Count)
                continue;
            var mesh = model.Meshes[inst.MeshIndex];
            if (mesh.Points.Count == 0)
                continue;
            var entity = file.EntityResolver.GetEntityOrDefault(inst.EntityIndex);
            var bounds = localBounds[inst.MeshIndex] ??= mesh.Points.Bounds();
            instances.Add(new GeometryInstance(
                instances.Count,
                inst.MeshIndex,
                inst.Matrix4x4,
                inst.EntityIndex,
                entity?.GetIfcRootGlobalId() ?? "",
                entity?.GetEntityName() ?? "",
                TransformBounds(bounds, inst.Matrix4x4)));
        }
        return new ModelGeometry(model.Meshes, instances);
    }

    /// <summary>World-space bounds of local bounds under a transform (bounds of the 8 transformed corners).</summary>
    public static Bounds3D TransformBounds(Bounds3D local, Matrix4x4 matrix)
    {
        float minX = float.MaxValue, minY = float.MaxValue, minZ = float.MaxValue;
        float maxX = float.MinValue, maxY = float.MinValue, maxZ = float.MinValue;
        foreach (var corner in local.Corners)
        {
            var v = corner.Vector3.Transform(matrix);
            minX = Math.Min(minX, v.X); minY = Math.Min(minY, v.Y); minZ = Math.Min(minZ, v.Z);
            maxX = Math.Max(maxX, v.X); maxY = Math.Max(maxY, v.Y); maxZ = Math.Max(maxZ, v.Z);
        }
        return new Bounds3D(new Point3D(minX, minY, minZ), new Point3D(maxX, maxY, maxZ));
    }
}
