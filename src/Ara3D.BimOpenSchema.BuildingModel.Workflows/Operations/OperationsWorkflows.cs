using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;

/// <summary>Pure operational experiments. Supplemental inputs are never inferred from architectural geometry.</summary>
public static partial class OperationsWorkflows
{
    public static ImmutableArray<WorkflowReport> InputRequirements(BuildingProjection source)
    {
        var scope = $"Snapshot {source.Snapshot.Id}; {source.Objects.Length} mapped objects. No supplemental operational inputs supplied.";
        return [
            WorkflowReports.Missing("04", "Package estimate", scope, "Requires disjoint selected quantities, package membership, a versioned rate catalog, currency and explicit waste/rounding policy."),
            WorkflowReports.Missing("05", "Delivery and installation reconciliation", scope, "Requires product requirements, identified receipt revisions, substitution decisions and independent installation observations."),
            WorkflowReports.Missing("06", "Valve isolation", scope, "Requires ports, evidenced internal and external connections, operational states, directed flow assertions and scoped topology completeness."),
            WorkflowReports.Missing("07", "Penetrations and access", scope, "Requires penetration associations, selected resolved geometry, frame registrations and supplied access requirements. Bounds produce candidates only."),
            WorkflowReports.Missing("08", "Asset handover and maintenance", scope, "Requires asset registrations, service requirements, maintenance history completeness and dated replacement relationships."),
            WorkflowReports.Missing("09", "Material carbon", scope, "Requires disjoint material contributions and explicitly selected versioned environmental factors with compatible units and lifecycle boundaries.")];
    }

    private static Fact<T> Derived<T>(T value, ImmutableArray<ReferenceKey<Evidence>> evidence)
        => new Fact<T>.Known(value, Assurance.Derived, evidence);

    // ImmutableArray equality is backing-array identity; independent ingestion needs content equality.
    private static bool SameFact<T>(Fact<T> first, Fact<T> second) => (first, second) switch
    {
        (Fact<T>.Known a, Fact<T>.Known b) => EqualityComparer<T>.Default.Equals(a.Value, b.Value) && a.Assurance == b.Assurance && a.Evidence.SequenceEqual(b.Evidence),
        (Fact<T>.Missing a, Fact<T>.Missing b) => a.Reason == b.Reason && a.Explanation == b.Explanation && a.Evidence.SequenceEqual(b.Evidence),
        _ => false
    };

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new ArgumentException(message);
    }

    private static void SameSnapshot<T>(SnapshotKey<T> key, ReferenceKey<ModelSnapshot> snapshot)
        => Require(key.SnapshotId == snapshot && !string.IsNullOrWhiteSpace(key.Value), "All scoped inputs must have valid identities in the selected snapshot.");
}
