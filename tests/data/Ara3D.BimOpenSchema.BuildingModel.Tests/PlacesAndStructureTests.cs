using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Tests.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Review"), Category("Source.Synthetic")]
public sealed class PlacesAndStructureTests
{
    [Test, Category("Feature.Spaces"), Category("Workflow.SpaceProgramming")]
    public void ARoomProgramCanBeQueriedBeforeGeometryAndRetainsUnmeasuredRooms()
    {
        var spaces = new[] {
            ScheduledSpace("office-01", "Design studio", "Office", Known(new Area(60))),
            ScheduledSpace("office-02", "Future studio", "Office", Unknown<Area>()),
            ScheduledSpace("store-01", "Archive", "Storage", Known(new Area(12))) };

        var offices = spaces.Where(s => s.Use is Fact<string>.Known { Value: "Office" }).ToArray();
        var knownArea = offices.Select(s => s.NetFloorArea).OfType<Fact<Area>.Known>()
            .Sum(a => a.Value.SquareMetres);
        var missingMeasurements = offices.Where(s => s.NetFloorArea is Fact<Area>.Missing)
            .Select(s => s.Element.Name).ToArray();
        var geometryToPrepare = offices.Where(s => s.BoundaryRepresentation is Fact<SnapshotKey<GeometryRepresentation>>.Missing)
            .Select(s => s.Id).ToArray();

        Assert.That(offices.Select(s => s.Element.Name), Is.EqualTo(new[] { "Design studio", "Future studio" }));
        Assert.That(knownArea, Is.EqualTo(60));
        Assert.That(missingMeasurements, Is.EqualTo(new[] { "Future studio" }));
        Assert.That(geometryToPrepare, Is.EqualTo(new[] { Key<Space>("office-01"), Key<Space>("office-02") }));
    }

    [Test, Category("Feature.SpaceBoundaries"), Category("Workflow.InteriorFitout")]
    public void TwoRoomsShareOneWallWithoutMakingBoundaryAreaAFinishTakeoff()
    {
        var office = Key<Space>("office");
        var corridor = Key<Space>("corridor");
        var wall = Ref<BimObject>("shared-wall");
        var boundaries = new[] {
            Boundary("office-side", office, wall, "north", corridor, 30),
            Boundary("corridor-side", corridor, wall, "south", office, 30) };
        var finishes = new[] {
            Finish("paint-office", "shared-wall", "north", 26, Links(office)),
            Finish("tile-corridor", "shared-wall", "south", 18, Links(corridor)) };

        var adjacentToOffice = boundaries.Where(b => b.Space == office)
            .Select(b => b.AdjacentSpace).OfType<Fact<SnapshotKey<Space>>.Known>()
            .Select(s => s.Value).ToArray();
        var uniqueHosts = boundaries.Select(b => b.Host).OfType<Fact<ReferenceKey<BimObject>>.Known>()
            .Select(h => h.Value).Distinct().Count();
        var officeFinishArea = finishes.Where(f => f.Spaces.Items.Contains(office))
            .Select(f => f.NetArea).OfType<Fact<Area>.Known>().Sum(a => a.Value.SquareMetres);
        var directedBoundaryArea = boundaries.Select(b => b.Area).OfType<Fact<Area>.Known>()
            .Sum(a => a.Value.SquareMetres);

        Assert.That(adjacentToOffice, Is.EqualTo(new[] { corridor }));
        Assert.That(uniqueHosts, Is.EqualTo(1));
        Assert.That(officeFinishArea, Is.EqualTo(26));
        Assert.That(directedBoundaryArea, Is.EqualTo(60));
        Assert.That(finishes.Select(f => f.NetArea).OfType<Fact<Area>.Known>()
            .Sum(a => a.Value.SquareMetres), Is.EqualTo(44));
    }

    [Test, Category("Feature.Structure"), Category("Workflow.StructuralTakeoff")]
    public void BeamAndColumnSchedulesUseCutLengthsAndReportUnclassifiedMembers()
    {
        var members = new[] {
            Member("beam-1", Known(StructuralMemberRole.Beam), 6.2, 6.0, 200),
            Member("beam-2", Known(StructuralMemberRole.Beam), 4.2, 4.0, 150),
            Member("column-1", Known(StructuralMemberRole.Column), 3.4, 3.2, 120),
            Member("unclassified", Unknown<StructuralMemberRole>(), 2.0, 1.8, 50) };

        var schedule = members.Where(m => m.Role is Fact<StructuralMemberRole>.Known)
            .GroupBy(m => ((Fact<StructuralMemberRole>.Known)m.Role).Value)
            .ToDictionary(g => g.Key, g => new {
                Count = g.Count(),
                CutMetres = g.Select(m => m.CutLength).OfType<Fact<Length>.Known>().Sum(v => v.Value.Metres),
                Kilograms = g.Select(m => m.Mass).OfType<Fact<Mass>.Known>().Sum(v => v.Value.Kilograms) });
        var unclassified = members.Where(m => m.Role is Fact<StructuralMemberRole>.Missing).Select(m => m.Id).ToArray();

        Assert.That(schedule[StructuralMemberRole.Beam].Count, Is.EqualTo(2));
        Assert.That(schedule[StructuralMemberRole.Beam].CutMetres, Is.EqualTo(10.4).Within(1e-10));
        Assert.That(schedule[StructuralMemberRole.Beam].Kilograms, Is.EqualTo(350));
        Assert.That(schedule[StructuralMemberRole.Column].CutMetres, Is.EqualTo(3.4));
        Assert.That(unclassified, Is.EqualTo(new[] { Key<StructuralMember>("unclassified") }));
        Assert.That(members.Take(2).Select(m => m.CenterlineLength).OfType<Fact<Length>.Known>()
            .Sum(v => v.Value.Metres), Is.EqualTo(10));
    }

    [Test, Category("Feature.Earthworks"), Category("Workflow.CivilTakeoff")]
    public void CutAndFillAreSeparateSubtotalsAndUnknownFillRemainsAnException()
    {
        var zones = new[] {
            Earthwork("west", Known(new Volume(120)), Known(new Volume(20))),
            Earthwork("east", Known(new Volume(10)), Known(new Volume(90))),
            Earthwork("future", Known(new Volume(5)), Unknown<Volume>()) };

        var cut = zones.Select(z => z.CutVolume).OfType<Fact<Volume>.Known>().Sum(v => v.Value.CubicMetres);
        var fill = zones.Select(z => z.FillVolume).OfType<Fact<Volume>.Known>().Sum(v => v.Value.CubicMetres);
        var unresolvedFill = zones.Where(z => z.FillVolume is Fact<Volume>.Missing).Select(z => z.Id).ToArray();
        var looseTransportInputs = zones.Where(z => z.CutVolume is Fact<Volume>.Known && z.BulkingFactor is Fact<Ratio>.Known).ToArray();

        Assert.That(cut, Is.EqualTo(135));
        Assert.That(fill, Is.EqualTo(110));
        Assert.That(unresolvedFill, Is.EqualTo(new[] { Key<EarthworkZone>("future") }));
        Assert.That(looseTransportInputs, Is.Empty, "In-situ cut volume alone does not establish loose hauling volume.");
    }

    private static Space ScheduledSpace(string id, string name, string use, Fact<Area> area) => new(
        Key<Space>(id), Element(id, name), Known(id), Known(Key<Building>("building-a")),
        Known(Key<Storey>("ground")), Known(use), Unknown<string>(), Known(SpaceEnclosureKind.ScheduledOnly),
        area, Known("Owner room-program net area"), Unknown<Length>(), Unknown<Volume>(), Unknown<int>(),
        Unknown<SnapshotKey<GeometryRepresentation>>(), LinkSet<SpaceBoundary>.Unknown(),
        LinkSet<FinishSurface>.Unknown(), LinkSet<Door>.Unknown());

    private static SpaceBoundary Boundary(string id, SnapshotKey<Space> space, ReferenceKey<BimObject> host,
        string face, SnapshotKey<Space> adjacent, double area) => new(
        Key<SpaceBoundary>(id), space, Known(SpaceBoundaryKind.Physical), Known(host), Known(face),
        Known(adjacent), Known(false), Unknown<SnapshotKey<SpaceBoundary>>(), Known(new Area(area)),
        Unknown<SnapshotKey<GeometryRepresentation>>(), Ref<Evidence>("boundary-survey"));

    private static StructuralMember Member(string id, Fact<StructuralMemberRole> role, double cut, double axis, double mass) => new(
        Key<StructuralMember>(id), Element(id), role, Unknown<ReferenceKey<ProductDefinition>>(),
        Known(Ref<Material>("steel")), Known("S355"), Known("Example section"), Known(Key<Storey>("level-2")),
        Unknown<SnapshotKey<GeometryRepresentation>>(), Known(new Length(cut)), Known(new Length(axis)),
        Unknown<Volume>(), Known(new Mass(mass)), Unknown<string>(), LinkSet<StructuralConnection>.Unknown());

    private static EarthworkZone Earthwork(string id, Fact<Volume> cut, Fact<Volume> fill) => new(
        Key<EarthworkZone>(id), Element(id), Known(Key<Site>("site-a")),
        Known(Key<TerrainSurface>("survey")), Known(Key<TerrainSurface>("design")),
        Known("General excavation"), cut, fill, Unknown<Ratio>(), Unknown<Ratio>(),
        Known("Synthetic comparison of explicitly partitioned scopes"));
}
