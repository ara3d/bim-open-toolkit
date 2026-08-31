using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Bos.Tests;

internal sealed class FakeEvalContext : IEvalContext
{
    public bool IsRun => false;
    public CancellationToken Cancellation => CancellationToken.None;
    public List<string> Warnings { get; } = [];
    public void Warn(string message) => Warnings.Add(message);
}

internal static class NodeTestHelpers
{
    public static readonly IEvalContext Ctx = new FakeEvalContext();

    public static ParamValues Params(params (string Name, string Value)[] ps)
        => new(ps.ToDictionary(p => p.Name, p => p.Value));

    public static IReadOnlyList<FlowValue> Eval(this IFlowNode node, IDataTable? input,
        params (string Name, string Value)[] ps)
        => node.Eval(Ctx, input == null ? [] : [new TableValue(input)], Params(ps));

    public static IDataTable EvalTable(this IFlowNode node, IDataTable? input,
        params (string Name, string Value)[] ps)
        => ((TableValue)node.Eval(input, ps)[0]).Table;

    /// <summary>Four rows with a null Name (row 3) and a null Height (row 1).</summary>
    public static IDataTable SampleTable()
    {
        var builder = new DataTableBuilder("sample");
        builder.AddColumn(new object?[] { "Wall-1", "Wall-2", "Door-1", null }, "Name", typeof(string));
        builder.AddColumn(new object?[] { 2.5, null, 2.1, 3.0 }, "Height", typeof(double));
        builder.AddColumn(new object?[] { 1L, 2L, 3L, 4L }, "Count", typeof(long));
        builder.AddColumn(new object?[] { "Walls", "Walls", "Doors", "Doors" }, "Category", typeof(string));
        return builder.Build();
    }

    public static object? Cell(this IDataTable table, string column, int row)
        => table[table.Columns.Single(c => c.Descriptor.Name == column).ColumnIndex, row];

    public static IReadOnlyList<string> ColumnNames(this IDataTable table)
        => table.Columns.Select(c => c.Descriptor.Name).ToList();
}
