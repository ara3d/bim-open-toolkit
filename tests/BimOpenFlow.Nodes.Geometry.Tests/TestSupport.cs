using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry.Tests;

internal sealed class TestEvalContext : IEvalContext
{
    public bool IsRun => false;
    public CancellationToken Cancellation => CancellationToken.None;
    public List<string> Warnings { get; } = [];
    public void Warn(string message) => Warnings.Add(message);
}

internal static class TestSupport
{
    public static ParamValues Params(params (string Name, string Value)[] values)
        => new(values.ToDictionary(v => v.Name, v => v.Value));

    public static IDataTable Instances(params long[] entityIds)
    {
        var builder = new DataTableBuilder("instances");
        builder.AddColumn(Enumerable.Range(0, entityIds.Length).Select(i => (long)i).ToArray(), "instanceIndex");
        builder.AddColumn(entityIds, "entityId");
        return builder.Build();
    }

    public static IDataTable Table(string name, params (string Name, Array Values)[] columns)
    {
        var builder = new DataTableBuilder(name);
        foreach (var (colName, values) in columns)
            builder.AddColumn(values, colName, values.GetType().GetElementType()!);
        return builder.Build();
    }

    public static IReadOnlyList<string> ColumnNames(IDataTable table)
        => table.Columns.Select(c => c.Descriptor.Name).ToList();

    public static (double R, double G, double B, double A) RowColor(IDataTable table, int row)
        => ((double)Cell(table, "r", row), (double)Cell(table, "g", row),
            (double)Cell(table, "b", row), (double)Cell(table, "a", row));

    public static object Cell(IDataTable table, string column, int row)
        => table[ColumnNames(table).ToList().FindIndex(n => n == column), row];

    public static IDataTable OutputTable(IFlowNode node, IReadOnlyList<FlowValue> inputs, ParamValues parameters, IEvalContext? context = null)
        => ((TableValue)node.Eval(context ?? new TestEvalContext(), inputs, parameters)[0]).Table;
}
