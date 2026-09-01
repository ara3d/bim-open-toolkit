using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using BimOpenFlow.Nodes.Bos;
using BimOpenFlow.Nodes.Compliance;
using BimOpenFlow.Nodes.Effects;
using BimOpenFlow.Nodes.Geometry;

namespace BimOpenFlow.PocParity.Tests;

/// <summary>
/// The registry the parity tests evaluate against: all four production node
/// packs combined exactly as a host would, plus one fixture-only source
/// (test.table) that plays the PoC data.csv role of injecting small tables.
/// </summary>
internal static class ParityCatalog
{
    public static readonly IFlowNode TableSource = new DelegateNode(
        new NodeSpec("test.table", 1, NodeCapability.Pure,
            Inputs: [],
            Outputs: [new PortSpec("table", PortType.Table)],
            Params: [new ParamSpec("name", ParamKind.Text)],
            "Outputs the named fixture table."),
        (_, _, parameters) => [new TableValue(SampleModel.Table(parameters.GetText("name")))]);

    public static readonly INodeRegistry Registry = NodeRegistry.Combine(
        BosNodes.All, ComplianceNodes.All, EffectNodes.All, GeometryNodes.All, [TableSource]);

    public static FlowTestSession NewSession()
        => new(Registry);
}
