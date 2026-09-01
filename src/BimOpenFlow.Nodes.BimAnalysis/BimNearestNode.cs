using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Nearest-neighbour join: for each row of a, the key of the closest row of b
/// by Euclidean distance between the two coordinate triples, plus the distance.</summary>
public sealed class BimNearestNode : IFlowNode
{
    public const string Kind = "bim.nearest";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs:
        [
            new PortSpec("a", PortType.Table),
            new PortSpec("b", PortType.Table),
        ],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("x", ParamKind.Text, BimColumns.CenterX, Suggest: SuggestSource.ColumnsOf("a")),
            new ParamSpec("y", ParamKind.Text, BimColumns.CenterY, Suggest: SuggestSource.ColumnsOf("a")),
            new ParamSpec("z", ParamKind.Text, BimColumns.CenterZ, Suggest: SuggestSource.ColumnsOf("a")),
            new ParamSpec("bx", ParamKind.Text, BimColumns.CenterX, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("by", ParamKind.Text, BimColumns.CenterY, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("bz", ParamKind.Text, BimColumns.CenterZ, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("key", ParamKind.Text, BimColumns.Name, Suggest: SuggestSource.ColumnsOf("b")),
            new ParamSpec("as", ParamKind.Text, "Nearest"),
        ],
        "Adds two columns to a: 'as' (default Nearest) holding the 'key' of the closest b row by "
        + "3D distance between (x,y,z) and (bx,by,bz), and Distance holding that distance. Rows "
        + "with null coordinates, or when b is empty, get nulls. Typical use: distance from each "
        + "room center to the nearest exit door.");

    // TODO: ParamOr/Numeric/CopyColumns are duplicated in BimContainmentNode; promote to
    // BimOpenFlow.Nodes.Support once the fence allows a shared edit.
    private static string ParamOr(ParamValues parameters, string name, string @default)
        => parameters.GetText(name) is { } t && !string.IsNullOrWhiteSpace(t) ? t : @default;

    private static double? Numeric(object? cell)
        => cell switch
        {
            null or DBNull => null,
            double d => d,
            float f => f,
            long l => l,
            int i => i,
            short s => s,
            byte b => b,
            decimal m => (double)m,
            _ => null,
        };

    private static DataTableBuilder CopyColumns(IDataTable table)
    {
        var rows = table.RowCount();
        var builder = new DataTableBuilder(table.Name);
        foreach (var c in table.Columns)
        {
            var cells = new object?[rows];
            for (var row = 0; row < rows; row++)
                cells[row] = table[c.ColumnIndex, row];
            builder.AddColumn(cells, c.Descriptor.Name, c.Descriptor.Type);
        }
        return builder;
    }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var a = inputs.TableInput(0, Kind);
        var b = inputs.TableInput(1, Kind);
        var xi = a.RequireColumn(ParamOr(parameters, "x", BimColumns.CenterX), Kind);
        var yi = a.RequireColumn(ParamOr(parameters, "y", BimColumns.CenterY), Kind);
        var zi = a.RequireColumn(ParamOr(parameters, "z", BimColumns.CenterZ), Kind);
        var bxi = b.RequireColumn(ParamOr(parameters, "bx", BimColumns.CenterX), Kind);
        var byi = b.RequireColumn(ParamOr(parameters, "by", BimColumns.CenterY), Kind);
        var bzi = b.RequireColumn(ParamOr(parameters, "bz", BimColumns.CenterZ), Kind);
        var keyIndex = b.RequireColumn(ParamOr(parameters, "key", BimColumns.Name), Kind);
        var asName = ParamOr(parameters, "as", "Nearest");
        foreach (var name in new[] { asName, BimColumns.Distance })
            if (a.ColumnIndex(name) >= 0)
                throw new ArgumentException($"{Kind}: table a already has a column named '{name}'.");

        var candidates = Enumerable.Range(0, b.RowCount())
            .Select(row => (
                Key: TableColumns.CellText(b[keyIndex, row]),
                X: Numeric(b[bxi, row]), Y: Numeric(b[byi, row]), Z: Numeric(b[bzi, row])))
            .Where(r => r.X != null && r.Y != null && r.Z != null)
            .Select(r => (r.Key, X: r.X!.Value, Y: r.Y!.Value, Z: r.Z!.Value))
            .ToList();

        (string? Key, double? Distance) Nearest(int row)
        {
            var x = Numeric(a[xi, row]);
            var y = Numeric(a[yi, row]);
            var z = Numeric(a[zi, row]);
            if (x == null || y == null || z == null || candidates.Count == 0)
                return (null, null);
            var best = candidates
                .Select(c => (c.Key, Distance: Math.Sqrt(
                    (c.X - x.Value) * (c.X - x.Value)
                    + (c.Y - y.Value) * (c.Y - y.Value)
                    + (c.Z - z.Value) * (c.Z - z.Value))))
                .OrderBy(c => c.Distance)
                .First();
            return (best.Key, best.Distance);
        }

        var rows = a.RowCount();
        var nearest = Enumerable.Range(0, rows).Select(Nearest).ToList();
        var builder = CopyColumns(a);
        builder.AddColumn(nearest.Select(n => (object?)n.Key).ToArray(), asName, typeof(string));
        builder.AddColumn(nearest.Select(n => (object?)n.Distance).ToArray(),
            BimColumns.Distance, typeof(double));
        return [new TableValue(builder.Build())];
    }
}
