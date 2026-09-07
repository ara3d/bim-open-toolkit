using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Tests.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Review"), Category("Source.Synthetic")]
public sealed class ServicesTests
{
    [Test, Category("Feature.Electrical"), Category("Workflow.PanelScheduling")]
    public void PanelScheduleKeepsConnectedLoadDemandAndMissingCircuitsDistinct()
    {
        var panel = new ElectricalPanel(Key<ElectricalPanel>("LP-1"), Element("panel-1"),
            Unknown<SnapshotKey<Space>>(), Known("LP-1"), Known(new Voltage(230)), Known(1),
            Known(new ElectricCurrent(100)), Known(new ElectricCurrent(80)), Unknown<ElectricCurrent>(),
            Known(12), Unknown<string>(), Links(Key<ElectricalCircuit>("lighting"), Key<ElectricalCircuit>("sockets"),
                Key<ElectricalCircuit>("future")), LinkSet<ServicePort>.Unknown(), Unknown<Length>());
        var circuits = new[] {
            Circuit("lighting", panel.Id, Known(new Power(1200)), Known(new Power(900))),
            Circuit("sockets", panel.Id, Known(new Power(3000)), Known(new Power(1500))),
            Circuit("future", panel.Id, Unknown<Power>(), Unknown<Power>()),
            Circuit("other-panel", Key<ElectricalPanel>("LP-2"), Known(new Power(9000)), Known(new Power(9000))) };

        var schedule = circuits.Where(c => c.PanelId is Fact<SnapshotKey<ElectricalPanel>>.Known p && p.Value == panel.Id).ToArray();
        var connectedSubtotal = schedule.Select(c => c.ConnectedLoad).OfType<Fact<Power>.Known>().Sum(f => f.Value.Watts);
        var demandSubtotal = schedule.Select(c => c.DemandLoad).OfType<Fact<Power>.Known>().Sum(f => f.Value.Watts);
        var missing = schedule.Where(c => c.ConnectedLoad is Fact<Power>.Missing || c.DemandLoad is Fact<Power>.Missing).Select(c => c.Id);

        Assert.That(connectedSubtotal, Is.EqualTo(4200));
        Assert.That(demandSubtotal, Is.EqualTo(2400));
        Assert.That(missing, Is.EqualTo(new[] { Key<ElectricalCircuit>("future") }));
        Assert.That(schedule.Select(c => c.Id), Is.EquivalentTo(panel.Circuits.Items));
        // All circuits have been enumerated; their load values still are not complete.
        Assert.That(panel.Circuits.Completeness, Is.EqualTo(Completeness.Complete));
    }

    [Test, Category("Feature.ServiceSupports"), Category("Workflow.MultiTradeTakeoff")]
    public void SharedSupportIsPurchasedOnceAlthoughItSupportsTwoTrades()
    {
        var support = new ServiceSupport(Key<ServiceSupport>("trapeze-1"), Element("trapeze-object"),
            ServiceSupportKind.Trapeze, Known(Ref<BimObject>("slab-1")), Unknown<ReferenceKey<Material>>(),
            Known(new Length(1.5)), Known(new Length(0.8)), Known(2), Known("A-1"), Unknown<bool>(),
            Links(Key<ServiceSupportAttachment>("duct-attachment"), Key<ServiceSupportAttachment>("tray-attachment")));
        var attachments = new[] {
            new ServiceSupportAttachment(Key<ServiceSupportAttachment>("duct-attachment"), support.Id,
                Ref<BimObject>("duct-1"), Known("Cradle"), Ref<Evidence>("support-layout")),
            new ServiceSupportAttachment(Key<ServiceSupportAttachment>("tray-attachment"), support.Id,
                Ref<BimObject>("tray-1"), Known("Clamp"), Ref<Evidence>("support-layout")) };

        var selectedObjects = new[] { Ref<BimObject>("duct-1"), Ref<BimObject>("tray-1") };
        var supportIds = attachments.Where(a => selectedObjects.Contains(a.SupportedObjectId)).Select(a => a.SupportId).Distinct().ToArray();
        var purchaseRows = new[] { support }.Where(s => supportIds.Contains(s.Id)).ToArray();
        var anchorCount = purchaseRows.Select(s => s.AnchorCount).OfType<Fact<int>.Known>().Sum(f => f.Value);

        Assert.That(attachments, Has.Length.EqualTo(2));
        Assert.That(purchaseRows, Has.Length.EqualTo(1));
        Assert.That(purchaseRows.Select(s => s.Element.ObjectId), Is.EqualTo(new[] { Ref<BimObject>("trapeze-object") }));
        Assert.That(anchorCount, Is.EqualTo(2));
    }

    [Test, Category("Feature.ServicePenetrations"), Category("Workflow.FirestopCoordination")]
    public void SharedPenetrationKeepsServiceCountSeparateFromFirestopAssemblyCount()
    {
        var penetration = new ServicePenetration(Key<ServicePenetration>("crossing-1"), Element("crossing-object"),
            Known(Key<Opening>("opening-1")), Known(Ref<BimObject>("wall-1")), Unknown<ReferenceKey<Material>>(),
            Known(new Length(0.2)), Unknown<Length>(), Known(new DurationValue(TimeSpan.FromHours(1))),
            Unknown<string>(), Known(true), Unknown<bool>(), Links(Key<PenetratingService>("pipe-crossing"),
                Key<PenetratingService>("cable-crossing")), Unknown<ReferenceKey<Evidence>>());
        var crossings = new[] {
            new PenetratingService(Key<PenetratingService>("pipe-crossing"), penetration.Id,
                Ref<BimObject>("pipe-1"), Known(true), Ref<Evidence>("crossing-layout")),
            new PenetratingService(Key<PenetratingService>("cable-crossing"), penetration.Id,
                Ref<BimObject>("cable-1"), Unknown<bool>(), Ref<Evidence>("crossing-layout")) };

        var wallCrossings = new[] { penetration }.Where(p => p.BarrierId is Fact<ReferenceKey<BimObject>>.Known b && b.Value == Ref<BimObject>("wall-1")).ToArray();
        var associatedServices = crossings.Where(c => wallCrossings.Any(p => p.Id == c.PenetrationId)).Select(c => c.ServiceObjectId).Distinct().Count();
        var inspectionBacklog = wallCrossings.Where(p => p.InstalledFirestopSystem is Fact<string>.Missing ||
            p.InspectionReference is Fact<ReferenceKey<Evidence>>.Missing).Select(p => p.Id);

        Assert.That(wallCrossings, Has.Length.EqualTo(1));
        Assert.That(associatedServices, Is.EqualTo(2));
        Assert.That(inspectionBacklog, Is.EqualTo(new[] { penetration.Id }));
        // A known fire-resistance requirement cannot establish that a system was installed.
        Assert.That(penetration.RequiredFireResistance, Is.TypeOf<Fact<DurationValue>.Known>());
    }

    [Test, Category("Feature.SanitaryFixtures"), Category("Workflow.PlumbingSchedule")]
    public void ToiletFlushDetailsEnrichOneFixtureAndUnobservedPortsRemainUnknown()
    {
        var fixtures = new[] { Fixture("wc-1", SanitaryFixtureKind.Toilet), Fixture("basin-1", SanitaryFixtureKind.Washbasin) };
        var specifications = new[] { new ToiletSpecification(Key<ToiletSpecification>("wc-flush"), fixtures[0].Id,
            Known(FlushOperation.GravityCistern), Known(new Volume(0.006)), Known(new Volume(0.003)),
            Known(true), Known("Horizontal"), Unknown<Length>(), Ref<Evidence>("fixture-schedule")) };

        var toilets = fixtures.Where(f => f.Kind == SanitaryFixtureKind.Toilet).ToArray();
        var flushSchedule = toilets.Join(specifications, f => f.Id, s => s.FixtureId, (f, s) => new { Fixture = f, Specification = s }).ToArray();
        var plumbingDataNeeded = fixtures.Where(f => f.Ports.Completeness != Completeness.Complete).Select(f => f.Id).ToArray();
        var confirmedPortlessFixtures = fixtures.Where(f => f.Ports.Completeness == Completeness.Complete && f.Ports.Items.IsEmpty).ToArray();

        Assert.That(toilets, Has.Length.EqualTo(1));
        Assert.That(flushSchedule, Has.Length.EqualTo(1));
        Assert.That(((Fact<Volume>.Known)flushSchedule[0].Specification.FullFlushVolume).Value.CubicMetres, Is.EqualTo(0.006));
        Assert.That(plumbingDataNeeded, Has.Length.EqualTo(2));
        Assert.That(confirmedPortlessFixtures, Is.Empty);
    }

    [Test, Category("Feature.DuctDimensions"), Category("Workflow.CeilingCoordination")]
    public void DuctFlowAreaAndInsulatedEnvelopeUseDifferentDimensions()
    {
        var duct = new DuctSegment(Key<DuctSegment>("duct-1"), Element("duct-1"), Unknown<SnapshotKey<ServiceSystem>>(),
            Known(FlowSectionShape.Rectangular), Known(new Length(0.5)), Known(new Length(0.3)),
            Fact<Length>.Inapplicable("Rectangular section."), Known(new Length(8)), Unknown<ReferenceKey<Material>>(),
            Known(new Length(0.05)), Known(new Length(0)), Known(new FlowRate(0.6)), Unknown<string>(), LinkSet<ServicePort>.Unknown());
        var w = ((Fact<Length>.Known)duct.Width).Value.Metres;
        var h = ((Fact<Length>.Known)duct.Height).Value.Metres;
        var insulation = ((Fact<Length>.Known)duct.InsulationThickness).Value.Metres;
        var clearFlowArea = w * h;
        // A coordination estimate assumes negligible shell thickness and no internal lining.
        // This explicit approximation is not a geometry-derived solid dimension or quantity.
        var insulatedEnvelopeWidth = w + 2 * insulation;
        var insulatedEnvelopeHeight = h + 2 * insulation;
        var meanDesignVelocity = ((Fact<FlowRate>.Known)duct.DesignFlow).Value.CubicMetresPerSecond / clearFlowArea;

        Assert.That(clearFlowArea, Is.EqualTo(0.15).Within(1e-12));
        Assert.That(meanDesignVelocity, Is.EqualTo(4).Within(1e-12));
        Assert.That(insulatedEnvelopeWidth, Is.EqualTo(0.6).Within(1e-12));
        Assert.That(insulatedEnvelopeHeight, Is.EqualTo(0.4).Within(1e-12));
        Assert.That(insulatedEnvelopeWidth * insulatedEnvelopeHeight, Is.Not.EqualTo(clearFlowArea));
    }

    [Test, Category("Feature.PipeDimensions"), Category("Workflow.PipeProcurement")]
    public void NominalPipeLabelsGroupPurchasesWithoutReplacingPhysicalDiameters()
    {
        var pipes = new[] { Pipe("steel", "DN50", 0.0603, 0.0525, 10), Pipe("plastic", "DN50", 0.063, 0.0514, 6) };
        var nominalLengthSchedule = pipes.GroupBy(p => ((Fact<string>.Known)p.NominalSize).Value)
            .Select(g => new { Label = g.Key, Length = g.Select(p => p.CenterlineLength).OfType<Fact<Length>.Known>().Sum(f => f.Value.Metres) }).Single();
        var sleeveDiameterCandidates = pipes.Select(p => ((Fact<Length>.Known)p.OutsideDiameter).Value.Metres).Distinct().Order().ToArray();
        var containedVolumes = pipes.Select(p => Math.PI * Math.Pow(((Fact<Length>.Known)p.InsideDiameter).Value.Metres / 2, 2)
            * ((Fact<Length>.Known)p.CenterlineLength).Value.Metres).Sum();

        Assert.That(nominalLengthSchedule.Label, Is.EqualTo("DN50"));
        Assert.That(nominalLengthSchedule.Length, Is.EqualTo(16));
        Assert.That(sleeveDiameterCandidates, Is.EqualTo(new[] { 0.0603, 0.063 }));
        Assert.That(containedVolumes, Is.EqualTo(Math.PI / 4 * (0.0525 * 0.0525 * 10 + 0.0514 * 0.0514 * 6)).Within(1e-12));
        Assert.That(containedVolumes, Is.GreaterThan(Math.PI / 4 * 0.05 * 0.05 * 16));
    }

    private static ElectricalCircuit Circuit(string id, SnapshotKey<ElectricalPanel> panel, Fact<Power> connected, Fact<Power> demand) => new(
        Key<ElectricalCircuit>(id), Known(panel), id, Unknown<string>(), Known(new Voltage(230)), Known(1),
        Unknown<ElectricCurrent>(), connected, demand, Unknown<Ratio>(), Unknown<bool>(), Unknown<bool>(),
        Unknown<SnapshotKey<ServiceSystem>>(), LinkSet<ServicePort>.Unknown(), Ref<Evidence>("circuit-schedule"));

    private static SanitaryFixture Fixture(string id, SanitaryFixtureKind kind) => new(
        Key<SanitaryFixture>(id), Element(id), kind, Known(Key<Space>("washroom")), Unknown<string>(),
        Unknown<Length>(), Unknown<FlowRate>(), Unknown<FlowRate>(), Unknown<Length>(), Unknown<string>(),
        Unknown<string>(), LinkSet<ServicePort>.Unknown());

    private static PipeSegment Pipe(string id, string nominal, double outside, double inside, double length) => new(
        Key<PipeSegment>(id), Element(id), Unknown<SnapshotKey<ServiceSystem>>(), Known(nominal),
        Known(new Length(outside)), Known(new Length(inside)), Known(new Length(length)),
        Known(Ref<Material>(id)), Known(new Length((outside - inside) / 2)), Unknown<Length>(),
        Unknown<Ratio>(), Unknown<FlowRate>(), Unknown<Pressure>(), LinkSet<ServicePort>.Unknown());
}
