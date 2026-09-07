using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>Units for commercial or scalar observations. These are explicit units, not an implicit conversion policy.</summary>
public enum QuantityUnit { Count, Metre, SquareMetre, CubicMetre, Litre, Kilogram, Hour, Day, KilowattHour, Kilowatt, KilowattHourPerSquareMetre, WattPerSquareMetre, LitrePerSecond, CubicMetrePerSecond, Celsius, Pascal, Volt, Ampere, Lux, PartsPerMillion, KilogramCo2Equivalent, KilogramCo2EquivalentPerSquareMetre, Ratio }
/// <summary>Delivery and installation states describe observed progress; missing observations do not mean not delivered or not installed.</summary>
public enum DeliveryState { Expected, Received, PartiallyReceived, Rejected, Returned, Unknown }
/// <summary>Trade assignment supports selection and reporting; it does not prescribe contractual responsibility.</summary>
public enum Trade { General, Demolition, Earthworks, Concrete, Steel, Timber, Roofing, Facade, Glazing, Doors, Drywall, Flooring, Painting, Electrical, Mechanical, Plumbing, FireProtection, Controls, Landscaping, Other, Unassigned }
/// <summary>An estimate can carry a known subtotal while remaining incomplete.</summary>
public enum PricingState { Unpriced, Priced, PartiallyPriced, NotApplicable }
/// <summary>Progress observations remain distinct from forecast and schedule state.</summary>
public enum InstallationState { NotStarted, InProgress, Installed, Tested, Accepted, ReworkRequired, Removed, Unknown }

/// <summary>One explicit analysis assumption set. Version and purpose distinguish competing bids, design options and reporting scenarios.</summary>
public sealed record AnalysisScenario(
    ReferenceKey<AnalysisScenario> Id,
    string Name,
    string Version,
    string Purpose,
    string Assumptions,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One scope of work in one snapshot; membership is stored separately so large packages need not be expanded into an object graph.</summary>
/// <remarks><c>ScopeRule</c>: Human-readable inclusion/exclusion rule, such as roof membrane only, excluding insulation and flashings.</remarks>
/// <remarks><c>AccountingScope</c>: Identifier for an aggregation boundary. Overlapping scopes must not be silently added together.</remarks>
public sealed record WorkPackage(
    SnapshotKey<WorkPackage> Id,
    string Code,
    string Name,
    Trade Trade,
    Fact<string> ResponsibleOrganization,
    Fact<SnapshotKey<WorkPackage>> ParentPackage,
    string ScopeRule,
    string AccountingScope,
    Completeness MembershipCompleteness,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One object's contribution to a work package. Separate rows can describe distinct parts of the same object.</summary>
/// <remarks><c>PartDescription</c>: Explicit part or activity, for example supply door assembly versus install hardware.</remarks>
/// <remarks><c>Allocation</c>: Dimensionless share when a quantity is allocated across packages; unknown is not one.</remarks>
public sealed record WorkPackageAssignment(
    SnapshotKey<WorkPackageAssignment> Id,
    SnapshotKey<WorkPackage> WorkPackageId,
    ReferenceKey<BimObject> ObjectId,
    string PartDescription,
    Fact<Ratio> Allocation,
    Fact<SnapshotKey<QuantityObservation>> QuantityId,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One immutable, versioned external price publication or quotation. Every item inherits its authority and pricing context.</summary>
/// <remarks><c>Currency</c>: ISO 4217 currency code; conversion requires a separate dated exchange-rate policy.</remarks>
public sealed record RateCatalog(
    ReferenceKey<RateCatalog> Id,
    string Name,
    string Version,
    string Authority,
    string Currency,
    Fact<string> Geography,
    Fact<DateOnly> EffectiveFrom,
    Fact<DateOnly> EffectiveUntil,
    string PriceBasis,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One priced activity or product per stated unit in a versioned catalog, with explicitly documented inclusions.</summary>
/// <remarks><c>UnitPrice</c>: Money per one PricingUnit, not a line total. Unknown rates must remain unavailable.</remarks>
public sealed record RateItem(
    ReferenceKey<RateItem> Id,
    ReferenceKey<RateCatalog> CatalogId,
    string Code,
    string Description,
    Trade Trade,
    QuantityUnit PricingUnit,
    Fact<Money> UnitPrice,
    string Inclusions,
    string Exclusions,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One cost contribution for one package, scope and scenario. Quantity, rate matching, unit conversion and rounding remain explicit.</summary>
/// <remarks><c>Quantity</c>: Selected measured amount expressed in Unit before waste. Bounds and duplicate geometry are not measurement quantities.</remarks>
/// <remarks><c>WasteFraction</c>: Dimensionless additional quantity, such as 0.10 for ten percent; applied once.</remarks>
/// <remarks><c>RateItemId</c>: Unavailable when no suitable rate has been found; no fabricated catalog key is required.</remarks>
/// <remarks><c>TotalCost</c>: Unavailable for an unpriced line. Zero represents an explicitly evaluated zero cost.</remarks>
public sealed record EstimateLine(
    SnapshotKey<EstimateLine> Id,
    SnapshotKey<WorkPackage> WorkPackageId,
    ReferenceKey<AnalysisScenario> ScenarioId,
    Fact<SnapshotKey<QuantityObservation>> QuantityObservationId,
    string Description,
    string AccountingScope,
    Fact<decimal> Quantity,
    QuantityUnit Unit,
    Fact<Ratio> WasteFraction,
    Fact<ReferenceKey<RateItem>> RateItemId,
    Fact<Money> AppliedUnitPrice,
    Fact<Money> TotalCost,
    PricingState PricingState,
    string CalculationAndRoundingRule,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One estimate aggregation per scenario, package, currency and accounting scope. Known subtotal and completeness travel together.</summary>
/// <remarks><c>KnownSubtotal</c>: Sum of evaluated contributions only; this is not a complete project price when Coverage is partial.</remarks>
/// <remarks><c>TotalCost</c>: Complete total, unavailable unless required scope is sufficiently priced under the declared inclusion rule.</remarks>
public sealed record EstimateSummary(
    SnapshotKey<EstimateSummary> Id,
    SnapshotKey<WorkPackage> WorkPackageId,
    ReferenceKey<AnalysisScenario> ScenarioId,
    string AccountingScope,
    string Currency,
    Fact<Money> KnownSubtotal,
    Fact<Money> TotalCost,
    long PricedLineCount,
    long UnpricedLineCount,
    long IncompleteLineCount,
    Completeness Coverage,
    string InclusionRule,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One required product or service for one work package and scenario, before selection of a supplier or delivery.</summary>
/// <remarks><c>RequiredQuantity</c>: Amount in Unit, including allowances only when QuantityBasis says so.</remarks>
public sealed record ProcurementRequirement(
    SnapshotKey<ProcurementRequirement> Id,
    SnapshotKey<WorkPackage> WorkPackageId,
    ReferenceKey<AnalysisScenario> ScenarioId,
    string Description,
    Fact<ReferenceKey<ProductDefinition>> ProductId,
    Fact<decimal> RequiredQuantity,
    QuantityUnit Unit,
    string QuantityBasis,
    Fact<DateOnly> RequiredOnSiteDate,
    Fact<string> SubstitutionRule,
    ImmutableArray<ReferenceKey<BimObject>> IntendedObjects,
    Completeness IntendedObjectCoverage,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One shipment or receipt event. Lines relate the shipment to requirements; dates distinguish planned delivery from observed receipt.</summary>
public sealed record DeliveryBatch(
    SnapshotKey<DeliveryBatch> Id,
    string DeliveryReference,
    Fact<string> Supplier,
    Fact<string> Carrier,
    Fact<DateTimeOffset> PlannedArrival,
    Fact<DateTimeOffset> ReceivedAt,
    Fact<ReferenceKey<BimObject>> ReceivingPlaceId,
    DeliveryState State,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One requirement/product/lot contribution to a shipment. Multiple receipts must be reconciled by delivery reference before aggregation.</summary>
public sealed record DeliveryLine(
    SnapshotKey<DeliveryLine> Id,
    SnapshotKey<DeliveryBatch> BatchId,
    Fact<SnapshotKey<ProcurementRequirement>> RequirementId,
    Fact<ReferenceKey<ProductDefinition>> ProductId,
    Fact<string> LotOrSerialReference,
    Fact<decimal> OrderedQuantity,
    Fact<decimal> ReceivedQuantity,
    Fact<decimal> AcceptedQuantity,
    QuantityUnit Unit,
    DeliveryState State,
    Fact<string> Discrepancy,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One dated observation of one object's installation state and activity, not a continuously overwritten status field.</summary>
/// <remarks><c>ProgressFraction</c>: Measured completion from zero to one under ProgressBasis; it is not elapsed schedule fraction.</remarks>
public sealed record InstallationObservation(
    SnapshotKey<InstallationObservation> Id,
    ReferenceKey<BimObject> ObjectId,
    Fact<SnapshotKey<WorkPackage>> WorkPackageId,
    DateTimeOffset ObservedAt,
    string Activity,
    InstallationState State,
    Fact<Ratio> ProgressFraction,
    string ProgressBasis,
    Fact<string> Observer,
    Fact<string> Comment,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One named schedule checkpoint in one scenario; baseline, forecast and actual dates have separate meanings.</summary>
public sealed record Milestone(
    SnapshotKey<Milestone> Id,
    ReferenceKey<AnalysisScenario> ScenarioId,
    Fact<SnapshotKey<WorkPackage>> WorkPackageId,
    string Name,
    Fact<DateTimeOffset> BaselineDate,
    Fact<DateTimeOffset> ForecastDate,
    Fact<DateTimeOffset> ActualDate,
    LinkSet<Milestone> Predecessors,
    string CompletionCriterion,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);
