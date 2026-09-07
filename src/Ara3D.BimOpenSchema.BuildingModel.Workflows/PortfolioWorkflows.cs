using System.Collections.Immutable;
using System.Globalization;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

public static class PortfolioWorkflows
{
    /// <summary>Compares source scope and coverage without inventing document-to-building assignments.</summary>
    public static WorkflowReport Compare(ImmutableArray<BuildingProjection> projections)
    {
        var duplicate = projections.GroupBy(x => x.Snapshot.Id).Any(x => x.Count() > 1);
        var selected = projections.DistinctBy(x => x.Snapshot.Id).ToImmutableArray();
        return new("10", "Portfolio coverage", WorkflowStatus.Partial,
            "One row per selected source dataset snapshot. Source documents are not assumed to be buildings; no cross-source total is asserted.",
            ["snapshot", "name", "storeys", "spaces", "doors", "roofs", "field_observations", "known", "unresolved"],
            selected.Select(x => ImmutableArray.Create(x.Snapshot.Id.Value, x.Snapshot.Name,
                N(x.Storeys.Length), N(x.Spaces.Length), N(x.Doors.Length), N(x.Roofs.Length),
                N(x.Coverage.Sum(c => c.Total)), N(x.Coverage.Sum(c => c.Known)),
                N(x.Coverage.Sum(c => c.Missing + c.Invalid + c.Conflicting)))).ToImmutableArray(),
            ["Cost/carbon ranking requires comparable externally supplied scenarios and metric boundaries.",
                "Buildings and cross-source object correspondences have not been established; counts are source-local and must not be summed as unique physical objects.",
                .. (duplicate ? new[] { "Duplicate snapshot selections were collapsed before comparison." } : Array.Empty<string>())]);
    }

    private static string N(int value) => value.ToString(CultureInfo.InvariantCulture);
}
