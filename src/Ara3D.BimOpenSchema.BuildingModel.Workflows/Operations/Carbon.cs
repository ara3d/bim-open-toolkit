using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;

/// <summary>ExclusiveScope names a reviewed disjoint physical contribution; amount and factor are explicitly selected external inputs.</summary>
public sealed record CarbonInput(MaterialUse MaterialUse, string ExclusiveScope, Fact<decimal> Quantity,
    QuantityUnit Unit, Fact<SnapshotKey<QuantityObservation>> Observation, Fact<EnvironmentalFactor> Factor);
public sealed record CarbonRequest(ReferenceKey<ModelSnapshot> Snapshot, AnalysisScenario Scenario,
    string AccountingScope, LifeCycleStage Stage, string Module, string ImpactMethod,
    ImmutableArray<CarbonInput> Contributions, Completeness ScopeCoverage);
public sealed record CarbonResult(ImmutableArray<ImpactLine> Lines, ImpactSummary Summary,
    ImmutableArray<SnapshotKey<MaterialUse>> ExcludedNonLeafContributions);

public static partial class OperationsWorkflows
{
    /// <summary>One explicit lifecycle boundary per calculation. Leaf contributions only; no density or factor matching guesses.</summary>
    public static CarbonResult Carbon(CarbonRequest request)
    {
        Require(!string.IsNullOrWhiteSpace(request.Module) && !string.IsNullOrWhiteSpace(request.ImpactMethod), "Explicit lifecycle module and impact method required.");
        Require(request.Contributions.Select(c => c.MaterialUse.Id).Distinct().Count() == request.Contributions.Length, "Duplicate material-use identity.");
        var selected = request.Contributions.Where(c => c.MaterialUse.Role == ContributionRole.LeafContribution).ToArray();
        Require(selected.All(c => !string.IsNullOrWhiteSpace(c.ExclusiveScope)) && selected.Select(c => c.ExclusiveScope).Distinct().Count() == selected.Length,
            "Selected contributions need distinct externally established disjoint physical scopes.");
        Require(selected.Select(c => c.MaterialUse.ScopeId).Distinct().Count() == selected.Length, "Competing material selections for one quantity scope.");
        var excluded = request.Contributions.Where(c => c.MaterialUse.Role != ContributionRole.LeafContribution).Select(c => c.MaterialUse.Id).ToImmutableArray();
        var lines = selected.Select(input =>
        {
            var material = input.MaterialUse;
            SameSnapshot(material.Id, request.Snapshot);
            SameSnapshot(material.ScopeId, request.Snapshot);
            if (input.Observation is Fact<SnapshotKey<QuantityObservation>>.Known observation) SameSnapshot(observation.Value, request.Snapshot);
            if (input.Quantity is Fact<decimal>.Known q) Require(q.Value >= 0, "Negative material quantity.");
            var impact = Fact<decimal>.Unknown("Quantity or compatible environmental factor unavailable.");
            var factorId = Fact<ReferenceKey<EnvironmentalFactor>>.Unknown("Factor unavailable.");
            var evidence = material.Evidence;
            if (input.Factor is Fact<EnvironmentalFactor>.Known chosen)
            {
                var factor = chosen.Value;
                Require(!string.IsNullOrWhiteSpace(factor.Publication) && !string.IsNullOrWhiteSpace(factor.Version), "Factor publication and version required.");
                factorId = Derived(factor.Id, factor.Evidence);
                evidence = evidence.AddRange(factor.Evidence);
                Require(factor.MaterialId is Fact<ReferenceKey<Material>>.Known mapping && mapping.Value == material.MaterialId,
                    "Selected factor must explicitly reference the contribution material; product-based matching needs a separate mapping.");
                if (factor.Unit == input.Unit && factor.ModuleCode == request.Module && factor.Stage == request.Stage && factor.ImpactMethod == request.ImpactMethod)
                {
                    if (input.Quantity is Fact<decimal>.Known quantity && factor.KilogramsCo2EquivalentPerUnit is Fact<decimal>.Known coefficient)
                    {
                        Require(coefficient.Value >= 0 || !string.IsNullOrWhiteSpace(factor.AllocationAndBoundaryRule), "Negative coefficient requires documented allocation.");
                        impact = Derived(quantity.Value * coefficient.Value, evidence);
                    }
                }
                else impact = Fact<decimal>.Unknown("Factor unit, lifecycle module, stage or method incompatible; no implicit conversions or combined modules.");
            }
            return new ImpactLine(new(request.Snapshot, $"impact/{material.Id.Value}/{request.Scenario.Id.Value}/{request.Module}"), material.Id, request.Scenario.Id,
                factorId, input.Observation, input.ExclusiveScope, request.Stage, request.Module, input.Quantity, input.Unit, impact,
                impact is Fact<decimal>.Known ? Completeness.Complete : Completeness.Partial,
                "carbon-v1: disjoint leaf quantity * explicitly mapped factor, one identical lifecycle boundary; no rounding or unit conversion", evidence);
        }).ToImmutableArray();
        var known = lines.Select(l => l.KilogramsCo2Equivalent).OfType<Fact<decimal>.Known>().ToArray();
        var subtotal = Derived(known.Sum(v => v.Value), lines.SelectMany(l => l.Evidence).Distinct().ToImmutableArray());
        // Unresolved roles cannot be silently discarded; assembly totals and alternatives are deliberate noncontributions.
        var unresolvedRole = request.Contributions.Any(c => c.MaterialUse.Role == ContributionRole.Unresolved);
        var complete = request.ScopeCoverage == Completeness.Complete && known.Length == lines.Length && !unresolvedRole &&
            (selected.Length > 0 || excluded.Length == 0);
        var missingQuantity = lines.Count(l => l.DeclaredQuantity is not Fact<decimal>.Known);
        return new(lines, new ImpactSummary(new(request.Snapshot, $"impact/{request.AccountingScope}/{request.Scenario.Id.Value}/{request.Module}"), request.Scenario.Id,
            request.AccountingScope, [request.Module], request.ImpactMethod, subtotal,
            complete ? subtotal : Fact<decimal>.Unknown("Incomplete quantity, factor or physical scope."), known.Length, missingQuantity,
            lines.Count(l => l.DeclaredQuantity is Fact<decimal>.Known && l.KilogramsCo2Equivalent is not Fact<decimal>.Known),
            complete ? Completeness.Complete : Completeness.Partial,
            "Externally established disjoint leaf scopes; assembly totals and alternative representations excluded; no invented mass coverage.",
            lines.SelectMany(l => l.Evidence).Distinct().ToImmutableArray()), excluded);
    }
}
