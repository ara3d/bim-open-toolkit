using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>Assessment conclusion is separate from evidence completeness; insufficient input must not imply a pass.</summary>
public enum AssessmentOutcome { Unknown, Pass, Fail, NotApplicable }
/// <summary>A finding's severity is a judgment under an identified method or requirement, not a hard-coded safety classification.</summary>
public enum FindingSeverity { Information, Minor, Major, Critical, Unclassified }
/// <summary>Maintenance work lifecycle, distinct from the operational condition of an asset.</summary>
public enum MaintenanceState { Proposed, Scheduled, InProgress, Completed, Deferred, Cancelled, Unknown }
/// <summary>Inspection condition uses coarse reporting categories; the observed description preserves the original detail.</summary>
public enum AssetCondition { Good, Fair, Poor, Failed, Unknown, NotApplicable }
/// <summary>Environmental reporting stages. ModuleCode preserves more specific distinctions such as A1, A4 or B6.</summary>
public enum LifeCycleStage { Product, Construction, Use, EndOfLife, BeyondSystemBoundary, Other }

/// <summary>One maintainable asset registration in a snapshot. The BimObject identity also relates its geometry, installation and source records.</summary>
/// <remarks><c>AssetTag</c>: Operational tag; it need not equal a model element's source identifier.</remarks>
/// <remarks><c>InServiceDate</c>: Unknown dates remain unavailable and are not inferred from the model's creation date.</remarks>
public sealed record Asset(
    SnapshotKey<Asset> Id,
    ReferenceKey<BimObject> ObjectId,
    string Name,
    Fact<string> AssetTag,
    Fact<ReferenceKey<ProductDefinition>> ProductId,
    Fact<string> Manufacturer,
    Fact<string> ModelNumber,
    Fact<string> SerialNumber,
    Fact<SnapshotKey<Space>> SpaceId,
    Fact<string> ResponsibleOrganization,
    Fact<DateOnly> InServiceDate,
    Fact<DateOnly> WarrantyEndDate,
    Fact<DurationValue> ExpectedServiceLife,
    Fact<string> MaintenanceManualReference,
    Fact<string> CriticalityClassification,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One maintenance obligation for an asset, from an explicitly identified manufacturer, regulation or owner policy.</summary>
/// <remarks><c>Interval</c>: Elapsed time between services if time-based. Usage-based triggers belong in TriggerDescription.</remarks>
public sealed record AssetServiceRequirement(
    SnapshotKey<AssetServiceRequirement> Id,
    SnapshotKey<Asset> AssetId,
    string Name,
    Fact<ReferenceKey<Requirement>> RequirementId,
    string TriggerDescription,
    Fact<DurationValue> Interval,
    Fact<string> RequiredCompetency,
    Fact<Length> AccessClearance,
    string ProcedureReference,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One planned or performed service action for an asset. Scheduled and actual times are kept independently.</summary>
public sealed record MaintenanceTask(
    SnapshotKey<MaintenanceTask> Id,
    SnapshotKey<Asset> AssetId,
    Fact<SnapshotKey<AssetServiceRequirement>> ServiceRequirementId,
    string Description,
    MaintenanceState State,
    Fact<DateTimeOffset> ScheduledStart,
    Fact<DateTimeOffset> ActualStart,
    Fact<DateTimeOffset> CompletedAt,
    Fact<string> AssignedOrganization,
    Fact<Money> ActualCost,
    Fact<string> CompletionEvidenceReference,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One observation of an object at a particular time and inspection scope, independent of a compliance decision.</summary>
public sealed record InspectionObservation(
    SnapshotKey<InspectionObservation> Id,
    ReferenceKey<BimObject> ObjectId,
    Fact<SnapshotKey<Asset>> AssetId,
    DateTimeOffset ObservedAt,
    string InspectionScope,
    string Observation,
    AssetCondition Condition,
    Fact<string> Inspector,
    Fact<DateTimeOffset> RecommendedReinspectionDate,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One versioned external collection of requirements; jurisdiction, edition and applicability are never inferred from model location alone.</summary>
public sealed record RequirementSet(
    ReferenceKey<RequirementSet> Id,
    string Name,
    string Version,
    string Authority,
    Fact<string> Jurisdiction,
    Fact<DateOnly> EffectiveFrom,
    Fact<DateOnly> EffectiveUntil,
    string Reference,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One requirement clause or explicit client criterion. Natural-language applicability and required evidence precede any executable rule.</summary>
public sealed record Requirement(
    ReferenceKey<Requirement> Id,
    ReferenceKey<RequirementSet> RequirementSetId,
    string Clause,
    string Title,
    string RequirementText,
    string Applicability,
    string RequiredEvidence,
    string EvaluationMethod,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One requirement evaluated for one subject and scenario. This stores a result; it does not assert that an automated compliance engine exists.</summary>
/// <remarks><c>InputCoverage</c>: Incomplete input generally produces Unknown; a Fail may be supported by a conclusive counterexample despite partial coverage.</remarks>
/// <remarks><c>EvaluationMethod</c>: Identifies rule implementation and version, or the responsible manual evaluation procedure.</remarks>
public sealed record Assessment(
    SnapshotKey<Assessment> Id,
    ReferenceKey<BimObject> SubjectId,
    ReferenceKey<Requirement> RequirementId,
    ReferenceKey<AnalysisScenario> ScenarioId,
    AssessmentOutcome Outcome,
    Completeness InputCoverage,
    string Reason,
    string EvaluationMethod,
    Fact<DateTimeOffset> EvaluatedAt,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One actionable issue raised by an inspection, assessment or manual observation; one assessment can have several findings.</summary>
public sealed record Finding(
    SnapshotKey<Finding> Id,
    ReferenceKey<BimObject> SubjectId,
    Fact<SnapshotKey<Assessment>> AssessmentId,
    Fact<SnapshotKey<InspectionObservation>> InspectionId,
    string Title,
    string Description,
    FindingSeverity Severity,
    Fact<string> ResponsibleOrganization,
    Fact<DateTimeOffset> DueAt,
    Fact<DateTimeOffset> ResolvedAt,
    Fact<string> Resolution,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One versioned environmental coefficient for one material/product, impact indicator, lifecycle module and declared unit.</summary>
/// <remarks><c>KilogramsCo2EquivalentPerUnit</c>: Climate-change impact per declared Unit. Negative values require a documented allocation or biogenic-carbon method.</remarks>
/// <remarks><c>ModuleCode</c>: For example A1-A3 or A4. Overlapping module ranges cannot be added without an accounting policy.</remarks>
public sealed record EnvironmentalFactor(
    ReferenceKey<EnvironmentalFactor> Id,
    string Publication,
    string Version,
    string Authority,
    string ProductOrMaterialDescription,
    Fact<ReferenceKey<Material>> MaterialId,
    Fact<ReferenceKey<ProductDefinition>> ProductId,
    LifeCycleStage Stage,
    string ModuleCode,
    QuantityUnit Unit,
    Fact<decimal> KilogramsCo2EquivalentPerUnit,
    string ImpactMethod,
    string Geography,
    Fact<DateOnly> ValidUntil,
    string AllocationAndBoundaryRule,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One environmental contribution for one selected material-use scope, lifecycle module and scenario. Multiple representations do not create new contributions.</summary>
/// <remarks><c>KilogramsCo2Equivalent</c>: Calculated impact in kg CO2e, unavailable when quantity or compatible factor is missing.</remarks>
public sealed record ImpactLine(
    SnapshotKey<ImpactLine> Id,
    SnapshotKey<MaterialUse> MaterialUseId,
    ReferenceKey<AnalysisScenario> ScenarioId,
    Fact<ReferenceKey<EnvironmentalFactor>> FactorId,
    Fact<SnapshotKey<QuantityObservation>> QuantityObservationId,
    string AccountingScope,
    LifeCycleStage Stage,
    string ModuleCode,
    Fact<decimal> DeclaredQuantity,
    QuantityUnit Unit,
    Fact<decimal> KilogramsCo2Equivalent,
    Completeness InputCoverage,
    string CalculationMethod,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One impact aggregation for a scope, scenario and explicitly nonoverlapping module selection; known subtotal is never presented as a complete assessment.</summary>
public sealed record ImpactSummary(
    SnapshotKey<ImpactSummary> Id,
    ReferenceKey<AnalysisScenario> ScenarioId,
    string AccountingScope,
    ImmutableArray<string> IncludedModules,
    string ImpactMethod,
    Fact<decimal> KnownKilogramsCo2Equivalent,
    Fact<decimal> TotalKilogramsCo2Equivalent,
    long CalculatedLineCount,
    long MissingQuantityCount,
    long MissingFactorCount,
    Completeness Coverage,
    string InclusionAndAllocationRule,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One time-series definition, without embedding its samples. The quantity, unit, aggregation and sensor/model provenance give samples meaning.</summary>
public sealed record ObservationSeries(
    SnapshotKey<ObservationSeries> Id,
    ReferenceKey<BimObject> SubjectId,
    string Name,
    string ObservedQuantity,
    QuantityUnit Unit,
    string ObservationMethod,
    string TemporalAggregation,
    Fact<DurationValue> ExpectedSamplingInterval,
    Fact<string> SensorOrSimulationReference,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One scalar sample or interval value in a series. Missing samples and rejected values are represented explicitly when known.</summary>
/// <remarks><c>IntervalEnd</c>: Unavailable for instantaneous samples; otherwise the interval is [Timestamp, IntervalEnd).</remarks>
/// <remarks><c>Value</c>: Expressed in the linked series' Unit; a missing sample is not zero consumption.</remarks>
public sealed record ObservationSample(
    SnapshotKey<ObservationSample> Id,
    SnapshotKey<ObservationSeries> SeriesId,
    DateTimeOffset Timestamp,
    Fact<DateTimeOffset> IntervalEnd,
    Fact<decimal> Value,
    Fact<string> QualityFlag,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One measured or simulated performance metric for a subject, period and scenario. Different weather, occupancy and boundary assumptions remain separate.</summary>
public sealed record PerformanceResult(
    SnapshotKey<PerformanceResult> Id,
    ReferenceKey<BimObject> SubjectId,
    ReferenceKey<AnalysisScenario> ScenarioId,
    string Metric,
    Fact<decimal> Value,
    QuantityUnit Unit,
    Fact<DateTimeOffset> PeriodStart,
    Fact<DateTimeOffset> PeriodEnd,
    Fact<SnapshotKey<ObservationSeries>> SeriesId,
    string MethodAndVersion,
    string WeatherOccupancyAndBoundaryAssumptions,
    Completeness InputCoverage,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);
