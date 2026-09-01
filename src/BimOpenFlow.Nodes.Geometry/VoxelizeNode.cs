using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

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
    {
        var instances = ((TableValue)inputs[0]).Table;
        var size = parameters.GetNumber("size", 1);
        if (size <= 0)
            throw new ArgumentException($"size must be > 0, got {size}");

        var cols = new[]
        {
            instances.RequireColumn("minX"), instances.RequireColumn("minY"), instances.RequireColumn("minZ"),
            instances.RequireColumn("maxX"), instances.RequireColumn("maxY"), instances.RequireColumn("maxZ"),
        };
        var n = instances.RowCount();
        if (n == 0)
            return [new TableValue(BoxTables.Build([], [], [], [], [], [], count: [], voxelId: []))];

        var aabbs = new double[6][];
        for (var c = 0; c < 6; c++)
        {
            aabbs[c] = new double[n];
            for (var i = 0; i < n; i++)
                aabbs[c][i] = TableOps.CellNumber(instances[cols[c], i]) ?? 0;
        }

        var union = UnionBounds(aabbs, n);
        foreach (var value in union)
            if (!double.IsFinite(value))
                throw new ArgumentException("instance bounds contain non-finite values");
        var adjusted = FitSize(union, size);
        if (adjusted > size)
            context.Warn($"size {size} would exceed {MaxVoxels} voxels over the model bounds; using {adjusted}");
        size = adjusted;

        var counts = FillCells(aabbs, n, union, size, CellCounts(union, size));
        return [new TableValue(ToBoxesTable(counts, union, size))];
    }

    private static double[] UnionBounds(double[][] aabbs, int n)
    {
        var union = new[]
        {
            double.MaxValue, double.MaxValue, double.MaxValue,
            double.MinValue, double.MinValue, double.MinValue,
        };
        for (var i = 0; i < n; i++)
            for (var axis = 0; axis < 3; axis++)
            {
                union[axis] = Math.Min(union[axis], aabbs[axis][i]);
                union[axis + 3] = Math.Max(union[axis + 3], aabbs[axis + 3][i]);
            }
        return union;
    }

    private static double CellsPerAxis(double extent, double size)
        => Math.Max(1, Math.Ceiling(extent / size));

    private static double TotalCells(double[] union, double size)
        => CellsPerAxis(union[3] - union[0], size)
         * CellsPerAxis(union[4] - union[1], size)
         * CellsPerAxis(union[5] - union[2], size);

    /// <summary>Doubles the cell size until the grid over the union bounds fits within MaxVoxels.</summary>
    private static double FitSize(double[] union, double size)
    {
        while (TotalCells(union, size) > MaxVoxels)
            size *= 2;
        return size;
    }

    private static (int X, int Y, int Z) CellCounts(double[] union, double size)
        => ((int)CellsPerAxis(union[3] - union[0], size),
            (int)CellsPerAxis(union[4] - union[1], size),
            (int)CellsPerAxis(union[5] - union[2], size));

    /// <summary>Marks every cell overlapped by each instance AABB (clamped index ranges;
    /// degenerate extents occupy their containing cell) and counts instances per cell.</summary>
    private static Dictionary<(int, int, int), int> FillCells(
        double[][] aabbs, int n, double[] union, double size, (int X, int Y, int Z) cells)
    {
        var counts = new Dictionary<(int, int, int), int>();
        for (var i = 0; i < n; i++)
        {
            var x0 = CellIndex(aabbs[0][i], union[0], size, cells.X);
            var y0 = CellIndex(aabbs[1][i], union[1], size, cells.Y);
            var z0 = CellIndex(aabbs[2][i], union[2], size, cells.Z);
            var x1 = CellIndex(aabbs[3][i], union[0], size, cells.X);
            var y1 = CellIndex(aabbs[4][i], union[1], size, cells.Y);
            var z1 = CellIndex(aabbs[5][i], union[2], size, cells.Z);
            for (var z = z0; z <= z1; z++)
                for (var y = y0; y <= y1; y++)
                    for (var x = x0; x <= x1; x++)
                    {
                        counts.TryGetValue((x, y, z), out var c);
                        counts[(x, y, z)] = c + 1;
                    }
        }
        return counts;
    }

    private static int CellIndex(double value, double origin, double size, int cells)
        => Math.Clamp((int)Math.Floor((value - origin) / size), 0, cells - 1);

    private static IDataTable ToBoxesTable(Dictionary<(int, int, int), int> cellCounts, double[] union, double size)
    {
        var keys = new List<(int X, int Y, int Z)>(cellCounts.Count);
        foreach (var key in cellCounts.Keys)
            keys.Add(key);
        keys.Sort((p, q) => p.Z != q.Z ? p.Z.CompareTo(q.Z) : p.Y != q.Y ? p.Y.CompareTo(q.Y) : p.X.CompareTo(q.X));

        var m = keys.Count;
        var minX = new double[m]; var minY = new double[m]; var minZ = new double[m];
        var maxX = new double[m]; var maxY = new double[m]; var maxZ = new double[m];
        var count = new long[m];
        var voxelId = new string[m];
        for (var i = 0; i < m; i++)
        {
            var (x, y, z) = keys[i];
            minX[i] = union[0] + x * size; maxX[i] = union[0] + (x + 1) * size;
            minY[i] = union[1] + y * size; maxY[i] = union[1] + (y + 1) * size;
            minZ[i] = union[2] + z * size; maxZ[i] = union[2] + (z + 1) * size;
            count[i] = cellCounts[keys[i]];
            voxelId[i] = $"{x},{y},{z}";
        }
        return BoxTables.Build(minX, minY, minZ, maxX, maxY, maxZ, count: count, voxelId: voxelId);
    }
}
