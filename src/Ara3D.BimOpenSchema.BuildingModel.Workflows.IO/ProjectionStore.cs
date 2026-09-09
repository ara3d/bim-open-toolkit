using System.Text.Json;
using System.Text.Json.Serialization;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.IO;

/// <summary>Versioned domain projection; source evidence remains in its separate BFAST cache.</summary>
public sealed record PreparedProjection(string Format, int Version, BuildingProjection Model);

[Impure]
public static class ProjectionStore
{
    public const string Format = "ara3d.building-workflow-projection";
    public const int Version = 1;

    public static JsonSerializerOptions Options()
    {
        var options = new JsonSerializerOptions { WriteIndented = false };
        options.Converters.Add(new DomainValueConverterFactory());
        options.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false));
        return options;
    }

    public static void Write(BuildingProjection projection, Stream destination)
    {
        Validate(projection);
        JsonSerializer.Serialize(destination, new PreparedProjection(Format, Version, projection), Options());
    }

    public static BuildingProjection Read(Stream source)
    {
        var value = JsonSerializer.Deserialize<PreparedProjection>(source, Options())
            ?? throw new InvalidDataException("The prepared projection is empty.");
        if (value.Format != Format || value.Version != Version)
            throw new InvalidDataException($"Unsupported prepared projection {value.Format} version {value.Version}.");
        Validate(value.Model);
        return value.Model;
    }

    public static void Validate(BuildingProjection model)
    {
        ArgumentNullException.ThrowIfNull(model);
        if (model.Snapshot is null || string.IsNullOrWhiteSpace(model.Snapshot.Id.Value))
            throw new InvalidDataException("The projection must identify its snapshot.");
        if (model.Coverage.IsDefault || model.Diagnostics.IsDefault || ProjectionTables.All.Any(table => !table.IsPresent(model)))
            throw new InvalidDataException("Projection collections must be present, even when empty.");
        var objectIds = new HashSet<ReferenceKey<BimObject>>();
        foreach (var item in model.Objects)
            if (string.IsNullOrWhiteSpace(item.Id.Value) || !objectIds.Add(item.Id))
                throw new InvalidDataException("Object identities must be nonempty and unique.");
        foreach (var (_, row) in ProjectionTables.ElementRows(model))
            if (row.Element is null || !objectIds.Contains(row.Element.ObjectId))
                throw new InvalidDataException("Domain row must reference an object in the projection.");
        var findings = ProjectionValidation.Validate(model);
        if (findings.Length > 0)
            throw new InvalidDataException(string.Join("; ", findings.Take(10).Select(x => x.Code + ": " + x.Message)));
    }
}

/// <summary>Explicit tags for known/missing facts and constructor-validated typed key encodings.</summary>
[Impure]
public sealed class DomainValueConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert)
        => typeToConvert.IsGenericType && (typeToConvert.GetGenericTypeDefinition() == typeof(Fact<>) ||
            typeToConvert.GetGenericTypeDefinition() == typeof(ReferenceKey<>) ||
            typeToConvert.GetGenericTypeDefinition() == typeof(SnapshotKey<>));

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        var definition = typeToConvert.GetGenericTypeDefinition();
        var converter = definition == typeof(Fact<>) ? typeof(FactConverter<>)
            : definition == typeof(ReferenceKey<>) ? typeof(ReferenceConverter<>) : typeof(SnapshotConverter<>);
        return (JsonConverter)Activator.CreateInstance(converter.MakeGenericType(typeToConvert.GetGenericArguments()))!;
    }
}

[Impure]
public sealed class ReferenceConverter<T> : JsonConverter<ReferenceKey<T>>
{
    public override ReferenceKey<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString() ?? throw new JsonException("A global key must be a nonempty string."));

    public override void Write(Utf8JsonWriter writer, ReferenceKey<T> value, JsonSerializerOptions options)
    {
        if (string.IsNullOrWhiteSpace(value.Value)) throw new JsonException("Cannot store a default global key.");
        writer.WriteStringValue(value.Value);
    }
}

[Impure]
public sealed class SnapshotConverter<T> : JsonConverter<SnapshotKey<T>>
{
    public override SnapshotKey<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var document = JsonDocument.ParseValue(ref reader);
        var root = document.RootElement;
        return new(new(root.GetProperty("snapshot").GetString()!), root.GetProperty("local").GetString()!);
    }

    public override void Write(Utf8JsonWriter writer, SnapshotKey<T> value, JsonSerializerOptions options)
    {
        if (string.IsNullOrWhiteSpace(value.SnapshotId.Value) || string.IsNullOrWhiteSpace(value.Value))
            throw new JsonException("Cannot store a default snapshot key.");
        writer.WriteStartObject();
        writer.WriteString("snapshot", value.SnapshotId.Value);
        writer.WriteString("local", value.Value);
        writer.WriteEndObject();
    }
}

[Impure]
public sealed class FactConverter<T> : JsonConverter<Fact<T>>
{
    public override bool HandleNull => true;

    public override Fact<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var document = JsonDocument.ParseValue(ref reader);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object) throw new JsonException("A fact must have an explicit state.");
        var evidence = root.GetProperty("evidence")
            .Deserialize<System.Collections.Immutable.ImmutableArray<ReferenceKey<Evidence>>>(options);
        if (evidence.IsDefault) throw new JsonException("Fact evidence must be an array.");
        return root.GetProperty("state").GetString() switch
        {
            "known" => new Fact<T>.Known(root.GetProperty("value").Deserialize<T>(options)
                ?? throw new JsonException("A known fact needs a value."),
                root.GetProperty("assurance").Deserialize<Assurance>(options), evidence),
            "missing" => new Fact<T>.Missing(root.GetProperty("reason").Deserialize<Availability>(options),
                root.GetProperty("explanation").GetString() ?? throw new JsonException("A missing fact needs an explanation."), evidence),
            _ => throw new JsonException("Unknown fact state.")
        };
    }

    public override void Write(Utf8JsonWriter writer, Fact<T> value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        switch (value)
        {
            case Fact<T>.Known known:
                if (known.Value is null || known.Evidence.IsDefault) throw new JsonException("Invalid known fact.");
                writer.WriteString("state", "known");
                writer.WritePropertyName("value");
                JsonSerializer.Serialize(writer, known.Value, options);
                writer.WritePropertyName("assurance");
                JsonSerializer.Serialize(writer, known.Assurance, options);
                writer.WritePropertyName("evidence");
                JsonSerializer.Serialize(writer, known.Evidence, options);
                break;
            case Fact<T>.Missing missing:
                if (missing.Explanation is null || missing.Evidence.IsDefault) throw new JsonException("Invalid missing fact.");
                writer.WriteString("state", "missing");
                writer.WritePropertyName("reason");
                JsonSerializer.Serialize(writer, missing.Reason, options);
                writer.WriteString("explanation", missing.Explanation);
                writer.WritePropertyName("evidence");
                JsonSerializer.Serialize(writer, missing.Evidence, options);
                break;
            default: throw new JsonException("A fact must be explicitly known or missing.");
        }
        writer.WriteEndObject();
    }
}
