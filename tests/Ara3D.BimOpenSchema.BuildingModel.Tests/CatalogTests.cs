using Microsoft.VisualBasic.FileIO;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Review"), Category("Source.Catalog")]
public sealed class CatalogTests
{
    [Test, Category("Feature.Catalog"), Category("Workflow.ModelReview")]
    public void EveryWorkflowCandidateHasAnIndexEntryPointingToActualCompiledTypes()
    {
        var coverage = ReadCsv("model-coverage.csv");
        Assert.That(coverage.Select(r => r[0]), Is.Unique, "A candidate has one authoritative coverage entry.");
        foreach (var row in coverage)
        foreach (var name in row[1].Split(';'))
        {
            var type = typeof(BimObject).Assembly.GetType($"Ara3D.BimOpenSchema.BuildingModel.{name}");
            Assert.That(type, Is.Not.Null, $"{row[0]} points to missing model type {name}");
        }
    }

    [Test, Category("Feature.Catalog"), Category("Workflow.ModelReview")]
    public void CoreCoverageDoesNotListDeferredLifecycleOrAnalysisCapabilities()
    {
        var deferred = new[]
        {
            "work_package", "procurement_line", "installation_observation", "asset_service_requirements",
            "maintenance_plan", "impact_breakdown", "requirement_assessment", "evidence_issue", "acoustic_response"
        };

        Assert.That(ReadCsv("model-coverage.csv").Select(row => row[0]), Does.Not.Contain(deferred));
    }

    [Test, Category("Feature.Identity"), Category("Workflow.ModelReview")]
    public void TableIdentitiesAndForeignKeysReferToTheirDeclaredRowTypes()
    {
        var rows = typeof(BimObject).Assembly.GetExportedTypes().Where(t => t.GetProperty("Id") != null).ToArray();
        Assert.That(rows, Is.Not.Empty);
        foreach (var row in rows)
        {
            var key = row.GetProperty("Id")!.PropertyType;
            Assert.That(key.IsGenericType, Is.True, row.Name);
            Assert.That(key.GetGenericTypeDefinition(), Is.AnyOf(typeof(ReferenceKey<>), typeof(SnapshotKey<>)), row.Name);
            Assert.That(key.GetGenericArguments().Single(), Is.EqualTo(row), row.Name);
        }

        // This catches a misspelled or inline-only record accidentally used as a table key.
        foreach (var type in typeof(BimObject).Assembly.GetExportedTypes().Where(t => !t.ContainsGenericParameters))
        foreach (var property in type.GetProperties())
        foreach (var reference in NestedTypes(property.PropertyType).Where(t => t.IsGenericType &&
                     (t.GetGenericTypeDefinition() == typeof(ReferenceKey<>) || t.GetGenericTypeDefinition() == typeof(SnapshotKey<>))))
        {
            var target = reference.GetGenericArguments().Single();
            Assert.That(target.GetProperty("Id")?.PropertyType, Is.EqualTo(reference), $"{type.Name}.{property.Name} refers to wrong key scope for {target.Name}");
        }
    }

    private static IEnumerable<Type> NestedTypes(Type type)
        => new[] { type }.Concat(type.IsGenericType ? type.GetGenericArguments().SelectMany(NestedTypes) : Enumerable.Empty<Type>());

    private static List<string[]> ReadCsv(string file)
    {
        using var parser = new TextFieldParser(Path.Combine(TestContext.CurrentContext.TestDirectory, file));
        parser.TextFieldType = FieldType.Delimited;
        parser.SetDelimiters(",");
        parser.HasFieldsEnclosedInQuotes = true;
        _ = parser.ReadFields();
        var rows = new List<string[]>();
        while (!parser.EndOfData) rows.Add(parser.ReadFields()!);
        return rows;
    }
}
