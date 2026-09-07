using Ara3D.BimOpenSchema.BuildingModel;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;
using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.Operations.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.Operations;

[Impure, TestFixture, Category("Source.Synthetic"), Category("Size.Small")]
public sealed class LifecycleTests
{
    [Test]
    public void ReplacementKeepsPriorHistoryAndDoesNotTransferCompletionToNewAsset()
    {
        var completed = DateTimeOffset.Parse("2026-02-01T12:00:00Z");
        var request = new MaintenanceRequest(DateTimeOffset.Parse("2026-03-15T00:00:00Z"),
            [Asset("old"), Asset("new") with { InServiceDate = Known(new DateOnly(2026, 3, 1)) }],
            [Service("old"), Service("new")], [Task("old-service", "old", completed)],
            [new(Key<Asset>("old"), Key<Asset>("new"), DateTimeOffset.Parse("2026-03-01T00:00:00Z"), Ref<Evidence>("replacement-log"))], Completeness.Complete);
        var result = OperationsWorkflows.Maintain(request);
        Assert.That(result.Assets.Single(a => a.Asset.Id.Value == "old").RetiredByReplacement, Is.True);
        Assert.That(result.Assets.Single(a => a.Asset.Id.Value == "old").History.Length, Is.EqualTo(1));
        Assert.That(result.Assets.Single(a => a.Asset.Id.Value == "new").History, Is.Empty);
        Assert.That(result.WorkList.Single().Asset, Is.EqualTo(Key<Asset>("new")));
        Assert.That(Value(result.WorkList.Single().DueAt), Is.EqualTo(DateTimeOffset.Parse("2026-03-31T00:00:00Z")));
        Assert.That(Value(result.WorkList.Single().IsDue), Is.False);
    }

    [Test]
    public void MissingHistoryAndUnevidencedCompletionKeepDueStateUnknown()
    {
        var request = new MaintenanceRequest(DateTimeOffset.Parse("2026-03-01T00:00:00Z"), [Asset("pump")], [Service("pump")], [], [], Completeness.NotObserved);
        var result = OperationsWorkflows.Maintain(request);
        Assert.That(result.WorkList[0].IsDue, Is.TypeOf<Fact<bool>.Missing>());
        Assert.That(result.Assets[0].MissingFields, Is.EquivalentTo(new[] { "SerialNumber", "MaintenanceManualReference", "SpaceId" }));
        var task = Task("service", "pump", DateTimeOffset.Parse("2026-01-15T00:00:00Z")) with { CompletionEvidenceReference = Unknown<string>() };
        var unsupported = OperationsWorkflows.Maintain(request with { HistoryCoverage = Completeness.Complete, Tasks = [task] });
        Assert.That(unsupported.WorkList[0].DueAt, Is.TypeOf<Fact<DateTimeOffset>.Missing>());
    }

    [Test]
    public void ElapsedServiceIntervalUsesFixedAsOfAndLatestEvidencedCompletion()
    {
        var request = new MaintenanceRequest(DateTimeOffset.Parse("2026-03-15T12:00:00Z"), [Asset("pump")], [Service("pump")],
            [Task("first", "pump", DateTimeOffset.Parse("2026-01-15T12:00:00Z")), Task("latest", "pump", DateTimeOffset.Parse("2026-02-10T12:00:00Z"))], [], Completeness.Complete);
        var result = OperationsWorkflows.Maintain(request);
        Assert.That(Value(result.WorkList[0].DueAt), Is.EqualTo(DateTimeOffset.Parse("2026-03-12T12:00:00Z")));
        Assert.That(Value(result.WorkList[0].IsDue), Is.True);
    }

    [Test]
    public void DuplicatePhysicalAssetAndCyclicReplacementsAreRejected()
    {
        var now = DateTimeOffset.Parse("2026-03-01T00:00:00Z");
        var request = new MaintenanceRequest(now, [Asset("a"), Asset("b") with { ObjectId = Ref<BimObject>("a") }], [], [], [], Completeness.Complete);
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Maintain(request));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Maintain(request with { Assets = [Asset("a"), Asset("b")], Replacements = [new(Key<Asset>("a"), Key<Asset>("b"), now, Ref<Evidence>("r")), new(Key<Asset>("b"), Key<Asset>("a"), now.AddDays(1), Ref<Evidence>("r"))] }));
    }

    [Test]
    public void CarbonCountsSelectedLeavesOnceAndExcludesAssemblyTotal()
    {
        var assembly = Contribution("assembly", Known(100m)) with { MaterialUse = Material("assembly", ContributionRole.AssemblyTotal) };
        var result = OperationsWorkflows.Carbon(CarbonRequest(Contribution("first", Known(3m)), Contribution("second", Known(5m)), assembly));
        Assert.That(Value(result.Summary.TotalKilogramsCo2Equivalent), Is.EqualTo(16m));
        Assert.That(result.Lines.Length, Is.EqualTo(2));
        Assert.That(result.ExcludedNonLeafContributions, Is.EqualTo(new[] { Key<MaterialUse>("assembly") }));
    }

    [Test]
    public void MissingFactorOrQuantityAndKnownZeroRemainDifferent()
    {
        var result = OperationsWorkflows.Carbon(CarbonRequest(Contribution("zero", Known(0m)), Contribution("quantity", Unknown<decimal>()),
            Contribution("factor", Known(3m)) with { Factor = Unknown<EnvironmentalFactor>() }));
        Assert.That(Value(result.Lines[0].KilogramsCo2Equivalent), Is.Zero);
        Assert.That(result.Summary.CalculatedLineCount, Is.EqualTo(1));
        Assert.That(result.Summary.MissingQuantityCount, Is.EqualTo(1));
        Assert.That(result.Summary.MissingFactorCount, Is.EqualTo(1));
        Assert.That(result.Summary.TotalKilogramsCo2Equivalent, Is.TypeOf<Fact<decimal>.Missing>());
    }

    [Test]
    public void IncompatibleFactorUnitsAndModulesCannotEnterSupportedSubtotal()
    {
        var result = OperationsWorkflows.Carbon(CarbonRequest(
            Contribution("unit", Known(3m)) with { Factor = Known(Factor() with { Unit = QuantityUnit.CubicMetre }) },
            Contribution("module", Known(4m)) with { Factor = Known(Factor() with { ModuleCode = "A4" }) }));
        Assert.That(Value(result.Summary.KnownKilogramsCo2Equivalent), Is.Zero);
        Assert.That(result.Summary.CalculatedLineCount, Is.Zero);
        Assert.That(result.Summary.Coverage, Is.EqualTo(Completeness.Partial));
    }

    [Test]
    public void FactorVersionCreatesIndependentScenarioAndOverlappingScopesAreRejected()
    {
        var request = CarbonRequest(Contribution("leaf", Known(5m)));
        var first = OperationsWorkflows.Carbon(request);
        var second = OperationsWorkflows.Carbon(request with { Scenario = Scenario("2"), Contributions = [request.Contributions[0] with { Factor = Known(Factor(3) with { Id = Ref<EnvironmentalFactor>("factor-v2"), Version = "2" }) }] });
        Assert.That(Value(first.Summary.TotalKilogramsCo2Equivalent), Is.EqualTo(10m));
        Assert.That(Value(second.Summary.TotalKilogramsCo2Equivalent), Is.EqualTo(15m));
        Assert.That(first.Lines[0].FactorId, Is.Not.EqualTo(second.Lines[0].FactorId));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Carbon(request with { Contributions = [request.Contributions[0], Contribution("other", Known(2m)) with { ExclusiveScope = "leaf" }] }));
    }

    [Test]
    public void AssemblyWithoutMeasuredLeavesCannotBecomeCompleteZeroCarbon()
    {
        var assembly = Contribution("assembly", Known(100m)) with { MaterialUse = Material("assembly", ContributionRole.AssemblyTotal) };
        var result = OperationsWorkflows.Carbon(CarbonRequest(assembly));
        Assert.That(result.Summary.TotalKilogramsCo2Equivalent, Is.TypeOf<Fact<decimal>.Missing>());
        Assert.That(result.ExcludedNonLeafContributions.Length, Is.EqualTo(1));
    }

    [Test]
    public void ArchitecturalProjectionDoesNotInventOperationalInputs()
    {
        var projection = new BuildingProjection(new(Ref<ModelSnapshot>("architectural"), "Architectural projection", "1", [], [], DateTimeOffset.UnixEpoch),
            [], [], [], [], [], [], [], [], [], [], [], [], []);
        var reports = OperationsWorkflows.InputRequirements(projection);
        Assert.That(reports.Select(r => r.Id), Is.EqualTo(new[] { "04", "05", "06", "07", "08", "09" }));
        Assert.That(reports.All(r => r.Status == WorkflowStatus.RequiresInput), Is.True);
        Assert.That(reports.All(r => r.Rows.IsEmpty && !r.Findings.IsEmpty), Is.True);
    }
}
