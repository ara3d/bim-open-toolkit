using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Builds the boxes table (column conventions documented in README.md)
/// shared by view3d.boundingBoxes and view3d.voxelize.</summary>
internal static class BoxTables
{
    public const string TableName = "boxes";

    public static IDataTable Build(
        double[] minX, double[] minY, double[] minZ,
        double[] maxX, double[] maxY, double[] maxZ,
        double[]? r = null, double[]? g = null, double[]? b = null, double[]? a = null,
        string[]? label = null, long[]? count = null, string[]? voxelId = null)
    {
        var builder = new DataTableBuilder(TableName);
        builder.AddColumn(minX, "minX");
        builder.AddColumn(minY, "minY");
        builder.AddColumn(minZ, "minZ");
        builder.AddColumn(maxX, "maxX");
        builder.AddColumn(maxY, "maxY");
        builder.AddColumn(maxZ, "maxZ");
        if (r != null && g != null && b != null && a != null)
        {
            builder.AddColumn(r, "r");
            builder.AddColumn(g, "g");
            builder.AddColumn(b, "b");
            builder.AddColumn(a, "a");
        }
        if (label != null)
            builder.AddColumn(label, "label");
        if (count != null)
            builder.AddColumn(count, "count");
        if (voxelId != null)
            builder.AddColumn(voxelId, "voxelId");
        return builder.Build();
    }
}
