using Ara3D.DataTable;
using Ara3D.Geometry;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Per-instance mesh quantities in world space: the measures table
/// (one row per instance, keyed like the instance table) that joins mesh-derived
/// area and volume onto any other table. Computed in double precision from the
/// transformed triangles.</summary>
public static class MeshMeasures
{
    public const string TableName = "measures";
    public const string SurfaceArea = "surfaceArea";
    public const string MeshVolume = "meshVolume";
    public const string TriangleCount = "triangleCount";

    public readonly record struct Measure(double SurfaceArea, double MeshVolume, long TriangleCount);

    /// <summary>Surface area, enclosed volume (the absolute divergence-theorem sum, exact
    /// only for closed meshes with consistent winding), and triangle count of a mesh
    /// under a placement. Both sums are translation-invariant, so the placement's
    /// translation is dropped before the single-precision transform and the points are
    /// re-based on the first one: at site coordinates the raw terms would otherwise be
    /// large enough for rounding to swamp a small element.</summary>
    public static Measure Of(TriangleMesh3D mesh, Matrix4x4 transform)
    {
        var sn = (System.Numerics.Matrix4x4)transform;
        sn.Translation = System.Numerics.Vector3.Zero;
        var world = mesh.Points.Select(p => p.Vector3.Transform(sn)).ToArray();
        var (ox, oy, oz) = world.Length == 0 ? (0.0, 0.0, 0.0) : ((double)world[0].X, (double)world[0].Y, (double)world[0].Z);
        var points = world.Select(v => (v.X - ox, v.Y - oy, v.Z - oz)).ToArray();
        double area = 0, sixVolume = 0;
        foreach (var face in mesh.FaceIndices)
        {
            var (ax, ay, az) = points[face.A];
            var (bx, by, bz) = points[face.B];
            var (cx, cy, cz) = points[face.C];
            var (ux, uy, uz) = (bx - ax, by - ay, bz - az);
            var (vx, vy, vz) = (cx - ax, cy - ay, cz - az);
            var (nx, ny, nz) = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
            area += Math.Sqrt(nx * nx + ny * ny + nz * nz) / 2;
            sixVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
        }
        return new(area, Math.Abs(sixVolume) / 6, mesh.FaceIndices.Count);
    }

    public static IDataTable ToMeasuresTable(this ModelGeometry geometry)
    {
        var n = geometry.Instances.Count;
        var instanceIndex = new long[n];
        var meshId = new long[n];
        var entityId = new long[n];
        var globalId = new string[n];
        var category = new string[n];
        var surfaceArea = new double[n];
        var meshVolume = new double[n];
        var triangleCount = new long[n];
        for (var i = 0; i < n; i++)
        {
            var g = geometry.Instances[i];
            var m = Of(geometry.Meshes[g.MeshId], g.Transform);
            instanceIndex[i] = g.InstanceIndex;
            meshId[i] = g.MeshId;
            entityId[i] = g.EntityId;
            globalId[i] = g.GlobalId;
            category[i] = g.Category;
            surfaceArea[i] = m.SurfaceArea;
            meshVolume[i] = m.MeshVolume;
            triangleCount[i] = m.TriangleCount;
        }
        var builder = new DataTableBuilder(TableName);
        builder.AddColumn(instanceIndex, "instanceIndex");
        builder.AddColumn(meshId, "meshId");
        builder.AddColumn(entityId, "entityId");
        builder.AddColumn(globalId, "globalId");
        builder.AddColumn(category, "category");
        builder.AddColumn(surfaceArea, SurfaceArea);
        builder.AddColumn(meshVolume, MeshVolume);
        builder.AddColumn(triangleCount, TriangleCount);
        return builder.Build();
    }
}
