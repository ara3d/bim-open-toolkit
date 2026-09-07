using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;

public sealed record EstimateInput(SnapshotKey<EstimateLine> Id, string Description, string ExclusiveScope,
    Fact<SnapshotKey<QuantityObservation>> Observation, Fact<decimal> Quantity, QuantityUnit Unit,
    Fact<Ratio> Waste, Fact<RateItem> Rate, ImmutableArray<ReferenceKey<Evidence>> Evidence);
public sealed record EstimateRequest(WorkPackage Package, AnalysisScenario Scenario, string Currency,
    ImmutableArray<RateCatalog> Catalogs, ImmutableArray<EstimateInput> Lines, Completeness ScopeCoverage);
public sealed record EstimateResult(ImmutableArray<EstimateLine> Lines, EstimateSummary Summary);

public static partial class OperationsWorkflows
{
    /// <summary>Price disjoint declared scopes; round each line to two decimals using midpoint-to-even. No implicit conversions.</summary>
    public static EstimateResult Estimate(EstimateRequest request)
    {
        Require(!string.IsNullOrWhiteSpace(request.Currency), "Currency must be supplied.");
        Require(request.Lines.Select(l => l.Id).Distinct().Count() == request.Lines.Length, "Duplicate estimate line identity.");
        Require(request.Lines.All(l => !string.IsNullOrWhiteSpace(l.ExclusiveScope)) &&
            request.Lines.Select(l => l.ExclusiveScope).Distinct().Count() == request.Lines.Length,
            "Each line needs a distinct, externally established disjoint accounting scope.");
        var catalogs = request.Catalogs.ToDictionary(c => c.Id);
        var lines = request.Lines.Select(input =>
        {
            SameSnapshot(input.Id, request.Package.Id.SnapshotId);
            if (input.Observation is Fact<SnapshotKey<QuantityObservation>>.Known observation)
                SameSnapshot(observation.Value, request.Package.Id.SnapshotId);
            if (input.Quantity is Fact<decimal>.Known q) Require(q.Value >= 0, "Negative estimate quantity.");
            if (input.Waste is Fact<Ratio>.Known w)
                Require(double.IsFinite(w.Value.Value) && w.Value.Value >= 0, "Waste must be finite and nonnegative.");
            var rateId = Fact<ReferenceKey<RateItem>>.Unknown("No selected rate.");
            var applied = Fact<Money>.Unknown("No compatible selected price.");
            var cost = Fact<Money>.Unknown("Quantity, waste or compatible rate is unavailable.");
            if (input.Rate is Fact<RateItem>.Known selected)
            {
                var rate = selected.Value;
                Require(catalogs.TryGetValue(rate.CatalogId, out var catalog), "Selected rate catalog was not supplied.");
                rateId = Derived(rate.Id, rate.Evidence);
                if (rate.UnitPrice is Fact<Money>.Known price)
                {
                    Require(price.Value.Amount >= 0, "Negative price requires an explicit credit workflow.");
                    Require(price.Value.Currency == catalog!.Currency, "Rate price contradicts its catalog currency.");
                    if (rate.PricingUnit == input.Unit && price.Value.Currency == request.Currency)
                    {
                        applied = price;
                        if (input.Quantity is Fact<decimal>.Known quantity && input.Waste is Fact<Ratio>.Known waste)
                            cost = Derived(new Money(decimal.Round(quantity.Value * (1 + (decimal)waste.Value.Value) * price.Value.Amount,
                                2, MidpointRounding.ToEven), request.Currency), input.Evidence.AddRange(rate.Evidence));
                    }
                    else cost = Fact<Money>.Unknown("Incompatible quantity unit or currency; no conversion policy supplied.");
                }
            }
            return new EstimateLine(input.Id, request.Package.Id, request.Scenario.Id, input.Observation,
                input.Description, input.ExclusiveScope, input.Quantity, input.Unit, input.Waste, rateId, applied,
                cost, cost is Fact<Money>.Known ? PricingState.Priced : PricingState.Unpriced,
                "estimate-v1: quantity * (1 + explicit waste) * rate; each line rounded to 2 decimals, midpoint-to-even; no conversion",
                input.Evidence.AddRange(request.Scenario.Evidence));
        }).ToImmutableArray();
        var known = lines.Select(l => l.TotalCost).OfType<Fact<Money>.Known>().ToArray();
        var subtotal = Derived(new Money(known.Sum(v => v.Value.Amount), request.Currency), lines.SelectMany(l => l.Evidence).Distinct().ToImmutableArray());
        var complete = known.Length == lines.Length && request.ScopeCoverage == Completeness.Complete && request.Package.MembershipCompleteness == Completeness.Complete;
        return new(lines, new EstimateSummary(new(request.Package.Id.SnapshotId, $"estimate/{request.Package.Id.Value}/{request.Scenario.Id.Value}"),
            request.Package.Id, request.Scenario.Id, request.Package.AccountingScope, request.Currency, subtotal,
            complete ? subtotal : Fact<Money>.Unknown("Unpriced lines or incomplete package scope."), known.Length, lines.Length - known.Length,
            0, complete ? Completeness.Complete : Completeness.Partial, "Disjoint supplied scopes; sum rounded supported lines only.", subtotal is Fact<Money>.Known k ? k.Evidence : []));
    }
}
