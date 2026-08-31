using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Builds the canonical instance table (column conventions documented in README.md).</summary>
public static class InstanceTables
{
    public const string TableName = "instances";

    public static IDataTable ToInstanceTable(this ModelGeometry geometry)
    {
        var n = geometry.Instances.Count;
        var instanceIndex = new long[n];
        var meshId = new long[n];
        var entityId = new long[n];
        var globalId = new string[n];
        var category = new string[n];
        var minX = new double[n]; var minY = new double[n]; var minZ = new double[n];
        var maxX = new double[n]; var maxY = new double[n]; var maxZ = new double[n];

        for (var i = 0; i < n; i++)
        {
            var g = geometry.Instances[i];
            instanceIndex[i] = g.InstanceIndex;
            meshId[i] = g.MeshId;
            entityId[i] = g.EntityId;
            globalId[i] = g.GlobalId;
            category[i] = g.Category;
            minX[i] = g.Bounds.Min.X; minY[i] = g.Bounds.Min.Y; minZ[i] = g.Bounds.Min.Z;
            maxX[i] = g.Bounds.Max.X; maxY[i] = g.Bounds.Max.Y; maxZ[i] = g.Bounds.Max.Z;
        }

        var builder = new DataTableBuilder(TableName);
        builder.AddColumn(instanceIndex, "instanceIndex");
        builder.AddColumn(meshId, "meshId");
        builder.AddColumn(entityId, "entityId");
        builder.AddColumn(globalId, "globalId");
        builder.AddColumn(category, "category");
        builder.AddColumn(minX, "minX");
        builder.AddColumn(minY, "minY");
        builder.AddColumn(minZ, "minZ");
        builder.AddColumn(maxX, "maxX");
        builder.AddColumn(maxY, "maxY");
        builder.AddColumn(maxZ, "maxZ");
        return builder.Build();
    }
}
