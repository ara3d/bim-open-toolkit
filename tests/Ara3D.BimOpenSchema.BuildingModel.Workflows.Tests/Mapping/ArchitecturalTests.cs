using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

[Platonic.Impure]
public sealed class ArchitecturalTests
{
    private static MappingOptions Options(string content = "sha256:first", string scope = "fixture-lineage", bool declared = true)
        => new("fixture", content, scope, DateTimeOffset.Parse("2026-01-01T00:00:00Z"), declared);

    [Test]
    public void Maps_occurrences_and_relationships_without_inventing_buildings_or_clear_width()
    {
        var p = BuildingMapper.Map(Fixture(), Options());
        Assert.Multiple(() =>
        {
            Assert.That(p.Storeys, Has.Length.EqualTo(1));
            Assert.That(p.Spaces, Has.Length.EqualTo(2));
            Assert.That(p.Doors, Has.Length.EqualTo(1));
            Assert.That(p.Roofs, Has.Length.EqualTo(1));
            Assert.That(p.Objects, Has.Length.EqualTo(5));
            Assert.That(p.Doors[0].AdjacentSpaces.Items, Has.Length.EqualTo(2));
            Assert.That(p.Doors[0].NominalWidth, Is.EqualTo(new Fact<Length>.Known(new(0.9), Assurance.Observed, ((Fact<Length>.Known)p.Doors[0].NominalWidth).Evidence)));
            Assert.That(p.Doors[0].ClearWidth, Is.TypeOf<Fact<Length>.Missing>());
            Assert.That(p.Spaces.All(s => s.Building is Fact<SnapshotKey<Building>>.Missing), Is.True);
            Assert.That(p.Storeys[0].Spaces.Items, Has.Length.EqualTo(2));
            Assert.That(p.Spaces.All(s => s.Doors.Items.Length == 1), Is.True);
            Assert.That(p.Finishes, Is.Empty);
            Assert.That(ProjectionValidation.Validate(p), Is.Empty);
        });
        Assert.That(ArchitecturalWorkflows.Schedule(p).Rows.Count(r => r[0] == "Door"), Is.EqualTo(1));
    }

    [Test]
    public void Inherited_measurement_retains_type_owner_and_occurrence_type_conflicts()
    {
        var inherited = BuildingMapper.Map(Fixture(), Options());
        var fact = (Fact<Length>.Known)inherited.Doors[0].NominalWidth;
        var ev = inherited.Evidence.Single(e => e.Id == fact.Evidence[0]);
        var source = inherited.SourceObjects.Single(s => s.Id == ev.Sources[0]);
        Assert.That(source.SourceRole, Is.EqualTo("Type"));
        Assert.That(source.Row, Is.EqualTo(5));
        var conflict = BuildingMapper.Map(Fixture(conflictingWidth: true), Options());
        Assert.That(((Fact<Length>.Missing)conflict.Doors[0].NominalWidth).Reason, Is.EqualTo(Availability.Conflicting));
        Assert.That(((Fact<Length>.Missing)conflict.Doors[0].NominalWidth).Evidence, Has.Length.EqualTo(2));
        Assert.That(conflict.Coverage.Single(c => c.EntityKind == "Door" && c.Field == "NominalWidth").Conflicting, Is.EqualTo(1));
    }

    [Test]
    public void Display_units_are_not_assumed_to_describe_stored_numbers()
    {
        var p = BuildingMapper.Map(Fixture(), Options(declared: false));
        Assert.That(((Fact<Length>.Missing)p.Doors[0].NominalWidth).Reason, Is.EqualTo(Availability.NotObserved));
        Assert.That(p.Evidence.Any(e => e.Explanation.Contains("stored text") && e.Explanation.Contains("900")), Is.True);
        var canonical = Fixture();
        var tables = canonical.Tables with { Properties = canonical.Tables.Properties.Select(r => r.Name == "Width" ? r with { CanonicalNumber = 0.9144, CanonicalUnits = "m" } : r).ToImmutableArray() };
        var trusted = BuildingMapper.Map(BimModel.Create(tables), Options(declared: false));
        Assert.That(((Fact<Length>.Known)trusted.Doors[0].NominalWidth).Value.Metres, Is.EqualTo(0.9144));
    }

    [Test]
    public void Explicit_revit_internal_policy_ignores_display_labels_and_changes_snapshot_identity()
    {
        var m = Fixture();
        var tables = m.Tables with { Properties = m.Tables.Properties.Select(p => p.Name == "Width" ? p with { NumberValue = 3 } : p).ToImmutableArray() };
        var p = BuildingMapper.Map(BimModel.Create(tables), Options() with { NumericStorage = NumericStoragePolicy.RevitInternal });
        Assert.That(((Fact<Length>.Known)p.Doors[0].NominalWidth).Value.Metres, Is.EqualTo(0.9144).Within(1e-12));
        Assert.That(p.Snapshot.Id, Is.Not.EqualTo(BuildingMapper.Map(BimModel.Create(tables), Options()).Snapshot.Id));
        Assert.That(p.Policies.Single().Description, Does.Contain("RevitInternal"));
        Assert.That(ProjectionValidation.Validate(p with { Policies = [] }).Any(d => d.Code == "validation.policy"), Is.True);
        Assert.That(ProjectionValidation.Validate(p with { Documents = [] }).Any(d => d.Code == "validation.document"), Is.True);
    }

    [Test]
    public void Real_source_prefixed_room_links_and_number_are_supported()
    {
        var m = Fixture();
        string Alias(string? s) => s switch { "Number" => "Rvt:Room:Number", "From Room" => "Rvt:FamilyInstance:FromRoom", "To Room" => "Rvt:FamilyInstance:ToRoom", "Level" => "Rvt:Element:Level", _ => s! };
        var descriptors = m.Tables.Descriptors.Select(d => d with { Name = Alias(d.Name), Group = "RevitAPI", Key = d.Key with { Name = TextNormalization.Key(Alias(d.Name)), Group = "REVITAPI" } }).ToImmutableArray();
        var p = BuildingMapper.Map(BimModel.Create(m.Tables with
        {
            Descriptors = descriptors,
            Properties = m.Tables.Properties.Select(r => r with { Name = descriptors[r.DescriptorId].Name, Group = "RevitAPI", Key = descriptors[r.DescriptorId].Key }).ToImmutableArray()
        }), Options());
        Assert.That(p.Doors[0].AdjacentSpaces.Items, Has.Length.EqualTo(2));
        Assert.That(p.Spaces.All(s => s.Number is Fact<string>.Known { Value: "101" }), Is.True);
        Assert.That(p.Spaces.All(s => s.Storey is Fact<SnapshotKey<Storey>>.Known), Is.True);
    }

    [TestCase("2 HR", 120)]
    [TestCase("90 MIN", 90)]
    [TestCase("90", -1)]
    public void Fire_rating_requires_explicit_time_units(string rating, int expectedMinutes)
    {
        var m = Fixture();
        var key = new PropertyKey("FIRE RATING", "IDENTITY DATA", "", ParameterType.String);
        var descriptor = new DescriptorRow(m.Tables.Descriptors.Length, "Fire Rating", "Identity Data", "", ParameterType.String, key);
        var value = new PropertyRow(m.Tables.Properties.Length, 5, descriptor.Id, descriptor.Name, descriptor.Group, descriptor.Units, key, true, 0, TextValue: rating);
        var p = BuildingMapper.Map(BimModel.Create(m.Tables with { Descriptors = m.Tables.Descriptors.Add(descriptor), Properties = m.Tables.Properties.Add(value) }), Options());
        if (expectedMinutes < 0) Assert.That(p.Doors[0].FireResistance, Is.TypeOf<Fact<DurationValue>.Missing>());
        else Assert.That(((Fact<DurationValue>.Known)p.Doors[0].FireResistance).Value.Value.TotalMinutes, Is.EqualTo(expectedMinutes));
    }

    [Test]
    public void Invalid_missing_and_conflicting_are_distinct_and_denominators_cover_every_door()
    {
        var m = Fixture();
        var invalid = m.Tables.Properties.Select(r => r.Name == "Width" ? r with { IsValid = false, NumberValue = null } : r).ToImmutableArray();
        var p = BuildingMapper.Map(BimModel.Create(m.Tables with { Properties = invalid }), Options());
        Assert.That(((Fact<Length>.Missing)p.Doors[0].NominalWidth).Reason, Is.EqualTo(Availability.Invalid));
        Assert.That(p.Coverage.Single(c => c.EntityKind == "Door" && c.Field == "NominalWidth").Invalid, Is.EqualTo(1));
        Assert.That(p.Coverage.Single(c => c.EntityKind == "Door" && c.Field == "ClearWidth").Missing, Is.EqualTo(1));
        Assert.That(p.Coverage.Where(c => c.EntityKind == "Door").All(c => c.Total == 1), Is.True);
    }

    [Test]
    public void Wrong_typed_reference_is_invalid_not_a_silent_missing_level()
    {
        var m = Fixture();
        var properties = m.Tables.Properties.Select(r => r.EntityId == 3 && r.Name == "Level" ? r with { ReferenceEntityId = 4 } : r).ToImmutableArray();
        var p = BuildingMapper.Map(BimModel.Create(m.Tables with { Properties = properties }), Options());
        Assert.That(((Fact<SnapshotKey<Storey>>.Missing)p.Doors[0].Element.Location.PrimaryStorey).Reason, Is.EqualTo(Availability.Invalid));
        Assert.That(p.Diagnostics.Any(d => d.Code == "field.invalid" && d.Field == "Storey"), Is.True);
    }

    [Test]
    public void Same_name_in_unrelated_group_does_not_supply_width()
    {
        var m = Fixture();
        var width = m.Tables.Descriptors.Single(d => d.Name == "Width");
        var key = width.Key with { Group = "COST PLANNING" };
        var p = BuildingMapper.Map(BimModel.Create(m.Tables with
        {
            Descriptors = m.Tables.Descriptors.Select(d => d.Id == width.Id ? d with { Group = "Cost Planning", Key = key } : d).ToImmutableArray(),
            Properties = m.Tables.Properties.Select(r => r.DescriptorId == width.Id ? r with { Group = "Cost Planning", Key = key } : r).ToImmutableArray()
        }), Options());
        Assert.That(p.Doors[0].NominalWidth, Is.TypeOf<Fact<Length>.Missing>());
    }

    [Test]
    public void Net_roof_surface_is_separate_from_projection_and_generic_area_is_not_selected()
    {
        var p = BuildingMapper.Map(Fixture(), Options());
        Assert.That(((Fact<Area>.Known)p.Roofs[0].NetSurfaceArea).Value.SquareMetres, Is.EqualTo(125));
        Assert.That(((Fact<Area>.Known)p.Roofs[0].ProjectedArea).Value.SquareMetres, Is.EqualTo(100));
        var report = ArchitecturalWorkflows.Takeoff(p);
        Assert.That(report.Findings[0], Does.Contain("125 m2 across 1/1"));
        var m = Fixture();
        var gap = BuildingMapper.Map(BimModel.Create(m.Tables with { Properties = m.Tables.Properties.Where(r => r.Name != "Net Surface Area").ToImmutableArray() }), Options());
        Assert.That(gap.Roofs[0].NetSurfaceArea, Is.TypeOf<Fact<Area>.Missing>());
        Assert.That(ArchitecturalWorkflows.Takeoff(gap).Status, Is.EqualTo(WorkflowStatus.RequiresInput));
        Assert.That(gap.Diagnostics.Any(d => d.Code == "quantity.unspecified-basis"), Is.True);
    }

    [Test]
    public void Reimport_and_reordering_preserve_semantics_but_real_changes_are_found()
    {
        var first = BuildingMapper.Map(Fixture(), Options());
        var repeat = BuildingMapper.Map(Fixture(), Options("sha256:second"));
        Assert.That(ArchitecturalWorkflows.Compare(first, repeat, true).Rows.All(r => r[2] == "Unchanged"), Is.True);
        var reordered = BuildingMapper.Map(Reorder(Fixture()), Options("sha256:third"));
        Assert.That(ArchitecturalWorkflows.Compare(first, reordered, true).Rows.All(r => r[2] == "Unchanged"), Is.True);
        var changed = BuildingMapper.Map(Fixture(roomName: "Renamed office"), Options("sha256:fourth"));
        Assert.That(ArchitecturalWorkflows.Compare(first, changed, true).Rows.Count(r => r[2] == "Changed"), Is.EqualTo(1));
    }

    [Test]
    public void Omission_is_removal_only_in_complete_comparable_scope()
    {
        var first = BuildingMapper.Map(Fixture(), Options());
        var m = Fixture();
        var after = BuildingMapper.Map(BimModel.Create(m.Tables with { Entities = m.Tables.Entities.Select(e => e.Id == 4 ? e with { Category = "Other" } : e).ToImmutableArray() }), Options("sha256:second"));
        Assert.That(ArchitecturalWorkflows.Compare(first, after, false).Rows.Count(r => r[2] == "Omitted; removal unresolved"), Is.EqualTo(1));
        Assert.That(ArchitecturalWorkflows.Compare(first, after, true).Rows.Count(r => r[2] == "Removed"), Is.EqualTo(1));
        Assert.That(ArchitecturalWorkflows.Compare(after, first, false).Rows.Count(r => r[2] == "Newly observed; addition unresolved"), Is.EqualTo(1));
        Assert.That(ArchitecturalWorkflows.Compare(after, first, true).Rows.Count(r => r[2] == "Added"), Is.EqualTo(1));
        var unrelated = BuildingMapper.Map(Fixture(), Options(scope: "different-lineage"));
        Assert.That(ArchitecturalWorkflows.Compare(first, unrelated, true).Status, Is.EqualTo(WorkflowStatus.RequiresInput));
    }

    [Test]
    public void Duplicate_global_ids_remain_disputed_and_local_only_ids_unresolved()
    {
        var m = Fixture();
        var duplicate = BuildingMapper.Map(BimModel.Create(m.Tables with { Entities = m.Tables.Entities.Select(e => e.Id == 2 ? e with { GlobalId = "room-a" } : e).ToImmutableArray() }), Options());
        Assert.That(duplicate.Objects.Count(o => o.IdentityStatus == IdentityStatus.Disputed), Is.EqualTo(2));
        Assert.That(duplicate.Spaces, Has.Length.EqualTo(2));
        Assert.That(ArchitecturalWorkflows.Compare(duplicate, duplicate, true).Rows.Count(r => r[2] == "Unresolved identity"), Is.EqualTo(2));
        var local = BuildingMapper.Map(BimModel.Create(m.Tables with { Entities = m.Tables.Entities.Select(e => e.Id == 3 ? e with { GlobalId = null } : e).ToImmutableArray() }), Options());
        Assert.That(local.Objects.Count(o => o.IdentityStatus == IdentityStatus.Provisional), Is.EqualTo(1));
    }

    [Test]
    public void Finish_takeoff_keeps_opposite_faces_separate_and_does_not_count_duplicate_representations()
    {
        var p = BuildingMapper.Map(Fixture(), Options());
        Fact<T> Known<T>(T value) => new Fact<T>.Known(value, Assurance.Observed, []);
        Fact<T> Missing<T>() => Fact<T>.Unknown("Fixture omission.");
        FinishSurface Finish(string id, string face, double area) => new(new(p.Snapshot.Id, id), p.Doors[0].Element,
            Known(new ReferenceKey<BimObject>("fixture-wall")), Known(face), Known("whole-face-minus-door"), LinkSet<Space>.Unknown(),
            Known("Wall face; measured gross 12 m2 minus independently measured 2 m2 opening"),
            Missing<ReferenceKey<AssemblyDefinition>>(), Missing<ReferenceKey<Material>>(), Known("Paint"), Known(new Area(area)),
            Missing<Length>(), Missing<Length>(), Missing<SnapshotKey<QuantityObservation>>());
        var first = Finish("face-a", "A", 10);
        var second = Finish("face-b", "B", 8);
        var duplicate = first with { Id = new(p.Snapshot.Id, "other-geometry-representation") };
        var report = ArchitecturalWorkflows.Takeoff(p with { Finishes = [first, second, duplicate] });
        Assert.That(report.Rows.Count(r => r[0] == "Finish"), Is.EqualTo(2));
        Assert.That(report.Findings.Any(f => f.Contains("18 m2 across 2 explicit")), Is.True);
        var contradictory = duplicate with { NetArea = Known(new Area(11)) };
        var disputed = ArchitecturalWorkflows.Takeoff(p with { Finishes = [first, second, contradictory] });
        Assert.That(disputed.Findings.Any(f => f.Contains("8 m2 across 1 explicit") && f.Contains("unresolved scopes: 1")), Is.True);
        var missingFace = first with { HostFaceIdentifier = Missing<string>() };
        Assert.That(ArchitecturalWorkflows.Takeoff(p with { Finishes = [missingFace] }).Findings.Any(f => f.Contains("0 m2 across 0 explicit") && f.Contains("unresolved scopes: 1")), Is.True);
    }

    private static BimModel Reorder(BimModel source)
    {
        var n = source.Tables.Entities.Length;
        int? Map(int? i) => i is { } x ? n - 1 - x : null;
        return BimModel.Create(source.Tables with
        {
            Entities = source.Tables.Entities.Reverse().Select(e => e with { Id = Map(e.Id)!.Value, TypeId = Map(e.TypeId), CategoryId = Map(e.CategoryId) }).ToImmutableArray(),
            Properties = source.Tables.Properties.Reverse().Select((p, i) => p with { Id = i, EntityId = Map(p.EntityId)!.Value, ReferenceEntityId = Map(p.ReferenceEntityId) }).ToImmutableArray()
        });
    }

    private static BimModel Fixture(bool conflictingWidth = false, string roomName = "Office")
    {
        var fixture = new MappingFixture()
            .Entity(0, "level-a", "Level 1", "Levels").Entity(1, "room-a", roomName, "Rooms").Entity(2, "room-b", "Hall", "Rooms")
            .Entity(3, "door-a", "D1", "Doors", typeId: 5).Entity(4, "roof-a", "Pitched roof", "Roofs").Entity(5, "door-type", "Type 900", "Doors", isType: true);
        foreach (var id in new[] { 1, 2, 3, 4 }) fixture.Reference(id, "Level", 0);
        fixture.Number(0, "Elevation", -1, "m").Text(1, "Number", "101").Text(2, "Number", "101")
            .Reference(3, "From Room", 1, "Other").Reference(3, "To Room", 2, "Other").Number(5, "Width", 900);
        if (conflictingWidth) fixture.Number(3, "Width", 1000);
        fixture.Number(4, "Net Surface Area", 125, "m2").Number(4, "Projected Area", 100, "m2").Number(4, "Area", 200, "m2");
        return fixture.Model();
    }
}
