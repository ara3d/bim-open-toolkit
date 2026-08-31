using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs.Tests;

[TestFixture]
public class JsonTests
{
    private static readonly DateTimeOffset Timestamp = new(2026, 8, 31, 0, 0, 0, TimeSpan.Zero);

    private static RunRecord FreezeTableGraph()
    {
        var doc = TestGraphs.Doc(
            new GraphNode[] { new("t", "test.table", 1) },
            Array.Empty<GraphEdge>());
        var inputs = new[]
        {
            new RunInput("t", "path", Hashes.HashBytes("model bytes"u8), "models/tower-a.bos"),
        };
        var snapshot = doc.Evaluate(TestGraphs.Registry);
        var record = RunRecorder.Freeze(snapshot, TestGraphs.Registry, inputs, "test-engine 0.1.0", Timestamp);
        return record with
        {
            Effects = new[] { new EffectRecord("s1", EffectStatus.Ok), new EffectRecord("s2", EffectStatus.Failed, "boom") },
        };
    }

    [Test]
    public void RoundTrip_ByteIdentical()
    {
        var record = FreezeTableGraph();
        var json = record.ToCanonicalJson();
        var reparsed = RunRecordJson.Parse(json);
        Assert.That(reparsed.ToCanonicalJson(), Is.EqualTo(json));
    }

    [Test]
    public void RoundTrip_PreservesEverySerializedField()
    {
        var record = FreezeTableGraph();
        var reparsed = RunRecordJson.Parse(record.ToCanonicalJson());
        Assert.Multiple(() =>
        {
            Assert.That(reparsed.GraphHash, Is.EqualTo(record.GraphHash));
            Assert.That(reparsed.EngineVersion, Is.EqualTo(record.EngineVersion));
            Assert.That(reparsed.TimestampUtc, Is.EqualTo(record.TimestampUtc));
            Assert.That(reparsed.Inputs, Is.EqualTo(record.Inputs));
            Assert.That(reparsed.NodeOutputs, Is.EquivalentTo(record.NodeOutputs));
            Assert.That(reparsed.Effects, Is.EqualTo(record.Effects));
        });
    }

    [Test]
    public void ReparsedTable_HashesToNodeOutputsEntry()
    {
        var record = FreezeTableGraph();
        var reparsed = RunRecordJson.Parse(record.ToCanonicalJson());
        Assert.That(reparsed.FirstCorruptOutput(), Is.Null,
            "runs.md section 3: serialized values must hash to their nodeOutputs entries");
        Assert.That(ValueHash.Compute(reparsed.RecordedOutputs["t.out"]),
            Is.EqualTo(record.NodeOutputs["t.out"]));
    }

    [Test]
    public void Freeze_DeterministicBytes()
    {
        var doc = TestGraphs.AddGraph();
        var inputs = new[] { new RunInput("a", "path", new string('b', 64), "x.bos") };
        string Bytes()
            => RunRecorder.Freeze(doc.Evaluate(TestGraphs.Registry), TestGraphs.Registry,
                inputs, "engine", Timestamp).ToCanonicalJson();
        var first = Bytes();
        var second = Bytes();
        Assert.That(second, Is.EqualTo(first));
    }

    [Test]
    public void NonFiniteNumbers_RoundTrip()
    {
        var record = RunRecordJson.Parse(FreezeTableGraph().ToCanonicalJson());
        var table = ((TableValue)record.RecordedOutputs["t.out"]).Table;
        Assert.That(table[2, 1], Is.NaN); // ratio column, row 1
    }

    [Test]
    public void Parse_RejectsUnknownMember()
    {
        var json = FreezeTableGraph().ToCanonicalJson()
            .Replace("\"runVersion\"", "\"signature\": \"x\",\n  \"runVersion\"");
        Assert.That(() => RunRecordJson.Parse(json), Throws.TypeOf<FormatException>());
    }

    [Test]
    public void Parse_RejectsWrongRunVersion()
    {
        var json = FreezeTableGraph().ToCanonicalJson().Replace("\"0.1.0\"", "\"9.9.9\"");
        Assert.That(() => RunRecordJson.Parse(json), Throws.TypeOf<FormatException>());
    }

    [Test]
    public void SaveLoad_UsesRunJsonExtension()
    {
        var record = FreezeTableGraph();
        var path = Path.Combine(TestContext.CurrentContext.WorkDirectory, $"roundtrip{RunRecord.FileExtension}");
        record.Save(path);
        Assert.That(RunRecordJson.Load(path).ToCanonicalJson(), Is.EqualTo(record.ToCanonicalJson()));
    }

    [Test]
    public void HashFile_MatchesKnownSha256()
    {
        var path = Path.Combine(TestContext.CurrentContext.WorkDirectory, "empty.bin");
        File.WriteAllBytes(path, Array.Empty<byte>());
        Assert.That(Hashes.HashFile(path),
            Is.EqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
    }

    [Test]
    public void FirstCorruptOutput_DetectsTampering()
    {
        var record = FreezeTableGraph();
        var tampered = record with
        {
            NodeOutputs = new Dictionary<string, string> { ["t.out"] = new string('c', 64) },
        };
        Assert.That(tampered.FirstCorruptOutput(), Is.EqualTo("t.out"));
    }
}
