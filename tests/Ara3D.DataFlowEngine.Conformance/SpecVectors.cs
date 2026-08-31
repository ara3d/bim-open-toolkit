using System.Text.Json;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.Conformance;

/// <summary>
/// Locates spec/dataflow-graph relative to the test assembly and enumerates a
/// part's conformance vectors; new NNN-name.json files run without code changes.
/// </summary>
public static class SpecVectors
{
    public const string Frozen = "TBD-by-engine";

    public static string PartDir(string part)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "spec", "dataflow-graph", part, "conformance");
            if (Directory.Exists(candidate))
                return candidate;
        }
        throw new DirectoryNotFoundException(
            $"spec/dataflow-graph/{part}/conformance not found above {AppContext.BaseDirectory}");
    }

    public static IEnumerable<TestCaseData> Cases(string part)
        => Directory.GetFiles(PartDir(part), "*.json").OrderBy(f => f, StringComparer.Ordinal)
            .Select(f => new TestCaseData(f).SetName(Path.GetFileNameWithoutExtension(f)));

    public static JsonElement Root(string file)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(file));
        return doc.RootElement.Clone();
    }

    /// <summary>
    /// Checks a spec-frozen hash/value. A remaining TBD-by-engine placeholder
    /// fails loudly with the engine-computed value so it can be frozen into the file.
    /// </summary>
    public static void AssertFrozen(string file, string what, string expected, string actual)
    {
        if (expected == Frozen)
            Assert.Fail($"FREEZE {Path.GetFileName(file)}: {what} = {actual}");
        Assert.That(actual, Is.EqualTo(expected), what);
    }

    /// <summary>Reads a vector's {"kind": ..., "value": ...} expected value as a FlowValue.</summary>
    public static FlowValue ReadFlowValue(JsonElement element)
    {
        var kind = element.GetProperty("kind").GetString()!;
        var value = element.GetProperty("value");
        return kind switch
        {
            "Boolean" => new BooleanValue(value.GetBoolean()),
            "Integer" => new IntegerValue(value.GetInt64()),
            "Number" => new NumberValue(ReadNumber(value)),
            "Text" => new TextValue(value.GetString()!),
            _ => throw new InvalidOperationException($"Unsupported vector value kind '{kind}'"),
        };
    }

    private static double ReadNumber(JsonElement element)
        => element.ValueKind == JsonValueKind.String
            ? element.GetString() switch
            {
                "NaN" => double.NaN,
                "Infinity" => double.PositiveInfinity,
                "-Infinity" => double.NegativeInfinity,
                var s => throw new InvalidOperationException($"Unknown number string '{s}'"),
            }
            : element.GetDouble();
}
