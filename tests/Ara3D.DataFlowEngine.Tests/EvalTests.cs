using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class EvalTests
{
    [Test]
    public void Chain_evaluates_in_dependency_order()
    {
        var snapshot = TestNodes.Chain(42).Evaluate(TestNodes.Registry);
        Assert.That(snapshot.IntegerOutput("c"), Is.EqualTo(42));
        Assert.That(snapshot.IntegerOutput("n"), Is.EqualTo(-42));
        Assert.That(snapshot.IntegerOutput("p"), Is.EqualTo(-42));
        Assert.That(snapshot.Results.Values.Select(r => r.Status), Is.All.EqualTo(NodeStatus.Ok));
    }

    [Test]
    public void Add_combines_two_branches()
    {
        var doc = GraphDocument.Empty
            .AddNode("a", "test.const", 1).SetParam("a", "value", "2")
            .AddNode("b", "test.const", 1).SetParam("b", "value", "3")
            .AddNode("sum", "test.add", 1)
            .Connect("a.out", "sum.a")
            .Connect("b.out", "sum.b");
        var snapshot = doc.Evaluate(TestNodes.Registry);
        Assert.That(snapshot.IntegerOutput("sum"), Is.EqualTo(5));
    }

    [Test]
    public void Invalid_document_is_refused()
    {
        var doc = GraphDocument.Empty.AddNode("x", "no.such.kind", 1);
        var ex = Assert.Throws<InvalidGraphException>(() => doc.Evaluate(TestNodes.Registry))!;
        Assert.That(ex.Errors, Has.Count.EqualTo(1));
        Assert.That(ex.Errors[0].Kind, Is.EqualTo(GraphErrorKind.UnknownNodeKind));
    }

    [Test]
    public void Missing_input_edge_makes_node_and_downstream_unready()
    {
        var doc = GraphDocument.Empty
            .AddNode("n", "test.negate", 1)
            .AddNode("p", "test.probe", 1)
            .Connect("n.out", "p.in");
        var snapshot = doc.Evaluate(TestNodes.Registry);
        Assert.That(snapshot.Results["n"].Status, Is.EqualTo(NodeStatus.Unready));
        Assert.That(snapshot.Results["p"].Status, Is.EqualTo(NodeStatus.Unready));
        Assert.That(snapshot.Results["p"].BlockingNodeId, Is.EqualTo("n"));
        Assert.That(snapshot.Executions("n"), Is.EqualTo(0));
    }

    [Test]
    public void Output_hashes_match_value_hash()
    {
        var snapshot = TestNodes.Chain(7).Evaluate(TestNodes.Registry);
        var result = snapshot.Results["n"];
        Assert.That(result.OutputHashes[0], Is.EqualTo(ValueHash.Compute(result.Outputs[0])));
    }

    [Test]
    public void Warnings_are_collected_per_node_and_aggregated()
    {
        var doc = GraphDocument.Empty
            .AddNode("c", "test.const", 1).SetParam("c", "value", "1")
            .AddNode("w", "test.warn", 1)
            .Connect("c.out", "w.in");
        var snapshot = doc.Evaluate(TestNodes.Registry);
        Assert.That(snapshot.Results["w"].Warnings, Is.EqualTo(new[] { "careful" }));
        Assert.That(snapshot.Warnings, Is.EqualTo(new[] { "w: careful" }));
    }

    [Test]
    public void Topological_ties_break_by_ordinal_node_id()
    {
        // Two independent consts; evaluation order is unobservable in values,
        // but the sort itself must be deterministic and ordinal.
        var doc = GraphDocument.Empty
            .AddNode("b", "test.const", 1)
            .AddNode("A", "test.const", 1)
            .AddNode("Z", "test.const", 1);
        Assert.That(doc.Sort().Select(n => n.Id), Is.EqualTo(new[] { "A", "Z", "b" }));
    }
}
