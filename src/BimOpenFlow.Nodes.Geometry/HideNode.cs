using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Removes the instance rows whose join column matches any id in the ids table
/// (the inverse of view3d.isolate). The ids table uses its column of the same
/// name, or its first column when absent.
/// </summary>
public sealed class HideNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.hide", 1, NodeCapability.Pure,
        [new("instances", PortType.Table), new("ids", PortType.Table)],
        [new("instances", PortType.Table)],
        [new("joinColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances"))],
        "Removes the instance rows whose join column value appears in the ids table.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var ids = ((TableValue)inputs[1]).Table;
        var joinName = parameters.GetText("joinColumn");
        var instJoin = instances.RequireColumn(joinName);
        var idsJoin = ids.ColumnIndex(joinName) is var found && found >= 0 ? found : 0;

        var keys = new HashSet<string>();
        if (ids.Columns.Count > 0)
            for (var i = 0; i < ids.RowCount(); i++)
                if (TableOps.CanonicalText(ids[idsJoin, i]) is { } key)
                    keys.Add(key);

        var rows = new List<int>();
        for (var i = 0; i < instances.RowCount(); i++)
            if (TableOps.CanonicalText(instances[instJoin, i]) is not { } key || !keys.Contains(key))
                rows.Add(i);

        return [new TableValue(instances.SelectRows(rows, instances.Name))];
    }
}
