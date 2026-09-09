using System.Collections.Immutable;
using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Builds a small source model for mapping tests. Entity ids must be added in order, starting at zero, because
/// the source tables are positional. Descriptors are shared by (name, group, units, kind), as a real export would.</summary>
[Platonic.Impure]
public sealed class MappingFixture
{
    private readonly List<DocumentRow> documents = [new(0, "Fixture", "fixture.rvt")];
    private readonly List<EntityRow> entities = [];
    private readonly List<DescriptorRow> descriptors = [];
    private readonly List<PropertyRow> rows = [];

    public static MappingOptions Options(string content = "sha256:first", string scope = "fixture-lineage", bool declared = true,
        NumericStoragePolicy storage = NumericStoragePolicy.Unknown)
        => new("fixture", content, scope, DateTimeOffset.Parse("2026-01-01T00:00:00Z"), declared, storage);

    public MappingFixture Document(int id, string title, string path)
    {
        documents.Add(new(id, title, path));
        return this;
    }

    public MappingFixture Entity(int id, string? globalId, string name, string category, int? typeId = null, bool isType = false, int document = 0)
    {
        if (id != entities.Count) throw new ArgumentException($"Entity ids are positional; expected {entities.Count}.", nameof(id));
        entities.Add(new(id, "row/" + id, 1000 + id, globalId, document, documents[document].Title, name, null, category, typeId, null, isType, false));
        return this;
    }

    public MappingFixture Text(int owner, string name, string value, string group = "Identity Data")
        => Property(owner, name, group, "", ParameterType.String, text: value);

    public MappingFixture Number(int owner, string name, double value, string units = "mm", string group = "Dimensions")
        => Property(owner, name, group, units, ParameterType.Number, number: value);

    public MappingFixture Integer(int owner, string name, long value, string group = "Constraints")
        => Property(owner, name, group, "", ParameterType.Int, integer: value);

    public MappingFixture Reference(int owner, string name, int target, string group = "Constraints")
        => Property(owner, name, group, "", ParameterType.Entity, reference: target);

    public MappingFixture Property(int owner, string name, string group, string units, ParameterType kind,
        double? number = null, string? text = null, int? reference = null, long? integer = null)
    {
        var key = new PropertyKey(TextNormalization.Key(name), TextNormalization.Key(group), TextNormalization.UnitKey(units), kind);
        var descriptor = descriptors.FirstOrDefault(d => d.Key == key);
        if (descriptor is null) descriptors.Add(descriptor = new(descriptors.Count, name, group, units, kind, key));
        rows.Add(new(rows.Count, owner, descriptor.Id, name, group, units, key, true, 0, IntegerValue: integer, NumberValue: number, TextValue: text, ReferenceEntityId: reference));
        return this;
    }

    public BimModel Model()
        => BimModel.Create(new(new("1.0", "fixture", "1.0", "Fixture"), documents.ToImmutableArray(),
            entities.ToImmutableArray(), descriptors.ToImmutableArray(), rows.ToImmutableArray(), [], [], [], []));

    public BuildingProjection Map(MappingOptions? options = null) => BuildingMapper.Map(Model(), options ?? Options());
}
