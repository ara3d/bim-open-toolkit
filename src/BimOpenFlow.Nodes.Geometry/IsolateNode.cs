using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Filters an instance table to rows whose join column matches any id in the ids table.
/// The ids table uses its column of the same name, or its first column when absent.
/// </summary>
public sealed class IsolateNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.isolate", 1, NodeCapability.Pure,
        [new("instances", PortType.Table), new("ids", PortType.Table)],
        [new("instances", PortType.Table)],
        [new("joinColumn", ParamKind.Text)],
        "Keeps only the instance rows whose join column value appears in the ids table.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var instances = ((TableValue)inputs[0]).Table;
        var ids = ((TableValue)inputs[1]).Table;
        var joinName = parameters.GetText("joinColumn");
        var instJoin = instances.RequireColumn(joinName);
        var keys = ids.IdKeys(joinName);

        var rows = new List<int>();
        for (var i = 0; i < instances.RowCount(); i++)
            if (TableOps.CanonicalText(instances[instJoin, i]) is { } key && keys.Contains(key))
                rows.Add(i);

        return [new TableValue(instances.SelectRows(rows, instances.Name))];
    }
}
