using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class MemoTests
{
    [Test]
    public void Unchanged_document_re_evaluation_executes_nothing()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain());
        var snapshot = session.SetDocument(session.Document);
        Assert.That(snapshot.Executions("c"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("n"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("p"), Is.EqualTo(1));
    }

    [Test]
    public void Layout_change_executes_nothing()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain());
        var snapshot = session.UpdateDocument(d => d.SetLayout("c", new NodeLayout(10, 20)));
        Assert.That(snapshot.Executions("c"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("n"), Is.EqualTo(1));
    }

    [Test]
    public void Identical_nodes_share_one_memo_entry()
    {
        // Two probes fed the same value: the second is a memo hit, never executed.
        var doc = GraphDocument.Empty
            .AddNode("c", "test.const", 1).SetParam("c", "value", "9")
            .AddNode("p1", "test.probe", 1)
            .AddNode("p2", "test.probe", 1)
            .Connect("c.out", "p1.in")
            .Connect("c.out", "p2.in");
        var snapshot = doc.Evaluate(TestNodes.Registry);
        Assert.That(snapshot.Executions("p1") + snapshot.Executions("p2"), Is.EqualTo(1));
        Assert.That(snapshot.IntegerOutput("p1"), Is.EqualTo(9));
        Assert.That(snapshot.IntegerOutput("p2"), Is.EqualTo(9));
    }

    [Test]
    public void Reverting_a_param_hits_the_old_memo_entry()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain(1));
        session.UpdateDocument(d => d.SetParam("c", "value", "2"));
        var snapshot = session.UpdateDocument(d => d.SetParam("c", "value", "1"));
        Assert.That(snapshot.Executions("c"), Is.EqualTo(2));
        Assert.That(snapshot.Executions("n"), Is.EqualTo(2));
        Assert.That(snapshot.IntegerOutput("n"), Is.EqualTo(-1));
    }

    [Test]
    public void Memoized_warnings_are_replayed()
    {
        var doc = GraphDocument.Empty
            .AddNode("c", "test.const", 1).SetParam("c", "value", "1")
            .AddNode("w", "test.warn", 1)
            .Connect("c.out", "w.in");
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(doc);
        var snapshot = session.SetDocument(doc);
        Assert.That(snapshot.Executions("w"), Is.EqualTo(1));
        Assert.That(snapshot.Warnings, Is.EqualTo(new[] { "w: careful" }));
    }
}
