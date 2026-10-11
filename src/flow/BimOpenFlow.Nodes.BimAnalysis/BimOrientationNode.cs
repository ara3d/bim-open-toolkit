using System.Numerics;
using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Where each element sits around the building in plan: the compass bearing
/// from the plan centre to the element's box centre, and the side its larger vertical
/// box face looks out to. A facade engineer groups by Direction; an energy modeller sums
/// FacingArea by Facing for a window-to-wall ratio.</summary>
public sealed class BimOrientationNode : IFlowNode
{
    public const string Kind = "bim.orientation";

    public const string Bearing = "Bearing";
    public const string Sector = "Sector";
    public const string Direction = "Direction";
    public const string Facing = "Facing";
    public const string FacingArea = "FacingArea";

    /// <summary>The 8-point compass, indexed by Sector (0 = N, clockwise).</summary>
    public static readonly IReadOnlyList<string> Compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("path", ParamKind.FilePath, Bindable: PortType.Text, Suggest: SuggestSource.FilesWith(".bos")),
            new ParamSpec("categories", ParamKind.Text, "", List: true),
        ],
        "Loads a .bos file into one row per element with a box: EntityIndex, GlobalId, Name, Category, "
        + "Level, CenterX, CenterY, Bearing, Sector, Direction, Distance, Facing, FacingArea. The box is the "
        + "element's Rvt:Element:Bounds when present, else the world box of its visible geometry. The plan "
        + "centre is the middle of the rows' combined XY extent, so 'categories' (comma-separated, blank for "
        + "every element) also sets the centre. Bearing is degrees clockwise from project north (+Y of the "
        + "model) to the element's box centre; a BOS carries no true-north angle, so it is not true north. "
        + "Sector 0..7 and Direction (N, NE, E, SE, S, SW, W, NW) bin the bearing in 45-degree slices centred "
        + "on each point; Distance is the plan distance from the centre (m). Facing (N, E, S, W) is the side "
        + "the box's larger vertical face looks out to, by which side of the centre the box lies on; "
        + "FacingArea is that face's area, max(SizeX, SizeY) * SizeZ (m2), which approximates a wall's or "
        + "window's gross face when it runs along a model axis and overstates a diagonal one.");

    private sealed record Row(EntityModel Element, BosBox Box, Vector2 Centre)
    {
        public double Dx => Box.Center.X - Centre.X;
        public double Dy => Box.Center.Y - Centre.Y;
        public double Bearing => (Math.Atan2(Dx, Dy) * 180 / Math.PI + 360) % 360;
        public int Sector => (int)Math.Floor((Bearing + 22.5) / 45) % 8;
        public double Distance => Math.Sqrt(Dx * Dx + Dy * Dy);
        public string Facing => Box.Size.X >= Box.Size.Y ? (Dy >= 0 ? "N" : "S") : (Dx >= 0 ? "E" : "W");
        public double FacingArea => (double)Math.Max(Box.Size.X, Box.Size.Y) * Box.Size.Z;
    }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var model = BimModel.Get(parameters.RequiredText("path", Kind), Kind);
        var categories = parameters.TextOr("categories", "");
        var elements = string.IsNullOrWhiteSpace(categories)
            ? model.InstanceElements()
            : model.ElementsInCategories(categories);
        var scene = new BosScene(model.Data);
        var boxed = elements
            .Select(e => (Element: e, Box: model.GetBounds(e.Index) is { } b
                ? new BosBox(new(b.Min.X, b.Min.Y, b.Min.Z), new(b.Max.X, b.Max.Y, b.Max.Z))
                : scene.Bounds((int)e.Index)))
            .Where(p => p.Box != null)
            .Select(p => (p.Element, Box: p.Box!.Value))
            .ToList();
        var extent = boxed.Count == 0 ? default : boxed.Select(p => p.Box).Aggregate((a, b) => a.Union(b));
        var centre = new Vector2(extent.Center.X, extent.Center.Y);
        var rows = boxed.Select(p => new Row(p.Element, p.Box, centre)).ToList();
        object?[] Cells(Func<Row, object?> f) => rows.Select(f).ToArray();

        var t = new DataTableBuilder("orientation");
        t.AddColumn(Cells(r => (long)(int)r.Element.Index), BimColumns.EntityIndex, typeof(long));
        t.AddColumn(Cells(r => r.Element.GlobalId), BimColumns.GlobalId, typeof(string));
        t.AddColumn(Cells(r => r.Element.Name), BimColumns.Name, typeof(string));
        t.AddColumn(Cells(r => r.Element.Category), BimColumns.Category, typeof(string));
        t.AddColumn(Cells(r => r.Element.LevelName), BimColumns.Level, typeof(string));
        t.AddColumn(Cells(r => (double)r.Box.Center.X), BimColumns.CenterX, typeof(double));
        t.AddColumn(Cells(r => (double)r.Box.Center.Y), BimColumns.CenterY, typeof(double));
        t.AddColumn(Cells(r => r.Bearing), Bearing, typeof(double));
        t.AddColumn(Cells(r => (long)r.Sector), Sector, typeof(long));
        t.AddColumn(Cells(r => Compass[r.Sector]), Direction, typeof(string));
        t.AddColumn(Cells(r => r.Distance), BimColumns.Distance, typeof(double));
        t.AddColumn(Cells(r => r.Facing), Facing, typeof(string));
        t.AddColumn(Cells(r => r.FacingArea), FacingArea, typeof(double));
        return [new TableValue(t.Build())];
    }
}
