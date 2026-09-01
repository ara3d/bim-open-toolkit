using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Adds a Discipline column classified from a category column via a built-in
/// Revit/IFC category mapping, overridable per category.</summary>
public sealed class BimDisciplineNode : IFlowNode
{
    public const string Kind = "bim.discipline";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("table", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("column", ParamKind.Text, BimColumns.Category,
                Suggest: SuggestSource.ColumnsOf("table")),
            new ParamSpec("overrides", ParamKind.Json),
        ],
        "Adds a Discipline column (Architecture, Structure, Mechanical, Electrical, Plumbing, "
        + "FireProtection, Site, or General) classified from the category column by a built-in "
        + "mapping of common Revit categories and IFC classes; 'overrides' is an optional JSON "
        + "object of {\"category\": \"discipline\"} entries that win over the built-ins. "
        + "Unmatched categories get General.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track CLS");
}
