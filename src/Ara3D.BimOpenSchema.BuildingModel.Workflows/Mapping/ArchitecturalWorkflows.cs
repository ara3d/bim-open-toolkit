using System.Collections.Immutable;
using System.Globalization;
using System.Text.Json;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

public static class ArchitecturalWorkflows
{
    public static WorkflowReport Schedule(BuildingProjection projection)
    {
        var rows = ImmutableArray.CreateBuilder<ImmutableArray<string>>();
        foreach (var s in projection.Storeys.OrderBy(s => s.Id.Value))
            rows.Add(["Storey", s.Id.Value, s.Element.Name ?? "", Display(s.Number), "", "", "", "", "", Display(s.Elevation), "", string.Join(";", s.Element.Evidence)]);
        foreach (var s in projection.Spaces.OrderBy(s => s.Id.Value))
            rows.Add(["Space", s.Id.Value, s.Element.Name ?? "", Display(s.Number), Display(s.Storey), "", "", "", "", "", Display(s.NetFloorArea), string.Join(";", s.Element.Evidence)]);
        foreach (var d in projection.Doors.OrderBy(d => d.Id.Value))
            rows.Add(["Door", d.Id.Value, d.Element.Name ?? "", d.Element.Mark ?? "", Display(d.Element.Location.PrimaryStorey),
                string.Join(";", d.AdjacentSpaces.Items.Select(s => s.Value)), Display(d.NominalWidth), Display(d.ClearWidth), Display(d.FireResistance), "", "", string.Join(";", d.Element.Evidence)]);
        return new("01", "Room, door and storey schedule", rows.Count == 0 ? WorkflowStatus.RequiresInput : WorkflowStatus.Partial,
            Scope(projection), ["Kind", "Object", "Name", "Number/mark", "Storey", "Adjacent spaces (partial)", "Nominal width (m)", "Clear width (m)", "Fire resistance (min)", "Elevation (m; datum unestablished)", "Net floor area (m2)", "Identity evidence"],
            rows.ToImmutable(), [$"Selected occurrences: {projection.Storeys.Length} storeys, {projection.Spaces.Length} spaces, {projection.Doors.Length} doors; every door appears once.",
                "Source documents do not establish physical buildings. Building assignments, relationship completeness and unobserved specifications remain gaps.",
                "No accessibility/fire compliance assertion is made without a supplied requirement and complete evidence.",
                "Field evidence is attached to the persisted typed facts; field coverage denominators include every occurrence in that typed table."]);
    }

    public static WorkflowReport Takeoff(BuildingProjection projection)
    {
        var rows = projection.Roofs.OrderBy(r => r.Id.Value).Select(r => ImmutableArray.Create("Roof", r.Id.Value, r.Element.Name ?? "",
            Display(r.NetSurfaceArea), Display(r.ProjectedArea), "Net construction surface after declared deductions", EvidenceOf(r.NetSurfaceArea))).ToImmutableArray().ToBuilder();
        var selected = projection.Roofs.Where(r => SupportedArea(r.NetSurfaceArea)).ToArray();
        var subtotal = selected.Sum(r => ((Fact<Area>.Known)r.NetSurfaceArea).Value.SquareMetres);
        var finishSubtotal = 0.0;
        var selectedFinishes = 0;
        var unresolvedFinishes = 0;
        foreach (var group in projection.Finishes.GroupBy(FinishScope).OrderBy(g => g.Key, StringComparer.Ordinal))
        {
            var first = group.OrderBy(f => f.Id.Value, StringComparer.Ordinal).First();
            var supported = !group.Key.StartsWith("unresolved/", StringComparison.Ordinal)
                && group.All(f => SupportedArea(f.NetArea))
                && group.Select(f => ((Fact<Area>.Known)f.NetArea).Value.SquareMetres).Distinct().Count() == 1;
            if (supported) { finishSubtotal += ((Fact<Area>.Known)first.NetArea).Value.SquareMetres; selectedFinishes++; }
            else unresolvedFinishes++;
            rows.Add(["Finish", first.Id.Value, first.Element.Name ?? "", supported ? Display(first.NetArea) : "Unresolved scope or conflicting/unavailable area",
                "NotApplicable", $"Host/face/installation scope {group.Key}; {group.Count()} representation(s), counted {(supported ? "once" : "zero times pending evidence")}",
                string.Join(";", group.Select(f => EvidenceOf(f.NetArea)))]);
        }
        return new("03", "Roof and room-finish takeoff", selected.Length + selectedFinishes == 0 ? WorkflowStatus.RequiresInput : WorkflowStatus.Partial, Scope(projection),
            ["Kind", "Object", "Name", "Net surface (m2)", "Projected area (m2)", "Selected basis", "Measurement evidence"], rows.ToImmutable(),
            [$"Supported roof net-surface subtotal: {subtotal.ToString("G17", CultureInfo.InvariantCulture)} m2 across {selected.Length}/{projection.Roofs.Length} roof occurrences. Unresolved occurrences: {projection.Roofs.Length - selected.Length}.",
                "Net surface and projected area remain separate. Generic Area and geometry bounds do not establish a membrane installation quantity.",
                "Roof assembly, membrane assignment and deduction policy need evidence before this becomes a priced material takeoff.",
                $"Supported finish net-area subtotal: {finishSubtotal.ToString("G17", CultureInfo.InvariantCulture)} m2 across {selectedFinishes} explicit host/face/installation scopes; unresolved scopes: {unresolvedFinishes}; input finish rows: {projection.Finishes.Length}.",
                "Finish quantities require explicitly identified disjoint installation scopes and documented deductions. Opposite wall faces remain separate; duplicate representations do not multiply a scope. Material/assembly allocation is still required for material takeoff.",
                projection.Finishes.IsEmpty ? "Room-facing finish faces/material assignments remain an input gap. No wall area is substituted." : "Supplied finish records are measured installation scopes, not exporter-inferred wall finishes."]);
    }

    public static WorkflowReport Compare(BuildingProjection before, BuildingProjection after, bool completeComparableScope)
    {
        var scope = $"Before {before.Snapshot.Id}; after {after.Snapshot.Id}";
        var beforeDocs = before.SourceRevisions.Select(r => r.DocumentId.Value).ToHashSet(StringComparer.Ordinal);
        var afterDocs = after.SourceRevisions.Select(r => r.DocumentId.Value).ToHashSet(StringComparer.Ordinal);
        if (beforeDocs.Count == 0 || !beforeDocs.SetEquals(afterDocs))
            return WorkflowReports.Missing("02", "Revision comparison", scope, "Caller-established source document lineages differ or are absent. Unrelated deliveries cannot be compared as revisions.");
        if (!before.Snapshot.Policies.Select(p => p.Value).Order().SequenceEqual(after.Snapshot.Policies.Select(p => p.Value).Order()))
            return WorkflowReports.Missing("02", "Revision comparison", scope, "Interpretation policies differ. Re-map both deliveries under the same policy before attributing changes to the building.");
        var oldRows = DomainRows(before).ToDictionary(r => r.Id, r => r);
        var newRows = DomainRows(after).ToDictionary(r => r.Id, r => r);
        var oldObjects = before.Objects.ToDictionary(o => o.Id.Value);
        var newObjects = after.Objects.ToDictionary(o => o.Id.Value);
        var result = ImmutableArray.CreateBuilder<ImmutableArray<string>>();
        foreach (var id in oldRows.Keys.Union(newRows.Keys).Order())
        {
            oldRows.TryGetValue(id, out var old);
            newRows.TryGetValue(id, out var next);
            var reconciled = (!oldObjects.TryGetValue(id, out var oldObject) || oldObject.IdentityStatus == IdentityStatus.Reconciled)
                && (!newObjects.TryGetValue(id, out var newObject) || newObject.IdentityStatus == IdentityStatus.Reconciled);
            var state = !reconciled ? "Unresolved identity" : old is null ? completeComparableScope ? "Added" : "Newly observed; addition unresolved" : next is null
                ? completeComparableScope ? "Removed" : "Omitted; removal unresolved"
                : old.Semantic == next.Semantic ? "Unchanged" : "Changed";
            result.Add([id, next?.Kind ?? old!.Kind, state, old?.Semantic ?? "", next?.Semantic ?? ""]);
        }
        var incomplete = !completeComparableScope || result.Any(r => r[2].Contains("nresolved", StringComparison.Ordinal));
        return new("02", "Revision comparison", incomplete ? WorkflowStatus.Partial : WorkflowStatus.Supported, scope,
            ["Object", "Kind", "Change", "Before facts", "After facts"], result.ToImmutable(),
            ["Comparison uses document-scoped global identity and typed semantic values. Export row order, snapshot keys and evidence addresses are excluded from semantic equality.",
                "Local-only and duplicate identifiers remain unresolved. Caller completeness authorizes removals only inside the same established document lineages.",
                string.Join("; ", result.GroupBy(r => r[2]).Select(g => $"{g.Key}: {g.Count()}"))]);
    }

    private static bool SupportedArea(Fact<Area> fact) => fact is Fact<Area>.Known k && double.IsFinite(k.Value.SquareMetres) && k.Value.SquareMetres >= 0;
    private static string FinishScope(FinishSurface f)
        => f.Host is Fact<ReferenceKey<BimObject>>.Known host && f.HostFaceIdentifier is Fact<string>.Known face
            && f.ScopeIdentifier is Fact<string>.Known scope && !string.IsNullOrWhiteSpace(face.Value) && !string.IsNullOrWhiteSpace(scope.Value)
            ? JsonSerializer.Serialize(new[] { host.Value.Value, face.Value, scope.Value }) : "unresolved/" + f.Id;

    private sealed record SemanticRow(string Id, string Kind, string Semantic);
    private static IEnumerable<SemanticRow> DomainRows(BuildingProjection p)
        => p.Storeys.Select(r => new SemanticRow(r.Element.ObjectId.Value, "Storey", Semantic(r)))
            .Concat(p.Spaces.Select(r => new SemanticRow(r.Element.ObjectId.Value, "Space", Semantic(r))))
            .Concat(p.Doors.Select(r => new SemanticRow(r.Element.ObjectId.Value, "Door", Semantic(r))))
            .Concat(p.Roofs.Select(r => new SemanticRow(r.Element.ObjectId.Value, "Roof", Semantic(r))));

    // Explicit semantic projections keep snapshot/evidence addresses out of equality without runtime reflection.
    private static string Semantic(Storey r) => Pack(E(r.Element), K(r.Building), F(r.Number), F(r.SortOrder), F(r.Elevation),
        K(r.ElevationFrame), F(r.DatumKind), F(r.FloorToFloorHeight), L(r.Spaces));
    private static string Semantic(Space r) => Pack(E(r.Element), F(r.Number), K(r.Building), K(r.Storey), F(r.Use), F(r.Department),
        F(r.Enclosure), F(r.NetFloorArea), F(r.AreaMeasurementStandard), F(r.ClearHeight), F(r.NetVolume), F(r.DesignOccupancy),
        K(r.BoundaryRepresentation), L(r.Boundaries), L(r.FinishSurfaces), L(r.Doors));
    private static string Semantic(Door r) => Pack(E(r.Element), F(r.Product), K(r.Opening), L(r.AdjacentSpaces), F(r.Operation), F(r.LeafCount),
        F(r.NominalWidth), F(r.NominalHeight), F(r.ClearWidth), F(r.ClearHeight), F(r.FireResistance), F(r.IsSmokeControl), F(r.HardwareSet), F(r.IsAccessible));
    private static string Semantic(Roof r) => Pack(E(r.Element), F(r.Assembly), K(r.Storey), F(r.NetSurfaceArea), F(r.ProjectedArea),
        F(r.RepresentativeSlope), F(r.EdgeLength), F(r.ThermalTransmittance), K(r.NetSurfaceQuantity), L(r.Openings), L(r.FinishSurfaces));
    private static string E(ElementInfo e) => Pack(e.ObjectId.Value, e.Name ?? "", e.Mark ?? "", e.Lifecycle.ToString(),
        K(e.Location.Building), K(e.Location.PrimaryStorey), L(e.Location.OtherStoreys), L(e.Location.Spaces), L(e.Location.Zones),
        e.Placement is Fact<Placement>.Known p
            ? Pack(p.Value.FrameId.Value, JsonSerializer.Serialize(p.Value.Origin), F(p.Value.XAxis), F(p.Value.YAxis), F(p.Value.ZAxis))
            : e.Placement is Fact<Placement>.Missing m ? m.Reason.ToString() : "Unknown", L(e.Geometry));
    private static string Pack(params string[] fields) => JsonSerializer.Serialize(fields);
    private static string F<T>(Fact<T> fact) => fact switch
    {
        Fact<T>.Known k => "Known:" + JsonSerializer.Serialize(k.Value),
        Fact<T>.Missing m => "Missing:" + m.Reason,
        _ => throw new ArgumentException("Unknown fact alternative.", nameof(fact))
    };
    private static string K<T>(Fact<SnapshotKey<T>> fact) => fact switch
    {
        Fact<SnapshotKey<T>>.Known k => "Known:" + k.Value.Value,
        Fact<SnapshotKey<T>>.Missing m => "Missing:" + m.Reason,
        _ => throw new ArgumentException("Unknown fact alternative.", nameof(fact))
    };
    private static string L<T>(LinkSet<T> links) => Pack(links.Completeness.ToString(), Pack(links.Items.Select(i => i.Value).Order(StringComparer.Ordinal).ToArray()));

    internal static string Display<T>(Fact<T> fact) => fact switch
    {
        Fact<T>.Missing m => $"{m.Reason}: {m.Explanation}",
        Fact<T>.Known k => k.Value switch
        {
            Length l => l.Metres.ToString("G17", CultureInfo.InvariantCulture),
            Area a => a.SquareMetres.ToString("G17", CultureInfo.InvariantCulture),
            DurationValue d => d.Value.TotalMinutes.ToString("G17", CultureInfo.InvariantCulture),
            SnapshotKey<Storey> s => s.Value,
            _ => Convert.ToString(k.Value, CultureInfo.InvariantCulture) ?? ""
        },
        _ => throw new ArgumentException("Unknown fact alternative.", nameof(fact))
    };
    private static string EvidenceOf<T>(Fact<T> fact) => string.Join(";", fact switch
    { Fact<T>.Known k => k.Evidence, Fact<T>.Missing m => m.Evidence, _ => [] });
    private static string Scope(BuildingProjection p) => $"Snapshot {p.Snapshot.Id}; source deliveries {string.Join(", ", p.SourceRevisions.Select(r => r.RevisionLabel))}; architectural adapter scope";
}
