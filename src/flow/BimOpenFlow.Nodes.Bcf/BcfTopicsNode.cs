using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Bcf;

/// <summary>bcf.topics: the topics bcf.write would write, as a table, so a person can see them
/// on the canvas before Run.</summary>
public sealed class BcfTopicsNode : IFlowNode
{
    public const string Kind = "bcf.topics";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("issues", PortType.Table)],
        Outputs: [new PortSpec("topics", PortType.Table)],
        Params: [BcfIssues.PresetSpec, BcfIssues.VerdictsSpec],
        "Groups an issue or verdict table into the BCF topics bcf.write would write (one per distinct "
        + "title: Title, Description, Status, Priority, Type, Elements, GlobalIds), so the file's contents "
        + "can be checked before Run. " + BcfIssues.ParamsDescription,
        Schemas: [BcfIssues.TopicsSchema("topics")]);

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var (issues, rows) = BcfIssues.From(inputs.TableInput(0, Kind), parameters, Kind);
        if (rows == 0)
            context.Warn($"{Kind}: no rows left after the verdict filter; the BCF would be empty");
        return [new TableValue(BcfIssues.TopicsTable(issues, "topics"))];
    }
}
