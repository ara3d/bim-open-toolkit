using System.Collections.Immutable;
using Ara3D.BimOpenSchema.BuildingModel.DuckDb;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.IO;
using DuckDB.NET.Data;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 contract: every core record has a projection table, every registered domain claim is well formed, and
/// a row added through the builder reaches JSON persistence and DuckDB without per-table code.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class ContractTests
{
    [Test]
    public void Every_core_table_except_the_snapshot_is_a_projection_table()
    {
        var tables = ProjectionTables.All.Select(t => t.RecordType).ToHashSet();
        var missing = CoreSchema.Tables.Select(t => t.RecordType).Where(t => t != typeof(ModelSnapshot) && !tables.Contains(t)).ToArray();
        Assert.That(missing, Is.Empty);
        Assert.That(ProjectionTables.All, Has.Length.EqualTo(CoreSchema.Tables.Length - 1));
        Assert.That(ProjectionTables.All.Count(t => t.IsElement), Is.EqualTo(52));
    }

    [Test]
    public void Registered_domains_claim_each_category_once_and_only_kinds_with_tables()
    {
        var rules = BuildingMapper.Rules(BuildingMapper.Domains);
        Assert.That(rules["DOORS"].Kind, Is.EqualTo("Door"));
        Assert.That(rules["DOORS"].Domain.Name, Is.EqualTo("Core"));
        var twice = ImmutableArray.Create(CoreMapping.Domain, CoreMapping.Domain with { Name = "Again" });
        Assert.Throws<InvalidOperationException>(() => BuildingMapper.Rules(twice));
        var unknown = ImmutableArray.Create(new DomainMapping("Bad", [new("Things", "Thing")], [], (_, _, _, _) => { }));
        Assert.Throws<InvalidOperationException>(() => BuildingMapper.Rules(unknown));
    }

    [Test]
    public void A_domain_row_reaches_json_and_duckdb_through_the_shared_tables()
    {
        var wallDomain = new DomainMapping("WallOnly", [new("Walls", "Wall")], ["Construction"], (k, e, _, b) =>
            b.Add(new Wall(k.Key<Wall>(e), k.Element(e), MappingKernel.Unknown<ReferenceKey<AssemblyDefinition>>(),
                k.Reference<Storey>(e, "BaseStorey", "Base Constraint"), MappingKernel.Unknown<SnapshotKey<Storey>>(),
                k.Number(e, "Length", "m", x => new Length(x), false, "Length"), MappingKernel.Unknown<Length>(),
                k.Number(e, "Thickness", "m", x => new Length(x), false, "Width"),
                k.Flag(e, "IsLoadBearing", "Structural"), MappingKernel.Unknown<bool>(), k.FireResistance(e),
                LinkSet<Opening>.Unknown(), LinkSet<FinishSurface>.Unknown())));
        var model = new MappingFixture()
            .Entity(0, "level-a", "Level 1", "Levels").Entity(1, "wall-a", "Basic Wall", "Walls", typeId: 2).Entity(2, "wall-type", "Generic 200", "Walls", isType: true)
            .Reference(1, "Level", 0).Reference(1, "Base Constraint", 0).Number(1, "Length", 4000).Number(2, "Width", 200, group: "Construction")
            .Integer(1, "Structural", 1).Text(2, "Fire Rating", "2 HR").Model();
        var projection = BuildingMapper.Map(model, MappingFixture.Options(), [CoreMapping.Domain, wallDomain]);

        Assert.That(projection.Walls, Has.Length.EqualTo(1));
        var wall = projection.Walls[0];
        Assert.That(((Fact<Length>.Known)wall.Length).Value.Metres, Is.EqualTo(4).Within(1e-12));
        Assert.That(((Fact<Length>.Known)wall.Thickness).Value.Metres, Is.EqualTo(0.2).Within(1e-12));
        Assert.That(((Fact<bool>.Known)wall.IsLoadBearing).Value, Is.True);
        Assert.That(((Fact<DurationValue>.Known)wall.FireResistance).Value.Value.TotalMinutes, Is.EqualTo(120));
        Assert.That(wall.BaseStorey, Is.TypeOf<Fact<SnapshotKey<Storey>>.Known>());
        Assert.That(projection.Coverage.Single(c => c.EntityKind == "Wall" && c.Field == "Thickness").Known, Is.EqualTo(1));
        Assert.That(projection.Diagnostics.Where(d => d.Code.StartsWith("validation.")), Is.Empty);

        using var stream = new MemoryStream();
        ProjectionStore.Write(projection, stream);
        stream.Position = 0;
        var reopened = ProjectionStore.Read(stream);
        var reopenedThickness = (Fact<Length>.Known)reopened.Walls.Single().Thickness;
        Assert.That(reopenedThickness.Value, Is.EqualTo(((Fact<Length>.Known)wall.Thickness).Value));
        Assert.That(reopenedThickness.Evidence.Single(), Is.EqualTo(((Fact<Length>.Known)wall.Thickness).Evidence.Single()));

        var directory = Directory.CreateDirectory(Path.Combine(TestContext.CurrentContext.WorkDirectory, "contract-" + Guid.NewGuid().ToString("N"))).FullName;
        try
        {
            var database = Path.Combine(directory, "wall.duckdb");
            new DuckDbProjectionWriter().Write(projection, database);
            using var connection = new DuckDBConnection($"DataSource={database};ACCESS_MODE=READ_ONLY");
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT thickness FROM wall";
            Assert.That(Convert.ToDouble(command.ExecuteScalar()), Is.EqualTo(0.2).Within(1e-12));
        }
        finally
        {
            Directory.Delete(directory, true);
        }
    }

    [Test]
    public void Dangling_snapshot_and_global_references_are_reported_for_any_table()
    {
        var projection = new MappingFixture().Entity(0, "level-a", "Level 1", "Levels").Map();
        var storey = projection.Storeys.Single();
        var elsewhere = new SnapshotKey<Space>(projection.Snapshot.Id, "missing-space");
        var broken = projection with { Storeys = [storey with { Spaces = new([elsewhere], Completeness.Partial, []) }] };
        Assert.That(ProjectionValidation.Validate(broken).Select(d => d.Code), Does.Contain("validation.reference"));
        var wrongSnapshot = projection with { Storeys = [storey with { Id = new(new("snapshot/other"), storey.Id.Value) }] };
        Assert.That(ProjectionValidation.Validate(wrongSnapshot).Select(d => d.Code), Does.Contain("validation.snapshot"));
        var product = new ProductDefinition(new("product/missing-type"), "Type", "1", MappingKernel.Unknown<string>(), MappingKernel.Unknown<string>(),
            MappingKernel.Unknown<string>(), MappingKernel.Unknown<ReferenceKey<Material>>(),
            new Fact<ReferenceKey<AssemblyDefinition>>.Known(new("assembly/absent"), Assurance.Observed, []), [], []);
        var danglingGlobal = projection with { ProductDefinitions = [product] };
        Assert.That(ProjectionValidation.Validate(danglingGlobal).Single(d => d.Code == "validation.reference").Field, Is.EqualTo("AssemblyDefinition"));
        Assert.That(RowReferences.Of(storey).Select(r => r.Target), Does.Contain(typeof(BimObject)));
    }

    /// <summary>An unobserved field is the coverage denominator's business. One diagnostic per occurrence per field
    /// only repeats FieldCoverage, at the scale of the whole model; an invalid or conflicting value still reports.</summary>
    [Test]
    public void An_unobserved_field_is_reported_by_coverage_and_not_by_a_diagnostic_per_occurrence()
    {
        // "GENERAL" has no canonical dimension, so the height descriptor is present but resolves to nothing: exactly
        // the case that used to raise one diagnostic per occurrence per field.
        var p = new MappingFixture().Entity(0, "level-a", "Level 1", "Levels").Entity(1, "wall-a", "Wall 1", "Walls")
            .Reference(1, "Level", 0).Number(1, "Unconnected Height", 3000, units: "GENERAL", group: "Constraints")
            .Integer(1, "Structural", 2, group: "Structural").Map();
        Assert.Multiple(() =>
        {
            Assert.That(p.Coverage.Single(c => c.EntityKind == "Wall" && c.Field == "Height").Missing, Is.EqualTo(1));
            Assert.That(p.Diagnostics.Where(d => d.Code == "field.notobserved"), Is.Empty);
            Assert.That(p.Diagnostics.Count(d => d.Code == "field.invalid" && d.Field == "IsLoadBearing"), Is.EqualTo(1));
        });
    }

    /// <summary>A finding's subject is built from the projection's table name, which is plural, so the per-domain
    /// "no validation findings" filters must be built from that name rather than the singular record name.</summary>
    [Test]
    public void The_per_domain_validation_filter_actually_selects_a_finding_about_its_own_records()
    {
        var projection = new MappingFixture().Entity(0, "level-a", "Level 1", "Levels").Map();
        var storey = projection.Storeys.Single();
        var broken = projection with { Storeys = [storey with { Spaces = new([new(projection.Snapshot.Id, "missing-space")], Completeness.Partial, []) }] };
        broken = broken with { Diagnostics = broken.Diagnostics.AddRange(ProjectionValidation.Validate(broken)) };
        Assert.That(ProjectionFindings.Validation(broken, typeof(Storey)).Select(d => d.Code), Does.Contain("validation.reference"));
        Assert.That(ProjectionFindings.Validation(broken, typeof(Wall)), Is.Empty);
    }
}
