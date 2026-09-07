using System.Collections.Immutable;
using System.Text.Json;
using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.IO;

[Impure]
public static class BimModelIO
{
    public static Result<BimModel, ImmutableArray<IssueRow>> LoadBos(string path, ConversionOptions? options = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        try
        {
            return BimModelConverter.Convert(BosReader.Read(path), options ?? new(Path.GetFileNameWithoutExtension(path)));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException or
            NotSupportedException or JsonException or FormatException or OverflowException or InvalidCastException)
        {
            return Failure("BosReadFailed", ex.Message);
        }
    }

    public static void WriteJson(BimModel model, Stream destination)
        => JsonSerializer.Serialize(destination, model.Tables);

    public static Result<BimModel, ImmutableArray<IssueRow>> ReadJson(Stream source)
    {
        try
        {
            var tables = JsonSerializer.Deserialize<ModelTables>(source);
            return tables is null ? Failure("InvalidSnapshot", "Snapshot is null.")
                : Result<BimModel, ImmutableArray<IssueRow>>.Ok(BimModel.Create(tables));
        }
        catch (Exception ex) when (ex is JsonException or ArgumentException or IOException or NotSupportedException)
        {
            return Failure("InvalidSnapshot", ex.Message);
        }
    }

    private static Result<BimModel, ImmutableArray<IssueRow>> Failure(string code, string message)
        => Result<BimModel, ImmutableArray<IssueRow>>.Error([new(0, IssueSeverity.Error, code, "Input", -1, null, message)]);
}
