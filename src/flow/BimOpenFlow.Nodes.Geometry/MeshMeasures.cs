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
    /// under a placement.</summary>
    public static Measure Of(TriangleMesh3D mesh, Matrix4x4 transform)
    {
        var points = mesh.Points.Select(p => p.Vector3.Transform(transform))
            .Select(v => ((double)v.X, (double)v.Y, (double)v.Z)).ToArray();
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
