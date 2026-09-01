using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Per-element axis-aligned bounding boxes with the derived 2D and 3D
/// dimensions: sizes, center, footprint area, box volume, diagonal.</summary>
public sealed class BimBoundsNode : IFlowNode
{
    public const string Kind = "bim.bounds";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec("path", ParamKind.FilePath)],
        "Loads a .bos file into one row per element that has bounds: EntityIndex, Name, Category, "
        + "Level, MinX..MaxZ, SizeX/Y/Z, CenterX/Y/Z, FootprintArea (SizeX*SizeY), Volume "
        + "(box volume), Diagonal. Feeds bim.containment, bim.nearest, and dimension analyses.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track GEO");
}
