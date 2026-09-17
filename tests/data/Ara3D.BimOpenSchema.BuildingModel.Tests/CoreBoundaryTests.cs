using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Tests.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Review"), Category("Source.Synthetic")]
public sealed class CoreBoundaryTests
{
    [Test, Category("Feature.CoreBoundary"), Category("Workflow.ModelReview")]
    public void CoreModelExcludesLifecycleCommercialAndAnalysisRecords()
    {
        var assembly = typeof(BimObject).Assembly;
        var excluded = new[]
        {
            "AnalysisScenario", "WorkPackage", "WorkPackageAssignment", "RateCatalog", "RateItem", "EstimateLine",
            "EstimateSummary", "ProcurementRequirement", "DeliveryBatch", "DeliveryLine", "Milestone",
            "InstallationObservation", "Asset", "AssetServiceRequirement", "MaintenanceTask", "InspectionObservation",
            "RequirementSet", "Requirement", "Assessment", "Finding", "EnvironmentalFactor", "ImpactLine", "ImpactSummary",
            "ObservationSeries", "ObservationSample", "PerformanceResult", "ObjectChange", "DataIssue", "SpatialConflict",
            "ServiceTraceResult", "ServiceTraceMember", "EgressStudy", "EgressRoute", "EgressRouteStep", "EgressAssessment",
            "AcousticResult", "AcousticBandResult", "ServiceAccessEnvelope", "QuantityTakeoff", "ModelViolation"
        };

        Assert.That(excluded.Select(name => assembly.GetType($"Ara3D.BimOpenSchema.BuildingModel.{name}")), Is.All.Null);
    }

    [Test, Category("Feature.Evidence"), Category("Workflow.DataReview")]
    public void KnownZeroAndUnknownRemainDifferentCoreAnswers()
    {
        Assert.That(Known(new Area(0)), Is.TypeOf<Fact<Area>.Known>());
        Assert.That(Unknown<Area>(), Is.TypeOf<Fact<Area>.Missing>());
        Assert.That(Fact<Area>.Inapplicable("No surface in this scope"), Is.Not.EqualTo(Unknown<Area>()));
        Assert.That(Known(false), Is.Not.EqualTo(Unknown<bool>()));
        Assert.That(Links<Door>().Completeness, Is.EqualTo(Completeness.Complete));
        Assert.That(LinkSet<Door>.Unknown().Completeness, Is.EqualTo(Completeness.NotObserved));
    }
}
