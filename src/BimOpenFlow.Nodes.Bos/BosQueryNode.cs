using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Bos;

/// <summary>Runs one read-only SQL query over the input table, which is loaded into an
/// in-memory DuckDB as table "t". Named bos.* because the DuckDB dependency lives in this pack.</summary>
public sealed class BosQueryNode : IFlowNode
{
    public const string Kind = "bos.query";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("table", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec("sql", ParamKind.Text)],
        "Runs one read-only SQL query over the input table, available as 't'.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => [new TableValue(inputs.TableInput(0, Kind)
            .QueryOver(parameters.RequiredText("sql", Kind), "query"))];
}
