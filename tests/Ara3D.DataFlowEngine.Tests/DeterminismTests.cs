using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class DeterminismTests
{
    [Test]
    public void Two_fresh_engines_produce_identical_hashes()
    {
        var doc = GraphDocument.Empty
            .AddNode("a", "test.const", 1).SetParam("a", "value", "5")
            .AddNode("b", "test.const", 1).SetParam("b", "value", "6")
            .AddNode("sum", "test.add", 1)
            .AddNode("neg", "test.negate", 1)
            .Connect("a.out", "sum.a")
            .Connect("b.out", "sum.b")
            .Connect("sum.out", "neg.in");
        var first = doc.Evaluate(TestNodes.Registry);
        var second = doc.Evaluate(TestNodes.Registry);
        foreach (var id in first.Results.Keys)
            Assert.That(second.Results[id].OutputHashes, Is.EqualTo(first.Results[id].OutputHashes), id);
    }

    [Test]
    public void Session_and_one_shot_agree_after_edits()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain(1));
        var incremental = session.UpdateDocument(d => d.SetParam("c", "value", "3"));
        var fresh = TestNodes.Chain(3).Evaluate(TestNodes.Registry);
        foreach (var id in fresh.Results.Keys)
            Assert.That(incremental.Results[id].OutputHashes, Is.EqualTo(fresh.Results[id].OutputHashes), id);
    }

    [Test]
    public void Memo_key_is_stable_and_order_insensitive()
    {
        var key1 = MemoKey.Compute("k", 1,
            new Dictionary<string, string> { ["b"] = "2", ["a"] = "1" },
            new[] { ("y", "h2"), ("x", "h1") });
        var key2 = MemoKey.Compute("k", 1,
            new Dictionary<string, string> { ["a"] = "1", ["b"] = "2" },
            new[] { ("x", "h1"), ("y", "h2") });
        Assert.That(key1, Is.EqualTo(key2));
        Assert.That(key1, Is.Not.EqualTo(MemoKey.Compute("k", 2,
            new Dictionary<string, string> { ["a"] = "1", ["b"] = "2" },
            new[] { ("x", "h1"), ("y", "h2") })));
    }

    [Test]
    public void Table_hash_is_stable_across_independent_constructions()
    {
        static TableValue Build()
        {
            var builder = new DataTableBuilder("t");
            builder.AddColumn(new[] { 1.5, double.NaN, -0.0 }, "n");
            builder.AddColumn(new[] { true, false, true }, "f");
            return new TableValue(builder.Build());
        }
        var first = ValueHash.Compute(Build());
        var second = ValueHash.Compute(Build());
        Assert.That(second, Is.EqualTo(first));
    }
}
