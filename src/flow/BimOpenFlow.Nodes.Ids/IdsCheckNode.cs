using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Ids;

namespace BimOpenFlow.Nodes.Ids;

/// <summary>ids.check: evaluates an IDS file over the entity and parameter tables and emits the
/// standard verdict table plus one summary row per specification.</summary>
public sealed class IdsCheckNode : IFlowNode
{
    public const string Kind = "ids.check";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs:
        [
            new PortSpec("entities", PortType.Table),
            new PortSpec("parameters", PortType.Table),
        ],
        Outputs:
        [
            new PortSpec("verdicts", PortType.Table),
            new PortSpec("summary", PortType.Table),
        ],
        Params: [IdsFiles.PathSpec],
        "Evaluates a buildingSMART IDS 1.0 file over the entity and parameter tables (the first two "
        + "outputs of bos.load) and outputs a verdict table (GlobalId, EntityIndex, CheckId, CheckTitle, "
        + "Citation, Verdict, Reason; one row per entity per specification) and a summary with the Pass, "
        + "Fail and InfoNotAvailable counts per specification (one row per specification, zeros when "
        + "none of its rows exist). A facet BOS cannot answer gives InfoNotAvailable and a warning, "
        + "never a pass; a facet the IDS loader skipped is a warning too.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var document = IdsFiles.Load(parameters, context, Kind);
        var model = IdsModel.FromTables(inputs.TableInput(0, Kind), inputs.TableInput(1, Kind));
        var report = IdsEvaluator.Evaluate(document.Ids, model);
        foreach (var warning in report.Warnings)
            context.Warn($"{Kind}: {warning}");
        return [new TableValue(report.ToTable()), new TableValue(IdsTables.Summary(document, report))];
    }
}
