using System.Text.Json;
using Ara3D.DataFlowEngine.Expressions;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

/// <summary>
/// Runs every vector in spec/dataflow-graph/expressions/conformance against the
/// implementation. Vector format: expressions.md section 8.
/// </summary>
[TestFixture]
public class ConformanceTests
{
    public static IEnumerable<TestCaseData> Vectors()
    {
        var dir = FindConformanceDir();
        if (dir == null)
            yield break;
        foreach (var file in Directory.GetFiles(dir, "*.json").OrderBy(f => f))
            yield return new TestCaseData(file).SetName(Path.GetFileNameWithoutExtension(file));
    }

    [TestCaseSource(nameof(Vectors))]
    public void Vector(string file)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(file));
        var input = doc.RootElement.GetProperty("input");
        var text = input.GetProperty("expression").GetString()!;
        var (env, values) = ReadEnvironment(input.GetProperty("environment"));
        var expect = doc.RootElement.GetProperty("expect");

        var parsed = Expression.Parse(text);
        if (expect.TryGetProperty("error", out var error))
        {
            var kind = error.GetString();
            if (kind is "lexical" or "syntax")
            {
                Assert.That(parsed.Success, Is.False, $"expected a {kind} error for: {text}");
            }
            else
            {
                Assert.That(parsed.Success, Is.True, $"expected a clean parse for: {text}");
                Assert.That(parsed.Check(env).Success, Is.False, $"expected a type error for: {text}");
            }
            return;
        }

        Assert.That(parsed.Errors, Is.Empty, text);
        var checkedExpr = parsed.Check(env);
        Assert.That(checkedExpr.Errors, Is.Empty, text);
        Assert.That(checkedExpr.Type?.ToString(), Is.EqualTo(expect.GetProperty("type").GetString()), "static type");
        var result = checkedExpr.Eval(name => values.GetValueOrDefault(name));
        AssertValue(result, expect.GetProperty("value"));
    }

    private static (IReadOnlyDictionary<string, ScalarType> Env, Dictionary<string, Scalar?> Values)
        ReadEnvironment(JsonElement environment)
    {
        var env = new Dictionary<string, ScalarType>();
        var values = new Dictionary<string, Scalar?>();
        foreach (var property in environment.EnumerateObject())
        {
            var type = Enum.Parse<ScalarType>(property.Value.GetProperty("type").GetString()!);
            env[property.Name] = type;
            values[property.Name] = ReadScalar(property.Value.GetProperty("value"));
        }
        return (env, values);
    }

    private static Scalar? ReadScalar(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Null)
            return null;
        var kind = value.GetProperty("kind").GetString();
        var inner = value.GetProperty("value");
        if (inner.ValueKind == JsonValueKind.Null)
            return null;
        return kind switch
        {
            "Boolean" => new BooleanScalar(inner.GetBoolean()),
            "Integer" => new IntegerScalar(inner.GetInt64()),
            "Number" => new NumberScalar(ReadNumber(inner)),
            "Text" => new TextScalar(inner.GetString()!),
            _ => throw new InvalidOperationException($"Unknown vector value kind {kind}"),
        };
    }

    private static double ReadNumber(JsonElement element)
        => element.ValueKind == JsonValueKind.String
            ? element.GetString() switch
            {
                "NaN" => double.NaN,
                "Infinity" => double.PositiveInfinity,
                "-Infinity" => double.NegativeInfinity,
                var s => throw new InvalidOperationException($"Unknown number string {s}"),
            }
            : element.GetDouble();

    private static void AssertValue(Scalar? actual, JsonElement expected)
    {
        var expectedScalar = ReadScalar(expected);
        if (expectedScalar is NumberScalar { Value: double.NaN })
            Assert.That(((NumberScalar)actual!).Value, Is.NaN);
        else
            Assert.That(actual, Is.EqualTo(expectedScalar));
    }

    private static string? FindConformanceDir()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "spec", "dataflow-graph", "expressions", "conformance");
            if (Directory.Exists(candidate))
                return candidate;
            dir = dir.Parent;
        }
        return null;
    }
}
