using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Data-quality profile of a long parameter table: how often each parameter
/// occurs, how many distinct values it takes, and its fill rate across entities.</summary>
public sealed class BimParamCoverageNode : IFlowNode
{
    public const string Kind = "bim.paramCoverage";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("parameters", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [],
        "Profiles a long parameter table (the bos.load parameters output: EntityIndex, Name, "
        + "ParameterGroup, Units, ValueType, Value) into one row per parameter name: "
        + "Name, ParameterGroup, ValueType, Count, Distinct, FillRate (share of the input's "
        + "distinct entities that carry the parameter), ordered by Count descending.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track PAR");
}
