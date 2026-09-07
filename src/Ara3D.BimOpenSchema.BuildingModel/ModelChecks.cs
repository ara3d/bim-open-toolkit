using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>One deterministic validation finding. Field identifies the relevant property; Code supports tests and downstream reporting.</summary>
public sealed record ModelViolation(string Code, string Field, string Message);

/// <summary>Small, pure consistency checks for selected workflow records. Findings are returned without changing the supplied records.</summary>
/// <remarks>
/// These checks are not a complete import validator, referential-integrity engine, quantity calculator or engineering assessment.
/// They do not resolve evidence, establish physical truth, apply code requirements, reconcile scope or recompute money.
/// Unknown values remain unknown. Known partial subtotals are permitted while purported complete totals require adequate coverage.
/// Callers must also validate nonnull record fields, valid keys, enum values and available fact payloads at their ingestion boundary.
/// </remarks>
public static class ModelChecks
{
    /// <summary>Checks pricing state, required numerical inputs, waste range and the currencies of the applied price and total.</summary>
    /// <remarks>An applied manual price may have its own evidence without a rate-item reference; reference existence and rate matching are separate checks.</remarks>
    public static ImmutableArray<ModelViolation> Validate(EstimateLine line) => OnlyFailures([
        Check(line.PricingState != PricingState.Priced && line.TotalCost is Fact<Money>.Known,
            "estimate.unpriced-total", nameof(line.TotalCost), "An unpriced, partially priced or inapplicable line cannot report a complete total."),
        Check(line.PricingState == PricingState.Priced && line.Quantity is not Fact<decimal>.Known,
            "estimate.missing-quantity", nameof(line.Quantity), "A priced line requires an available quantity."),
        Check(line.PricingState == PricingState.Priced && line.WasteFraction is not Fact<Ratio>.Known,
            "estimate.missing-waste", nameof(line.WasteFraction), "A priced line requires an explicit waste fraction, including an explicit zero when appropriate."),
        Check(line.PricingState == PricingState.Priced && line.AppliedUnitPrice is not Fact<Money>.Known,
            "estimate.missing-price", nameof(line.AppliedUnitPrice), "A priced line requires an available applied unit price."),
        Check(line.PricingState == PricingState.Priced && line.TotalCost is not Fact<Money>.Known,
            "estimate.missing-total", nameof(line.TotalCost), "A priced line requires an available total."),
        Check(line.WasteFraction is Fact<Ratio>.Known waste && (!double.IsFinite(waste.Value.Value) || waste.Value.Value < 0),
            "estimate.invalid-waste", nameof(line.WasteFraction), "Waste fraction must be finite and nonnegative; it has no universal maximum of one."),
        Check(line.AppliedUnitPrice is Fact<Money>.Known price && line.TotalCost is Fact<Money>.Known total
            && !string.Equals(price.Value.Currency, total.Value.Currency, StringComparison.Ordinal),
            "estimate.currency-mismatch", nameof(line.TotalCost), "Applied price and total must use the same currency; exchange-rate conversion requires a separate calculation.")
    ]);

    /// <summary>Checks summary currency, nonnegative counts and whether a complete total conceals known coverage gaps. Does not aggregate lines.</summary>
    public static ImmutableArray<ModelViolation> Validate(EstimateSummary summary) => OnlyFailures([
        Check(summary.PricedLineCount < 0,
            "estimate.negative-count", nameof(summary.PricedLineCount), "Priced line count cannot be negative."),
        Check(summary.UnpricedLineCount < 0,
            "estimate.negative-count", nameof(summary.UnpricedLineCount), "Unpriced line count cannot be negative."),
        Check(summary.IncompleteLineCount < 0,
            "estimate.negative-count", nameof(summary.IncompleteLineCount), "Incomplete line count cannot be negative."),
        Check(summary.TotalCost is Fact<Money>.Known && summary.Coverage != Completeness.Complete,
            "estimate.incomplete-total", nameof(summary.TotalCost), "Only a completely covered scope may report a complete total; a known subtotal can still be reported."),
        Check(summary.Coverage == Completeness.Complete && (summary.UnpricedLineCount > 0 || summary.IncompleteLineCount > 0),
            "estimate.contradictory-coverage", nameof(summary.Coverage), "Complete pricing coverage contradicts unresolved or unpriced line counts."),
        Check(summary.TotalCost is Fact<Money>.Known && (summary.UnpricedLineCount > 0 || summary.IncompleteLineCount > 0),
            "estimate.unresolved-total", nameof(summary.TotalCost), "A complete total cannot conceal unpriced or incomplete lines."),
        Check(summary.KnownSubtotal is Fact<Money>.Known subtotal && !string.Equals(subtotal.Value.Currency, summary.Currency, StringComparison.Ordinal),
            "estimate.currency-mismatch", nameof(summary.KnownSubtotal), "Known subtotal must use the summary currency."),
        Check(summary.TotalCost is Fact<Money>.Known total && !string.Equals(total.Value.Currency, summary.Currency, StringComparison.Ordinal),
            "estimate.currency-mismatch", nameof(summary.TotalCost), "Total must use the summary currency.")
    ]);

    /// <summary>Checks that bounding-box candidates do not claim solid intersection volume, and that pair identity and tolerance are meaningful.</summary>
    /// <remarks>Passing these checks does not prove that geometry is a solid, that coordinate frames agree, or that a clash is physically present.</remarks>
    public static ImmutableArray<ModelViolation> Validate(SpatialConflict conflict) => OnlyFailures([
        Check(conflict.Kind == SpatialConflictKind.BoundsCandidate && conflict.IntersectionVolume is Fact<Volume>.Known,
            "spatial.bounds-not-solid", nameof(conflict.IntersectionVolume), "A bounding-box candidate cannot establish solid intersection volume, including zero."),
        Check(!double.IsFinite(conflict.Tolerance.Metres) || conflict.Tolerance.Metres < 0,
            "spatial.invalid-tolerance", nameof(conflict.Tolerance), "Tolerance must be finite and nonnegative metres."),
        Check(conflict.FirstObjectId == conflict.SecondObjectId,
            "spatial.same-object", nameof(conflict.SecondObjectId), "A pair conflict requires two different object identities; self-intersection is a separate analysis.")
    ]);

    /// <summary>Checks a trace member against its owning result, including snapshot consistency and the evidence needed to claim non-reachability.</summary>
    /// <remarks>Complete topology is a scoped assertion supplied by the caller. This method does not verify connections or perform traversal.</remarks>
    public static ImmutableArray<ModelViolation> Validate(ServiceTraceMember member, ServiceTraceResult trace) => OnlyFailures([
        Check(member.TraceId != trace.Id,
            "trace.wrong-owner", nameof(member.TraceId), "The member must reference the supplied trace result."),
        Check(member.Id.SnapshotId != trace.Id.SnapshotId,
            "trace.snapshot-mismatch", nameof(member.Id), "Trace and member must belong to the same snapshot."),
        Check(member.PortId.SnapshotId != trace.Id.SnapshotId,
            "trace.snapshot-mismatch", nameof(member.PortId), "The evaluated port must belong to the trace snapshot."),
        Check(trace.StartPortId.SnapshotId != trace.Id.SnapshotId,
            "trace.snapshot-mismatch", nameof(trace.StartPortId), "The start port must belong to the trace snapshot."),
        Check(trace.SystemId is Fact<SnapshotKey<ServiceSystem>>.Known system && system.Value.SnapshotId != trace.Id.SnapshotId,
            "trace.snapshot-mismatch", nameof(trace.SystemId), "The service system must belong to the trace snapshot."),
        Check(member.PredecessorPortId is Fact<SnapshotKey<ServicePort>>.Known predecessor && predecessor.Value.SnapshotId != trace.Id.SnapshotId,
            "trace.snapshot-mismatch", nameof(member.PredecessorPortId), "The predecessor port must belong to the trace snapshot."),
        Check(member.ViaConnectionId is Fact<SnapshotKey<ServiceConnection>>.Known connection && connection.Value.SnapshotId != trace.Id.SnapshotId,
            "trace.snapshot-mismatch", nameof(member.ViaConnectionId), "The traversed connection must belong to the trace snapshot."),
        Check(member.Reachability == Reachability.NotReachableWithinCompleteScope && (trace.TopologyCoverage != Completeness.Complete || trace.Truncated),
            "trace.unsupported-nonreachability", nameof(member.Reachability), "Non-reachability requires complete scoped topology and a trace that was not truncated.")
    ]);

    /// <summary>Checks that a general requirement pass has complete relevant input coverage. A conclusive failure can coexist with partial coverage.</summary>
    public static ImmutableArray<ModelViolation> Validate(Assessment assessment) => OnlyFailures([
        Check(assessment.Outcome == AssessmentOutcome.Pass && assessment.InputCoverage != Completeness.Complete,
            "assessment.incomplete-pass", nameof(assessment.Outcome), "Passing a requirement requires complete relevant evidence; incomplete evidence cannot establish a pass.")
    ]);

    /// <summary>Checks that an egress requirement pass has complete relevant input coverage; does not evaluate any safety rule.</summary>
    public static ImmutableArray<ModelViolation> Validate(EgressAssessment assessment) => OnlyFailures([
        Check(assessment.Outcome == AssessmentOutcome.Pass && assessment.InputCoverage != Completeness.Complete,
            "assessment.incomplete-pass", nameof(assessment.Outcome), "Passing an egress requirement requires complete relevant evidence; missing routes or topology cannot establish a pass.")
    ]);

    private static ModelViolation? Check(bool invalid, string code, string field, string message)
        => invalid ? new ModelViolation(code, field, message) : null;

    private static ImmutableArray<ModelViolation> OnlyFailures(ImmutableArray<ModelViolation?> findings)
        => findings.OfType<ModelViolation>().ToImmutableArray();
}
