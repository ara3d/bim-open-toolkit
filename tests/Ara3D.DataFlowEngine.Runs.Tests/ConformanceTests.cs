using System.Text.Json;
using Ara3D.DataFlowEngine;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs.Tests;

/// <summary>
/// The two runs-part conformance vectors, executed against the engine plus the
/// inline test vocabulary. Hashes marked "TBD-by-engine" in the vectors are
/// asserted to be well-formed rather than compared to a frozen value.
/// </summary>
[TestFixture]
public class ConformanceTests
{
    private static string VectorPath(string name)
    {
        var dir = TestContext.CurrentContext.TestDirectory;
        while (dir is not null && !Directory.Exists(Path.Combine(dir, "spec", "dataflow-graph")))
            dir = Path.GetDirectoryName(dir);
        Assert.That(dir, Is.Not.Null, "Repo root with spec/dataflow-graph not found above test directory");
        return Path.Combine(dir!, "spec", "dataflow-graph", "runs", "conformance", name);
    }

    private static JsonElement LoadVector(string name)
        => JsonDocument.Parse(File.ReadAllText(VectorPath(name))).RootElement.Clone();

    [Test]
    public void Vector001_RunAndReplay()
    {
        var vector = LoadVector("001-run-and-replay.json");
        var doc = GraphDocumentIO.Parse(vector.GetProperty("input").GetProperty("document").GetRawText());

        var record = RunRecorder.Freeze(doc.Evaluate(TestGraphs.Registry), TestGraphs.Registry,
            Array.Empty<RunInput>(), "conformance-fixture", new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero));

        var expected = vector.GetProperty("expect").GetProperty("record");
        Assert.Multiple(() =>
        {
            Assert.That(Hashes.IsHash(record.GraphHash));
            Assert.That(record.Inputs, Is.Empty);
            Assert.That(record.Effects, Is.Empty);
            Assert.That(record.NodeOutputs.Keys, Is.EquivalentTo(
                expected.GetProperty("nodeOutputs").EnumerateObject().Select(p => p.Name)));
            Assert.That(record.NodeOutputs.Values, Is.All.Matches<string>(Hashes.IsHash));
            Assert.That(record.RecordedOutputs.Keys, Is.EqualTo(new[] { "sum.out" }));
            Assert.That(record.RecordedOutputs["sum.out"],
                Is.EqualTo(new Abstractions.IntegerValue(
                    expected.GetProperty("recordedOutputs").GetProperty("sum.out").GetProperty("value").GetInt64())));
        });

        var replay = RunReplay.Replay(record, doc, TestGraphs.Registry, Array.Empty<RunInput>());
        Assert.That(replay.Outcome, Is.EqualTo(ReplayOutcome.Ok));
    }

    [Test]
    public void Vector002_ReplayInputMismatch()
    {
        var vector = LoadVector("002-replay-input-mismatch.json");
        var recordEl = vector.GetProperty("input").GetProperty("record");

        // The vector's graphHash is "TBD-by-engine": the harness substitutes the
        // hash of the (empty) document under replay so the graph check passes and
        // the input check is what gets exercised (runs.md section 4 step 2).
        var doc = GraphDocument.Empty;
        var record = new RunRecord(
            doc.ComputeGraphHash(),
            recordEl.GetProperty("engineVersion").GetString()!,
            recordEl.GetProperty("timestampUtc").GetString()!,
            ReadInputs(recordEl.GetProperty("inputs")),
            new Dictionary<string, string>(),
            new Dictionary<string, Abstractions.FlowValue>(),
            Array.Empty<EffectRecord>(),
            Array.Empty<string>());

        var provided = ReadInputs(vector.GetProperty("input").GetProperty("steps")[0].GetProperty("providedInputs"));
        var result = RunReplay.Replay(record, doc, TestGraphs.Registry, provided);

        var expect = vector.GetProperty("expect").GetProperty("replay");
        Assert.Multiple(() =>
        {
            Assert.That(result.Outcome, Is.EqualTo(ReplayOutcome.InputMismatch));
            Assert.That(expect.GetProperty("outcome").GetString(), Is.EqualTo("input-mismatch"));
            Assert.That(result.Node, Is.EqualTo(expect.GetProperty("node").GetString()));
            Assert.That(result.Param, Is.EqualTo(expect.GetProperty("param").GetString()));
        });
    }

    private static IReadOnlyList<RunInput> ReadInputs(JsonElement e)
        => e.EnumerateArray()
            .Select(i => new RunInput(
                i.GetProperty("node").GetString()!,
                i.GetProperty("param").GetString()!,
                i.GetProperty("contentHash").GetString()!))
            .ToList();
}
