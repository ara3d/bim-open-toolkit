using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Sets the per-instance alpha column `a` (adding it, default 1, when absent).
/// Without an ids table every row gets the alpha. With one, rows whose join
/// column matches (scope "matched") or does not match (scope "others") get the
/// alpha; the rest keep their current value. The 3D pane honors `a` on its own:
/// 0 hides, values between 0 and 1 fade.
/// </summary>
public sealed class OpacityNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.opacity", 1, NodeCapability.Pure,
        [new("instances", PortType.Table), new("ids", PortType.Table, Optional: true)],
        [new("instances", PortType.Table)],
        [
            new("alpha", ParamKind.Number, "0.25"),
            new("joinColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances")),
            new("scope", ParamKind.Enum, "matched", ["matched", "others"]),
        ],
        "Sets the alpha column of an instance table, for all rows or for rows matched against an ids table.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var alpha = parameters.GetNumber("alpha", 0.25);
        var assigned = AssignedRows(instances, inputs[1], parameters);

        var aCol = instances.ColumnIndex("a");
        var n = instances.RowCount();
        var a = new double[n];
        for (var i = 0; i < n; i++)
            a[i] = assigned[i] ? alpha
                : aCol >= 0 ? TableOps.CellNumber(instances[aCol, i]) ?? 1
                : 1;

        return [new TableValue(WithColumn(instances, "a", a, aCol))];
    }

    /// <summary>Rebuilds the table with the named column's data replaced in place
    /// (index >= 0) or appended at the end (index &lt; 0).</summary>
    private static IDataTable WithColumn(IDataTable table, string name, double[] data, int index)
    {
        var builder = new DataTableBuilder(table.Name);
        for (var i = 0; i < table.Columns.Count; i++)
            if (i == index)
                builder.AddColumn(data, name);
            else
                builder.AddColumn(table.Columns[i].ToTypedArray(), table.Columns[i].Descriptor.Name, table.Columns[i].Descriptor.Type);
        if (index < 0)
            builder.AddColumn(data, name);
        return builder.Build();
    }

    /// <summary>Per-row flags for rows that receive the alpha param: all rows without an
    /// ids table, otherwise the rows matched (or not matched, scope "others") against it.</summary>
    private static bool[] AssignedRows(IDataTable instances, FlowValue idsValue, ParamValues parameters)
    {
        var n = instances.RowCount();
        var assigned = new bool[n];
        if (idsValue is not TableValue idsTable)
        {
            Array.Fill(assigned, true);
            return assigned;
        }

        var ids = idsTable.Table;
        var joinName = parameters.GetText("joinColumn");
        var instJoin = instances.RequireColumn(joinName);
        var others = parameters.GetText("scope", "matched") == "others";
        var keys = ids.IdKeys(joinName);

        for (var i = 0; i < n; i++)
        {
            var matched = TableOps.CanonicalText(instances[instJoin, i]) is { } key && keys.Contains(key);
            assigned[i] = matched != others;
        }
        return assigned;
    }
}
