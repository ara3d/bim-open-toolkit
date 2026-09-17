using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.DataModel;

internal sealed record GeometryConversionResult(ImmutableArray<InstanceRow> Instances,
    ImmutableArray<GeometryRow> Geometry, ImmutableArray<IssueRow> Issues);

internal static class GeometryConversion
{
    internal static GeometryConversionResult Convert(BimGeometry? geometry, int entityCount)
    {
        if (geometry is null) return new([], [], []);
        var issues = new List<IssueRow>();
        var instances = ImmutableArray.CreateBuilder<InstanceRow>();
        var entities = new Dictionary<int, GeometryRow>();
        var cache = new Dictionary<(int Mesh, int Transform), Bounds3?>();
        var g = geometry;
        if (g.InstanceEntityIndex is null || g.InstanceMeshIndex is null || g.InstanceTransformIndex is null ||
            g.InstanceFlags is null || g.InstanceMaterialIndex is null || g.VertexX is null || g.VertexY is null ||
            g.VertexZ is null || g.IndexBuffer is null || g.MeshVertexOffset is null || g.MeshIndexOffset is null ||
            g.TransformTX is null || g.TransformTY is null || g.TransformTZ is null || g.TransformQX is null ||
            g.TransformQY is null || g.TransformQZ is null || g.TransformQW is null || g.TransformSX is null || g.TransformSY is null || g.TransformSZ is null)
            return new([], [], [new(0, IssueSeverity.Error, "MissingGeometryColumn", "Geometry", -1, null, "Geometry columns must be arrays, not null.")]);
        var validMeshes = ValidateMeshes(g, issues);
        for (var i = 0; i < g.InstanceEntityIndex.Length; i++)
        {
            var entity = g.InstanceEntityIndex[i];
            if (entity < 0 || entity >= entityCount || i >= g.InstanceMeshIndex.Length || i >= g.InstanceTransformIndex.Length)
            {
                SourceDecoder.AddIssue(issues, "InvalidGeometryInstance", "Instances", i, null, "Missing instance columns or invalid entity reference.");
                continue;
            }
            var mesh = g.InstanceMeshIndex[i];
            var transform = g.InstanceTransformIndex[i];
            if (mesh < 0 || mesh >= validMeshes.Length || !validMeshes[mesh])
            {
                SourceDecoder.AddIssue(issues, "InvalidMeshReference", "Instances", i, entity, $"Mesh {mesh} is absent or malformed.");
                continue;
            }
            if (!cache.TryGetValue((mesh, transform), out var bounds))
            {
                bounds = TransformBounds(g, mesh, transform);
                cache.Add((mesh, transform), bounds);
            }
            if (bounds is null)
            {
                SourceDecoder.AddIssue(issues, "InvalidTransform", "Instances", i, entity, $"Transform {transform} is absent, nonfinite, or has an invalid quaternion.");
                continue;
            }
            var triangles = (End(g.MeshIndexOffset, mesh, g.IndexBuffer.Length) - g.MeshIndexOffset[mesh]) / 3;
            var hidden = i < g.InstanceFlags.Length && (g.InstanceFlags[i] & 1) != 0;
            int? material = i < g.InstanceMaterialIndex.Length && g.InstanceMaterialIndex[i] >= 0 ? g.InstanceMaterialIndex[i] : null;
            instances.Add(new(i, entity, mesh, material, hidden, bounds.Value, triangles));
            if (entities.TryGetValue(entity, out var previous))
                entities[entity] = new(entity, previous.Bounds.Union(bounds.Value), previous.InstanceCount + 1,
                    previous.TriangleCount + triangles, previous.HiddenInstanceCount + (hidden ? 1 : 0));
            else entities.Add(entity, new(entity, bounds.Value, 1, triangles, hidden ? 1 : 0));
        }
        return new(instances.ToImmutable(), entities.Values.OrderBy(e => e.EntityId).ToImmutableArray(), issues.ToImmutableArray());
    }

    private static int End(int[] offsets, int index, int total)
        => index + 1 < offsets.Length ? offsets[index + 1] : total;

    private static bool[] ValidateMeshes(BimGeometry g, List<IssueRow> issues)
    {
        var valid = new bool[g.MeshVertexOffset.Length];
        for (var mesh = 0; mesh < valid.Length; mesh++)
        {
            var start = g.MeshVertexOffset[mesh];
            var end = End(g.MeshVertexOffset, mesh, g.VertexX.Length);
            var ok = start >= 0 && end > start && end <= g.VertexX.Length && end <= g.VertexY.Length && end <= g.VertexZ.Length && mesh < g.MeshIndexOffset.Length;
            if (ok)
            {
                var indexStart = g.MeshIndexOffset[mesh];
                var indexEnd = End(g.MeshIndexOffset, mesh, g.IndexBuffer.Length);
                ok = indexStart >= 0 && indexEnd >= indexStart && indexEnd <= g.IndexBuffer.Length && (indexEnd - indexStart) % 3 == 0;
                for (var j = indexStart; ok && j < indexEnd; j++) ok = g.IndexBuffer[j] >= 0 && g.IndexBuffer[j] < end - start;
            }
            valid[mesh] = ok;
            if (!ok) SourceDecoder.AddIssue(issues, "InvalidMesh", "Meshes", mesh, null, "Mesh offsets, vertices or triangle indices are malformed.");
        }
        return valid;
    }

    private static Bounds3? TransformBounds(BimGeometry g, int mesh, int t)
    {
        var columns = new[] { g.TransformTX, g.TransformTY, g.TransformTZ, g.TransformQX, g.TransformQY,
            g.TransformQZ, g.TransformQW, g.TransformSX, g.TransformSY, g.TransformSZ };
        foreach (var column in columns) if (t < 0 || t >= column.Length || !float.IsFinite(column[t])) return null;
        var x = (double)g.TransformQX[t]; var y = (double)g.TransformQY[t];
        var z = (double)g.TransformQZ[t]; var w = (double)g.TransformQW[t];
        var norm = x * x + y * y + z * z + w * w;
        if (Math.Abs(norm - 1) > 0.001) return null;
        Bounds3? bounds = null;
        for (var i = g.MeshVertexOffset[mesh]; i < End(g.MeshVertexOffset, mesh, g.VertexX.Length); i++)
        {
            var vx = g.VertexX[i] / 10000.0 * g.TransformSX[t];
            var vy = g.VertexY[i] / 10000.0 * g.TransformSY[t];
            var vz = g.VertexZ[i] / 10000.0 * g.TransformSZ[t];
            var point = new Point3(vx * (1 - 2 * (y * y + z * z)) + vy * 2 * (x * y - z * w) + vz * 2 * (x * z + y * w) + g.TransformTX[t],
                vx * 2 * (x * y + z * w) + vy * (1 - 2 * (x * x + z * z)) + vz * 2 * (y * z - x * w) + g.TransformTY[t],
                vx * 2 * (x * z - y * w) + vy * 2 * (y * z + x * w) + vz * (1 - 2 * (x * x + y * y)) + g.TransformTZ[t]);
            if (!point.IsFinite) return null;
            var single = new Bounds3(point, point);
            bounds = bounds?.Union(single) ?? single;
        }
        return bounds;
    }
}
