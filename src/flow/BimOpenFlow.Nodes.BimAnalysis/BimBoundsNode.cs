using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

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

    private sealed record Row(EntityModel Element,
        double MinX, double MinY, double MinZ, double MaxX, double MaxY, double MaxZ)
    {
        public double SizeX => MaxX - MinX;
        public double SizeY => MaxY - MinY;
        public double SizeZ => MaxZ - MinZ;
        public double CenterX => (MinX + MaxX) / 2;
        public double CenterY => (MinY + MaxY) / 2;
        public double CenterZ => (MinZ + MaxZ) / 2;
        public double FootprintArea => SizeX * SizeY;
        public double Volume => SizeX * SizeY * SizeZ;
        public double Diagonal => Math.Sqrt(SizeX * SizeX + SizeY * SizeY + SizeZ * SizeZ);
    }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var model = BimModel.Get(parameters.RequiredText("path", Kind), Kind);
        var rows = model.InstanceElements()
            .Select(e => (Element: e, Bounds: model.GetBounds(e.Index)))
            .Where(p => p.Bounds != null)
            .Select(p => new Row(p.Element,
                p.Bounds!.Value.Min.X, p.Bounds.Value.Min.Y, p.Bounds.Value.Min.Z,
                p.Bounds.Value.Max.X, p.Bounds.Value.Max.Y, p.Bounds.Value.Max.Z))
            .ToList();

        var builder = new DataTableBuilder("bounds");
        builder.AddColumn(rows.Select(r => (object?)(long)r.Element.Index).ToArray(),
            BimColumns.EntityIndex, typeof(long));
        builder.AddColumn(rows.Select(r => (object?)r.Element.Name).ToArray(),
            BimColumns.Name, typeof(string));
        builder.AddColumn(rows.Select(r => (object?)r.Element.Category).ToArray(),
            BimColumns.Category, typeof(string));
        builder.AddColumn(rows.Select(r => (object?)r.Element.LevelName).ToArray(),
            BimColumns.Level, typeof(string));

        void Measure(string name, Func<Row, double> cell)
            => builder.AddColumn(rows.Select(r => (object?)cell(r)).ToArray(), name, typeof(double));

        Measure(BimColumns.MinX, r => r.MinX);
        Measure(BimColumns.MinY, r => r.MinY);
        Measure(BimColumns.MinZ, r => r.MinZ);
        Measure(BimColumns.MaxX, r => r.MaxX);
        Measure(BimColumns.MaxY, r => r.MaxY);
        Measure(BimColumns.MaxZ, r => r.MaxZ);
        Measure(BimColumns.SizeX, r => r.SizeX);
        Measure(BimColumns.SizeY, r => r.SizeY);
        Measure(BimColumns.SizeZ, r => r.SizeZ);
        Measure(BimColumns.CenterX, r => r.CenterX);
        Measure(BimColumns.CenterY, r => r.CenterY);
        Measure(BimColumns.CenterZ, r => r.CenterZ);
        Measure(BimColumns.FootprintArea, r => r.FootprintArea);
        Measure(BimColumns.Volume, r => r.Volume);
        Measure(BimColumns.Diagonal, r => r.Diagonal);

        return [new TableValue(builder.Build())];
    }
}
