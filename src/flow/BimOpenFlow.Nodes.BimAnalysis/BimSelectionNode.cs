using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.Support;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The elements a person picked in the 3D pane, as a one-column GlobalId table.</summary>
public sealed class BimSelectionNode : IFlowNode
{
    public const string Kind = "bim.selection";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("ids", PortType.Table)],
        Params: [new ParamSpec("ids", ParamKind.Text, List: true)],
        "The elements picked in the 3D pane, as a table with one column, GlobalId, and one row per "
        + "distinct id in the order given. The 3D pane's 'Use selection' button adds this node "
        + "(or updates the one it added) holding the current selection; 'ids' is the comma-separated "
        + "GlobalIds, and may be typed by hand. Wire the table into a join or filter on GlobalId "
        + "(table.filter, table.aggregate), into view3d.isolate or view3d.color, or into bcf.issue. "
        + "Blank entries are dropped; with no ids the table has no rows.",
        Schemas: [KindSchemas.Static("ids", ColumnKinds.GlobalId.NotNull())]);

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var ids = parameters.GetText("ids").SplitNames().Distinct().Cast<object?>().ToArray();
        var b = new DataTableBuilder("ids");
        b.AddColumn(ids, BimColumns.GlobalId, typeof(string));
        return [new TableValue(b.Build())];
    }
}
