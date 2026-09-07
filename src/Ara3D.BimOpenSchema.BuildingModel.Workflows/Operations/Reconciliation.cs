using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;

/// <summary>EventId is an external immutable receipt-line identity; highest revision replaces, never adds to, older versions.</summary>
public sealed record ReceiptRevision(string EventId, int Revision, DeliveryLine Line, Fact<string> AcceptedSubstitutionBasis);
public sealed record ReconciliationRequest(ProcurementRequirement Requirement, ImmutableArray<ReceiptRevision> Receipts,
    ImmutableArray<InstallationObservation> InstallationHistory, Completeness ReceiptCoverage, Completeness InstallationCoverage);
public sealed record ReconciliationResult(Fact<decimal> AcceptedSubtotal, Fact<decimal> ReceivedSubtotal,
    Fact<decimal> NotAcceptedSubtotal, Fact<decimal> OutstandingAgainstKnownReceipts,
    ImmutableArray<InstallationObservation> LatestInstallation, ImmutableArray<ReceiptRevision> ReceiptHistory,
    ImmutableArray<InstallationObservation> InstallationHistory, Completeness ReceiptCoverage,
    Completeness InstallationCoverage, ImmutableArray<string> Findings);

public static partial class OperationsWorkflows
{
    public static ReconciliationResult Reconcile(ReconciliationRequest request)
    {
        var requirement = request.Requirement;
        if (requirement.RequiredQuantity is Fact<decimal>.Known required) Require(required.Value >= 0, "Required quantity cannot be negative.");
        var history = request.Receipts.GroupBy(r => (r.EventId, r.Revision)).Select(g =>
        {
            Require(!string.IsNullOrWhiteSpace(g.Key.EventId) && g.Key.Revision >= 0, "Receipt identity and nonnegative revision required.");
            Require(g.All(r => SameReceipt(r, g.First())), "Conflicting copies of one receipt revision.");
            return g.First();
        }).OrderBy(r => r.EventId, StringComparer.Ordinal).ThenBy(r => r.Revision).ToImmutableArray();
        var receipts = history.GroupBy(r => r.EventId).Select(g => g.MaxBy(r => r.Revision)!).ToArray();
        var findings = ImmutableArray.CreateBuilder<string>();
        var accepted = 0m;
        var received = 0m;
        var notAccepted = 0m;
        var complete = request.ReceiptCoverage == Completeness.Complete;
        foreach (var receipt in receipts)
        {
            var line = receipt.Line;
            SameSnapshot(line.Id, requirement.Id.SnapshotId);
            SameSnapshot(line.BatchId, requirement.Id.SnapshotId);
            Require(line.RequirementId is Fact<SnapshotKey<ProcurementRequirement>>.Known r && r.Value == requirement.Id, "Receipt must explicitly reference the selected requirement.");
            Require(line.Unit == requirement.Unit, "Incompatible receipt quantity unit.");
            if (line.ReceivedQuantity is Fact<decimal>.Known rq) Require(rq.Value >= 0, "Received quantity cannot be negative.");
            if (line.AcceptedQuantity is Fact<decimal>.Known aq) Require(aq.Value >= 0, "Accepted quantity cannot be negative.");
            if (line.ReceivedQuantity is Fact<decimal>.Known rr && line.AcceptedQuantity is Fact<decimal>.Known aa)
                Require(aa.Value <= rr.Value, "Accepted quantity cannot exceed received quantity.");
            Require(line.State != DeliveryState.Returned, "Returns need explicit net disposition events; negative receipt inference is unsupported.");
            if (line.State == DeliveryState.Rejected && line.AcceptedQuantity is Fact<decimal>.Known rejected)
                Require(rejected.Value == 0, "Rejected receipt cannot contain accepted quantity.");
            if (line.ReceivedQuantity is Fact<decimal>.Known got) received += got.Value;
            else { complete = false; findings.Add($"{receipt.EventId}: received quantity missing."); }
            if (line.ReceivedQuantity is Fact<decimal>.Known got2 && line.AcceptedQuantity is Fact<decimal>.Known accepted2)
                notAccepted += got2.Value - accepted2.Value;
            var match = requirement.ProductId is Fact<ReferenceKey<ProductDefinition>>.Known product &&
                line.ProductId is Fact<ReferenceKey<ProductDefinition>>.Known supplied && product.Value == supplied.Value;
            var substitutionAccepted = receipt.AcceptedSubstitutionBasis is Fact<string>.Known basis && !string.IsNullOrWhiteSpace(basis.Value);
            if (!match && !substitutionAccepted)
            {
                complete = false;
                findings.Add($"{receipt.EventId}: product match or accepted substitution basis unavailable; excluded from requirement fulfillment.");
            }
            else if (line.AcceptedQuantity is Fact<decimal>.Known amount) accepted += amount.Value;
            else { complete = false; findings.Add($"{receipt.EventId}: accepted quantity missing."); }
        }
        var observations = request.InstallationHistory.GroupBy(o => o.Id).Select(g =>
        {
            Require(g.All(o => SameInstallation(o, g.First())), "Conflicting copies of installation observation identity.");
            return g.First();
        }).ToImmutableArray();
        foreach (var observation in observations)
        {
            SameSnapshot(observation.Id, requirement.Id.SnapshotId);
            Require(requirement.IntendedObjects.Contains(observation.ObjectId), "Installation observation outside requirement scope.");
            Require(observation.WorkPackageId is Fact<SnapshotKey<WorkPackage>>.Known p && p.Value == requirement.WorkPackageId,
                "Installation observation must identify the selected package.");
            if (observation.ProgressFraction is Fact<Ratio>.Known progress)
                Require(double.IsFinite(progress.Value.Value) && progress.Value.Value is >= 0 and <= 1, "Invalid installation progress.");
        }
        var latest = observations.GroupBy(o => (o.ObjectId, o.Activity)).Select(g =>
        {
            var timestamp = g.Max(o => o.ObservedAt);
            var selected = g.Where(o => o.ObservedAt == timestamp).ToArray();
            Require(selected.Length == 1, "Same-time installation observations need an explicit correction decision.");
            return selected[0];
        }).OrderBy(o => o.ObjectId.Value, StringComparer.Ordinal).ThenBy(o => o.Activity, StringComparer.Ordinal).ToImmutableArray();
        if (observations.Length == 0) findings.Add("No installation observations: delivered quantities do not establish installation.");
        var evidence = requirement.Evidence.AddRange(receipts.SelectMany(r => r.Line.Evidence)).Distinct().ToImmutableArray();
        return new(Derived(accepted, evidence), Derived(received, evidence), Derived(notAccepted, evidence),
            requirement.RequiredQuantity is Fact<decimal>.Known need ? Derived(Math.Max(0, need.Value - accepted), evidence) : Fact<decimal>.Unknown("Required quantity unavailable."),
            latest, history, observations, complete ? Completeness.Complete : Completeness.Partial, request.InstallationCoverage,
            findings.ToImmutable());
    }

    private static bool SameReceipt(ReceiptRevision first, ReceiptRevision second)
    {
        var a = first.Line;
        var b = second.Line;
        return first.EventId == second.EventId && first.Revision == second.Revision && SameFact(first.AcceptedSubstitutionBasis, second.AcceptedSubstitutionBasis) &&
            a.Id == b.Id && a.BatchId == b.BatchId && SameFact(a.RequirementId, b.RequirementId) && SameFact(a.ProductId, b.ProductId) &&
            SameFact(a.LotOrSerialReference, b.LotOrSerialReference) && SameFact(a.OrderedQuantity, b.OrderedQuantity) && SameFact(a.ReceivedQuantity, b.ReceivedQuantity) &&
            SameFact(a.AcceptedQuantity, b.AcceptedQuantity) && a.Unit == b.Unit && a.State == b.State && SameFact(a.Discrepancy, b.Discrepancy) && a.Evidence.SequenceEqual(b.Evidence);
    }

    private static bool SameInstallation(InstallationObservation a, InstallationObservation b)
        => a.Id == b.Id && a.ObjectId == b.ObjectId && SameFact(a.WorkPackageId, b.WorkPackageId) && a.ObservedAt == b.ObservedAt &&
           a.Activity == b.Activity && a.State == b.State && SameFact(a.ProgressFraction, b.ProgressFraction) && a.ProgressBasis == b.ProgressBasis &&
           SameFact(a.Observer, b.Observer) && SameFact(a.Comment, b.Comment) && a.Evidence.SequenceEqual(b.Evidence);
}
