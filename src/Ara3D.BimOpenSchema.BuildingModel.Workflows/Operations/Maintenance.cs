using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;

/// <summary>Explicit replacement relationship; asset history is not reassigned to replacement equipment.</summary>
public sealed record AssetReplacement(SnapshotKey<Asset> Previous, SnapshotKey<Asset> Replacement,
    DateTimeOffset EffectiveAt, ReferenceKey<Evidence> Evidence);
public sealed record MaintenanceRequest(DateTimeOffset AsOf, ImmutableArray<Asset> Assets,
    ImmutableArray<AssetServiceRequirement> Requirements, ImmutableArray<MaintenanceTask> Tasks,
    ImmutableArray<AssetReplacement> Replacements, Completeness HistoryCoverage);
public sealed record MaintenanceDue(SnapshotKey<Asset> Asset, SnapshotKey<AssetServiceRequirement> Requirement,
    Fact<DateTimeOffset> DueAt, Fact<bool> IsDue, string SchedulingPolicy);
public sealed record AssetHandover(Asset Asset, bool RetiredByReplacement, ImmutableArray<string> MissingFields,
    ImmutableArray<MaintenanceTask> History);
public sealed record MaintenanceResult(ImmutableArray<AssetHandover> Assets, ImmutableArray<MaintenanceDue> WorkList);

public static partial class OperationsWorkflows
{
    /// <summary>Elapsed-time recurrence from evidenced completion; complete empty history may start at in-service midnight UTC.</summary>
    public static MaintenanceResult Maintain(MaintenanceRequest request)
    {
        var assets = request.Assets.ToDictionary(a => a.Id);
        var requirements = request.Requirements.ToDictionary(r => r.Id);
        Require(request.Assets.Select(a => a.Id.SnapshotId).Distinct().Count() <= 1, "Asset register must select one snapshot.");
        Require(request.Assets.Select(a => a.ObjectId).Distinct().Count() == request.Assets.Length,
            "One asset per physical object in this register; reconcile duplicate discipline facets before maintenance.");
        Require(request.Tasks.Select(t => t.Id).Distinct().Count() == request.Tasks.Length, "Duplicate maintenance task identity.");
        foreach (var replacement in request.Replacements)
        {
            Require(assets.ContainsKey(replacement.Previous) && assets.ContainsKey(replacement.Replacement) && replacement.Previous != replacement.Replacement,
                "Replacement must reference distinct registered assets.");
            Require(!string.IsNullOrWhiteSpace(replacement.Evidence.Value), "Replacement evidence required.");
        }
        Require(request.Replacements.GroupBy(r => r.Previous).All(g => g.Count() == 1) && request.Replacements.GroupBy(r => r.Replacement).All(g => g.Count() == 1),
            "Branching replacement histories require an explicit reconciliation policy.");
        foreach (var replacement in request.Replacements)
        {
            var seen = new HashSet<SnapshotKey<Asset>> { replacement.Previous };
            AssetReplacement? next = replacement;
            while (next is not null)
            {
                Require(seen.Add(next.Replacement), "Cyclic replacement history.");
                var following = request.Replacements.FirstOrDefault(r => r.Previous == next.Replacement);
                if (following is not null) Require(following.EffectiveAt > next.EffectiveAt, "Replacement chronology is inconsistent.");
                next = following;
            }
        }
        foreach (var requirement in request.Requirements)
        {
            Require(assets.ContainsKey(requirement.AssetId), "Requirement references missing asset.");
            SameSnapshot(requirement.Id, requirement.AssetId.SnapshotId);
            if (requirement.Interval is Fact<DurationValue>.Known interval) Require(interval.Value.Value > TimeSpan.Zero, "Service interval must be positive.");
        }
        foreach (var task in request.Tasks)
        {
            Require(assets.ContainsKey(task.AssetId), "Task references missing asset.");
            SameSnapshot(task.Id, task.AssetId.SnapshotId);
            if (task.ServiceRequirementId is Fact<SnapshotKey<AssetServiceRequirement>>.Known service)
                Require(requirements.TryGetValue(service.Value, out var requirement) && requirement.AssetId == task.AssetId,
                    "Task service requirement must belong to the same asset.");
        }
        var register = request.Assets.Select(asset =>
        {
            var gaps = ImmutableArray.CreateBuilder<string>();
            if (asset.SerialNumber is not Fact<string>.Known serial || string.IsNullOrWhiteSpace(serial.Value)) gaps.Add("SerialNumber");
            if (asset.MaintenanceManualReference is not Fact<string>.Known manual || string.IsNullOrWhiteSpace(manual.Value)) gaps.Add("MaintenanceManualReference");
            if (asset.SpaceId is not Fact<SnapshotKey<Space>>.Known) gaps.Add("SpaceId");
            return new AssetHandover(asset, request.Replacements.Any(r => r.Previous == asset.Id && r.EffectiveAt <= request.AsOf),
                gaps.ToImmutable(), request.Tasks.Where(t => t.AssetId == asset.Id).ToImmutableArray());
        }).ToImmutableArray();
        var retired = register.Where(a => a.RetiredByReplacement).Select(a => a.Asset.Id).ToHashSet();
        var futureReplacements = request.Replacements.Where(r => r.EffectiveAt > request.AsOf).Select(r => r.Replacement).ToHashSet();
        var due = request.Requirements.Where(r => !retired.Contains(r.AssetId) && !futureReplacements.Contains(r.AssetId)).Select(requirement =>
        {
            var asset = assets[requirement.AssetId];
            var history = request.Tasks.Where(t => t.AssetId == asset.Id &&
                t.ServiceRequirementId is Fact<SnapshotKey<AssetServiceRequirement>>.Known service && service.Value == requirement.Id).ToArray();
            var completions = history.Where(t => t.State == MaintenanceState.Completed &&
                t.CompletionEvidenceReference is Fact<string>.Known evidence && !string.IsNullOrWhiteSpace(evidence.Value))
                .Select(t => t.CompletedAt).OfType<Fact<DateTimeOffset>.Known>().Where(t => t.Value <= request.AsOf).ToArray();
            var dueAt = Fact<DateTimeOffset>.Unknown("Complete service history and an evidenced baseline are required.");
            // Missing history could conceal a later completion, so an earlier known completion alone cannot prove the due date.
            if (request.HistoryCoverage == Completeness.Complete && requirement.Interval is Fact<DurationValue>.Known interval)
            {
                if (history.Any(t => t.State == MaintenanceState.Completed &&
                    (t.CompletedAt is not Fact<DateTimeOffset>.Known || t.CompletionEvidenceReference is not Fact<string>.Known e || string.IsNullOrWhiteSpace(e.Value))))
                    dueAt = Fact<DateTimeOffset>.Unknown("Completion lacks date or evidence.");
                else if (completions.Length > 0) dueAt = Derived(completions.Max(t => t.Value).Add(interval.Value.Value),
                    requirement.Evidence.AddRange(history.SelectMany(t => t.Evidence)).Distinct().ToImmutableArray());
                else if (history.Length == 0 && asset.InServiceDate is Fact<DateOnly>.Known start)
                    dueAt = Derived(new DateTimeOffset(start.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)).Add(interval.Value.Value), requirement.Evidence);
            }
            return new MaintenanceDue(asset.Id, requirement.Id, dueAt,
                dueAt is Fact<DateTimeOffset>.Known date ? Derived(date.Value <= request.AsOf, date.Evidence) : Fact<bool>.Unknown("Due date unresolved."),
                "maintenance-v1: complete history; latest evidenced completion + elapsed interval, or in-service midnight UTC only for complete empty history.");
        }).ToImmutableArray();
        return new(register, due);
    }
}
