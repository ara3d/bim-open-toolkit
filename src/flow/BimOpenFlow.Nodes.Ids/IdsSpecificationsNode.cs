using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Ids;

namespace BimOpenFlow.Nodes.Ids;

/// <summary>ids.specifications: what an IDS file asks, as a table, before any model is read.</summary>
public sealed class IdsSpecificationsNode : IFlowNode
{
    public const string Kind = "ids.specifications";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("specifications", PortType.Table)],
        Params: [IdsFiles.PathSpec],
        "Lists the specifications of a buildingSMART IDS 1.0 file: CheckId, CheckTitle, IfcVersion, "
        + "Cardinality, Applicability, Requirements, and Supported (false when a facet would give "
        + "InfoNotAvailable; material and part-of facets count as supported and need ids.check's "
        + "relations input). Reads no model; use it to see what an IDS asks before running ids.check.",
        Schemas:
        [
            KindSchemas.Static("specifications",
                ColumnKinds.CheckId.NotNull(), ColumnKinds.CheckTitle.NotNull(), ColumnKinds.IfcVersion.NotNull(),
                ColumnKinds.Cardinality.NotNull(), ColumnKinds.Applicability.NotNull(), ColumnKinds.Requirements.NotNull(),
                ColumnKinds.Supported.NotNull()),
        ]);

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => [new TableValue(IdsTables.Specifications(IdsFiles.Load(parameters, context, Kind)))];
}
