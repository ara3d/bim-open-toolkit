using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Tests.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Review"), Category("Source.Synthetic")]
public sealed class MaterialsAndOperationsTests
{
    [Test, Category("Feature.Materials"), Category("Workflow.MaterialTakeoff")]
    public void MaterialTakeoffSelectsDisjointLeavesAndTheirSelectedObservations()
    {
        var scopes = new[] {
            Scope("whole", QuantityScopeKind.WholeObject),
            Scope("core", QuantityScopeKind.MaterialPart),
            Scope("finish", QuantityScopeKind.MaterialPart),
            Scope("substitute-core", QuantityScopeKind.MaterialPart) };
        var observations = new[] {
            Quantity("whole-total", "whole", 120, QuantitySelection.Selected),
            Quantity("core-selected", "core", 100, QuantitySelection.Selected),
            Quantity("core-alternative", "core", 107, QuantitySelection.Alternative),
            Quantity("finish-selected", "finish", 20, QuantitySelection.Selected),
            Quantity("substitution", "substitute-core", 300, QuantitySelection.Selected) };
        var uses = new[] {
            Use("assembly", "whole", ContributionRole.AssemblyTotal, "whole-total"),
            Use("core", "core", ContributionRole.LeafContribution, "core-selected", "core-alternative"),
            Use("finish", "finish", ContributionRole.LeafContribution, "finish-selected"),
            Use("alternative-product", "substitute-core", ContributionRole.Alternative, "substitution") };

        // The example deliberately contains both representation-independent leaf scopes
        // and overlapping assembly/alternative amounts. The query states its selection rule.
        var rows = from use in uses
                   where use.Role == ContributionRole.LeafContribution
                   join scope in scopes on use.ScopeId equals scope.Id
                   from observationId in use.Observations.Items
                   join quantity in observations on observationId equals quantity.Id
                   where quantity.ScopeId == scope.Id && quantity.Selection == QuantitySelection.Selected
                   select quantity;
        var selected = rows.ToArray();
        var kilograms = selected.Select(q => q.Value).OfType<Fact<Measurement>.Known>()
            .Where(q => q.Value.Kind == MeasureKind.Mass && q.Value.UnitCode == "kg")
            .Sum(q => q.Value.Amount);

        Assert.That(kilograms, Is.EqualTo(120m));
        Assert.That(selected.Select(q => q.Id), Is.EquivalentTo(new[] {
            Key<QuantityObservation>("core-selected"), Key<QuantityObservation>("finish-selected") }));
        Assert.That(uses.Select(u => u.ObjectId).Distinct().Count(), Is.EqualTo(1));
        Assert.That(observations.Select(q => q.Value).OfType<Fact<Measurement>.Known>().Sum(q => q.Value.Amount), Is.EqualTo(647m),
            "Summing all available values would duplicate assembly totals, alternatives and the proposed substitute.");
    }

    [Test, Category("Feature.EnvironmentalImpact"), Category("Workflow.Carbon")]
    public void CarbonCalculationRetainsFactorUnitModuleAndMissingFactorCoverage()
    {
        var material = Use("core", "core", ContributionRole.LeafContribution, "core-selected");
        var quantity = Quantity("core-selected", "core", 100, QuantitySelection.Selected);
        var factor = new EnvironmentalFactor(
            Ref<EnvironmentalFactor>("synthetic-epd-v1-product"), "Synthetic EPD", "1", "Example producer",
            "Example material", Known(material.MaterialId), Unknown<ReferenceKey<ProductDefinition>>(),
            LifeCycleStage.Product, "A1-A3", QuantityUnit.Kilogram, Known(2m), "Illustrative GWP method",
            "Example region", Known(new DateOnly(2030, 1, 1)), "Product stages only; transport excluded", []);
        var incompatibleFactor = factor with { Id = Ref<EnvironmentalFactor>("area-factor"), Unit = QuantityUnit.SquareMetre };
        var measured = ((Fact<Measurement>.Known)quantity.Value).Value;
        var coefficient = ((Fact<decimal>.Known)factor.KilogramsCo2EquivalentPerUnit).Value;

        // A real calculation must resolve its measurement unit before applying a factor.
        Assert.That(measured.UnitCode, Is.EqualTo("kg"));
        Assert.That(factor.Unit, Is.EqualTo(QuantityUnit.Kilogram));
        Assert.That(incompatibleFactor.Unit, Is.Not.EqualTo(factor.Unit));
        var product = new ImpactLine(
            Key<ImpactLine>("core-product"), material.Id, Ref<AnalysisScenario>("carbon-base"), Known(factor.Id),
            Known(quantity.Id), "wall-core", factor.Stage, factor.ModuleCode, Known(measured.Amount), factor.Unit,
            Known(measured.Amount * coefficient), Completeness.Complete, "Selected kg × kgCO2e/kg; no unit conversion", []);
        var transport = product with {
            Id = Key<ImpactLine>("core-transport"), FactorId = Unknown<ReferenceKey<EnvironmentalFactor>>(),
            Stage = LifeCycleStage.Construction, ModuleCode = "A4", KilogramsCo2Equivalent = Unknown<decimal>(),
            InputCoverage = Completeness.Partial, CalculationMethod = "Transport factor not supplied" };
        var lines = new[] { product, transport };
        var summary = new ImpactSummary(
            Key<ImpactSummary>("core-products-and-transport"), product.ScenarioId, "wall-core", ["A1-A3", "A4"],
            factor.ImpactMethod, Known(lines.Select(x => x.KilogramsCo2Equivalent).OfType<Fact<decimal>.Known>().Sum(x => x.Value)),
            Unknown<decimal>(), 1, 0, 1, Completeness.Partial, "Disjoint product and transport modules", []);

        Assert.That(((Fact<decimal>.Known)summary.KnownKilogramsCo2Equivalent).Value, Is.EqualTo(200m));
        Assert.That(summary.TotalKilogramsCo2Equivalent, Is.TypeOf<Fact<decimal>.Missing>());
        Assert.That(summary.MissingFactorCount, Is.EqualTo(1));
        Assert.That(lines.Select(x => x.ModuleCode), Is.EquivalentTo(new[] { "A1-A3", "A4" }));
        Assert.That(transport.FactorId, Is.TypeOf<Fact<ReferenceKey<EnvironmentalFactor>>.Missing>());
    }

    [Test, Category("Feature.AssetHistory"), Category("Workflow.FacilitiesMaintenance")]
    public void MaintenanceHistoryJoinsToOnePhysicalPumpWithoutDuplicatingTheAsset()
    {
        var pump = new Pump(Key<Pump>("pump-01"), Element("pump-01", "Heating circulation pump"),
            Unknown<SnapshotKey<ServiceSystem>>(), Known("Centrifugal"), Known(new FlowRate(0.003)),
            Unknown<Pressure>(), Known(new Power(750)), Unknown<Ratio>(), Known(true), Known("Duty"), LinkSet<ServicePort>.Unknown());
        var asset = new Asset(Key<Asset>("asset-pump-01"), pump.Element.ObjectId, "Heating circulation pump", Known("P-01"),
            Unknown<ReferenceKey<ProductDefinition>>(), Unknown<string>(), Unknown<string>(), Known("SERIAL-01"),
            Unknown<SnapshotKey<Space>>(), Known("Facilities team"), Known(new DateOnly(2025, 1, 1)),
            Unknown<DateOnly>(), Unknown<DurationValue>(), Unknown<string>(), Known("Heating essential"), []);
        var requirement = new AssetServiceRequirement(Key<AssetServiceRequirement>("pump-inspection"), asset.Id,
            "Inspect bearings", Unknown<ReferenceKey<Requirement>>(), "Every 180 days", Known(new DurationValue(TimeSpan.FromDays(180))),
            Known("Mechanical technician"), Unknown<Length>(), "Owner maintenance procedure v1", []);
        var completed = new MaintenanceTask(Key<MaintenanceTask>("inspection-first"), asset.Id, Known(requirement.Id),
            "Inspect bearings", MaintenanceState.Completed, Known(At(1)), Known(At(1)), Known(At(1).AddHours(1)),
            Known("Facilities team"), Known(new Money(80, "CAD")), Known("work-order-1"), []);
        var scheduled = completed with {
            Id = Key<MaintenanceTask>("inspection-next"), State = MaintenanceState.Scheduled,
            ScheduledStart = Known(At(1).AddDays(180)), ActualStart = Unknown<DateTimeOffset>(),
            CompletedAt = Unknown<DateTimeOffset>(), ActualCost = Unknown<Money>(), CompletionEvidenceReference = Unknown<string>() };
        var history = new[] { completed, scheduled };
        var assetHistory = from physical in new[] { pump }
                           join registration in new[] { asset } on physical.Element.ObjectId equals registration.ObjectId
                           join task in history on registration.Id equals task.AssetId
                           select new { registration.Id, task.State, task.CompletedAt };

        Assert.That(assetHistory.Count(), Is.EqualTo(2));
        Assert.That(assetHistory.Select(x => x.Id).Distinct().Single(), Is.EqualTo(asset.Id));
        Assert.That(assetHistory.Count(x => x.CompletedAt is Fact<DateTimeOffset>.Known), Is.EqualTo(1));
        Assert.That(scheduled.ActualCost, Is.TypeOf<Fact<Money>.Missing>());
        Assert.That(pump.Ports.Completeness, Is.EqualTo(Completeness.NotObserved),
            "Facilities history remains useful even when source connectivity was not exported.");
    }

    [Test, Category("Feature.Observations"), Category("Workflow.BuildingPerformance")]
    public void MissingEnergySamplesAreNotZeroAndSimulationOptionsRemainDistinct()
    {
        var subject = Ref<BimObject>("building-A");
        var series = new ObservationSeries(Key<ObservationSeries>("metered-energy"), subject, "Hourly import",
            "Imported electrical energy", QuantityUnit.KilowattHour, "Meter register difference", "One-hour interval total",
            Known(new DurationValue(TimeSpan.FromHours(1))), Known("meter-A"), []);
        var samples = new[] {
            new ObservationSample(Key<ObservationSample>("sample-zero"), series.Id, At(1), Known(At(1).AddHours(1)), Known(0m), Known("Valid"), []),
            new ObservationSample(Key<ObservationSample>("sample-missing"), series.Id, At(1).AddHours(1), Known(At(1).AddHours(2)), Unknown<decimal>(), Known("Communications gap"), []),
            new ObservationSample(Key<ObservationSample>("sample-used"), series.Id, At(1).AddHours(2), Known(At(1).AddHours(3)), Known(12m), Known("Valid"), []) };
        var observed = samples.Where(s => s.SeriesId == series.Id).Select(s => s.Value).OfType<Fact<decimal>.Known>().ToArray();
        Assert.That(observed.Sum(s => s.Value), Is.EqualTo(12m));
        Assert.That(observed.Count(s => s.Value == 0), Is.EqualTo(1));
        Assert.That(samples.Count(s => s.Value is Fact<decimal>.Missing), Is.EqualTo(1));

        var baseScenario = new AnalysisScenario(Ref<AnalysisScenario>("simulation-base"), "Baseline", "1", "Compare retrofit options", "Current glazing; fixed weather and occupancy", []);
        var retrofitScenario = baseScenario with { Id = Ref<AnalysisScenario>("simulation-retrofit"), Name = "Retrofit", Assumptions = "Improved glazing; same weather and occupancy" };
        var baseline = new PerformanceResult(Key<PerformanceResult>("annual-base"), subject, baseScenario.Id, "Annual imported energy",
            new Fact<decimal>.Known(20000m, Assurance.Derived, []), QuantityUnit.KilowattHour, Known(At(1)), Known(At(1).AddYears(1)),
            Unknown<SnapshotKey<ObservationSeries>>(), "Synthetic simulation v1", baseScenario.Assumptions, Completeness.Complete, []);
        var retrofit = baseline with { Id = Key<PerformanceResult>("annual-retrofit"), ScenarioId = retrofitScenario.Id,
            Value = new Fact<decimal>.Known(16000m, Assurance.Derived, []), WeatherOccupancyAndBoundaryAssumptions = retrofitScenario.Assumptions };
        var optionValues = new[] { baseline, retrofit }.ToDictionary(x => x.ScenarioId, x => ((Fact<decimal>.Known)x.Value).Value);

        Assert.That(optionValues[baseScenario.Id] - optionValues[retrofitScenario.Id], Is.EqualTo(4000m));
        Assert.That(optionValues.Count, Is.EqualTo(2));
        Assert.That(baseline.SeriesId, Is.TypeOf<Fact<SnapshotKey<ObservationSeries>>.Missing>(),
            "A simulated result need not fabricate a link to a measured series.");
        Assert.That(((Fact<decimal>.Known)baseline.Value).Assurance, Is.EqualTo(Assurance.Derived));
    }

    private static DateTimeOffset At(int day) => new(2026, 1, day, 0, 0, 0, TimeSpan.Zero);

    private static QuantityScope Scope(string id, QuantityScopeKind kind) => new(
        Key<QuantityScope>(id), Ref<BimObject>("wall-01"), kind, id, Known(id), Unknown<SnapshotKey<GeometryRepresentation>>(), LinkSet<QuantityScope>.Unknown(), []);

    private static QuantityObservation Quantity(string id, string scope, decimal kilograms, QuantitySelection selection) => new(
        Key<QuantityObservation>(id), Key<QuantityScope>(scope), QuantityBasis.Net, Known(new Measurement(kilograms, "kg", MeasureKind.Mass)),
        selection, Ref<InterpretationPolicy>("selected-net-mass-v1"), "Synthetic declared mass");

    private static MaterialUse Use(string id, string scope, ContributionRole role, params string[] observationIds) => new(
        Key<MaterialUse>(id), Ref<BimObject>("wall-01"), Ref<Material>(id), Key<QuantityScope>(scope),
        Unknown<ReferenceKey<AssemblyDefinition>>(), Known(scope), role, Unknown<Area>(), Unknown<Volume>(), Unknown<Mass>(),
        Links(observationIds.Select(x => Key<QuantityObservation>(x)).ToArray()), []);
}
