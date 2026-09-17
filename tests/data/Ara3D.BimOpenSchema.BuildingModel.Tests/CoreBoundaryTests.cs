using System.Reflection;
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

    [Test, Category("Feature.CoreBoundary"), Category("Workflow.ModelReview")]
    public void CoreModelReferencesOnlyTheBaseLibrary()
    {
        var foreign = typeof(BimObject).Assembly.GetReferencedAssemblies()
            .Select(a => a.Name!)
            .Where(n => n != "netstandard" && n != "mscorlib" && !n.StartsWith("System"))
            .ToList();
        Assert.That(foreign, Is.Empty, string.Join(", ", foreign));
    }

    [Test, Category("Feature.CoreBoundary"), Category("Workflow.ModelReview")]
    public void CoreModelDeclaresNoBehaviorBeyondFactories()
    {
        var offenders = typeof(BimObject).Assembly.GetExportedTypes()
            .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Static)
                .Where(m => !m.IsSpecialName && !IsRecordMember(m) && !IsFactory(m))
                .Select(m => $"{t.Name}.{m.Name}"))
            .ToList();
        Assert.That(offenders, Is.Empty, string.Join(", ", offenders));
    }

    static readonly string[] RecordMembers = ["Equals", "GetHashCode", "ToString", "Deconstruct", "PrintMembers", "<Clone>$"];

    static bool IsRecordMember(MethodInfo m) => RecordMembers.Contains(m.Name);

    static bool IsFactory(MethodInfo m)
        => m.IsStatic && m.DeclaringType != null && Definition(m.ReturnType) == Definition(m.DeclaringType);

    static Type Definition(Type t) => t.IsGenericType ? t.GetGenericTypeDefinition() : t;

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
