using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Tests.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Review"), Category("Source.Synthetic")]
public sealed class WorkflowTests
{
    [Test, Category("Feature.Takeoff"), Category("Workflow.Roofing")]
    public void RoofingUsesSurfaceAreaAndReportsTheUnmeasuredScope()
    {
        var roofs = new[] {
            Roof("pitched", Known(new Area(125)), Known(new Area(100))),
            Roof("flat", Known(new Area(40)), Known(new Area(40))),
            Roof("not-measured", Unknown<Area>(), Known(new Area(60))) };

        // This is a subtotal plus an exception list, not a complete roof quantity.
        var known = roofs.Select(r => r.NetSurfaceArea).OfType<Fact<Area>.Known>();
        var subtotal = known.Sum(a => a.Value.SquareMetres);
        var unresolved = roofs.Where(r => r.NetSurfaceArea is Fact<Area>.Missing).Select(r => r.Id).ToArray();
        Assert.That(subtotal, Is.EqualTo(165));
        Assert.That(unresolved, Is.EqualTo(new[] { Key<Roof>("not-measured") }));
        Assert.That(roofs.Select(r => r.ProjectedArea).OfType<Fact<Area>.Known>().Sum(a => a.Value.SquareMetres), Is.EqualTo(200));
    }

    [Test, Category("Feature.Finishes"), Category("Workflow.InteriorFitout")]
    public void OppositeWallFacesAndUnassignedFinishesRemainSeparateScopes()
    {
        var finishes = new[] {
            Finish("north-face", "shared-wall", "north", 30, Links(Key<Space>("office"))),
            Finish("south-face", "shared-wall", "south", 24, Links(Key<Space>("corridor"))),
            Finish("unassigned", "other-wall", "face-1", 12, LinkSet<Space>.Unknown()) };
        var office = finishes.Where(f => f.Spaces.Items.Contains(Key<Space>("office")))
            .Select(f => f.NetArea).OfType<Fact<Area>.Known>().Sum(a => a.Value.SquareMetres);
        var unassigned = finishes.Where(f => f.Spaces.Completeness != Completeness.Complete).ToArray();
        Assert.That(office, Is.EqualTo(30));
        Assert.That(finishes.Select(f => f.NetArea).OfType<Fact<Area>.Known>().Sum(a => a.Value.SquareMetres), Is.EqualTo(66));
        Assert.That(unassigned.Single().Id, Is.EqualTo(Key<FinishSurface>("unassigned")));
        Assert.That(finishes[0].Host, Is.EqualTo(finishes[1].Host));
        Assert.That(finishes[0].HostFaceIdentifier, Is.Not.EqualTo(finishes[1].HostFaceIdentifier));
    }

    [Test, Category("Feature.Identity"), Category("Workflow.RevisionReview")]
    public void ALocalRowKeyCannotAccidentallyJoinAcrossSnapshots()
    {
        var quantities = new Dictionary<SnapshotKey<Roof>, Area> {
            [Key<Roof>("roof-1", "issue-1")] = new(100),
            [Key<Roof>("roof-1", "issue-2")] = new(120) };
        Assert.That(quantities.Count, Is.EqualTo(2));
        Assert.That(quantities[Key<Roof>("roof-1", "issue-2")].SquareMetres, Is.EqualTo(120));
        Assert.Throws<ArgumentException>(() => new SnapshotKey<Roof>(default, "roof-1"));
        Assert.Throws<ArgumentException>(() => new ReferenceKey<BimObject>(" "));
    }

    [Test, Category("Feature.Evidence"), Category("Workflow.DataReview")]
    public void ZeroFalseInapplicableAndUnobservedAreDifferentAnswers()
    {
        Assert.That(Known(new Area(0)), Is.TypeOf<Fact<Area>.Known>());
        Assert.That(Unknown<Area>(), Is.TypeOf<Fact<Area>.Missing>());
        Assert.That(Fact<Area>.Inapplicable("No surface in this scope"), Is.Not.EqualTo(Unknown<Area>()));
        Assert.That(Known(false), Is.Not.EqualTo(Unknown<bool>()));
        Assert.That(Links<Door>().Completeness, Is.EqualTo(Completeness.Complete));
        Assert.That(LinkSet<Door>.Unknown().Completeness, Is.EqualTo(Completeness.NotObserved));
    }

}
