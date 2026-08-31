namespace Ara3D.NodeGraph.Tests;

public class ValidationTests
{
    private static IReadOnlyList<GraphError> Validate(GraphDocument doc)
        => doc.Validate(TestNodes.Registry);

    private static void AssertSingleError(GraphDocument doc, GraphErrorKind kind)
    {
        var errors = Validate(doc);
        Assert.That(errors, Has.Count.EqualTo(1));
        Assert.That(errors[0].Kind, Is.EqualTo(kind));
    }

    [Test]
    public void ValidDocumentHasNoErrors()
        => Assert.That(Validate(TestDocs.ConstNegate()), Is.Empty);

    [Test]
    public void EmptyDocumentHasNoErrors()
        => Assert.That(Validate(GraphDocument.Empty), Is.Empty);

    [Test]
    public void DuplicateNodeId()
    {
        var doc = GraphDocument.Empty with
        {
            Nodes = new[] { new GraphNode("a", "test.const", 1), new GraphNode("a", "test.const", 1) },
        };
        AssertSingleError(doc, GraphErrorKind.DuplicateNodeId);
    }

    [Test]
    public void UnknownNodeKind()
        => AssertSingleError(GraphDocument.Empty.AddNode("a", "test.missing", 1), GraphErrorKind.UnknownNodeKind);

    [Test]
    public void UnknownNodeVersion()
        => AssertSingleError(GraphDocument.Empty.AddNode("a", "test.const", 2), GraphErrorKind.UnknownNodeKind);

    [Test]
    public void DanglingEdgeEndpoints()
    {
        var doc = GraphDocument.Empty.AddNode("a", "test.const", 1).Connect("ghost.out", "phantom.in");
        var errors = Validate(doc);
        Assert.That(errors.Select(e => e.Kind), Is.All.EqualTo(GraphErrorKind.DanglingEdgeEndpoint));
        Assert.That(errors, Has.Count.EqualTo(2));
    }

    [Test]
    public void UnknownPortNames()
    {
        var doc = GraphDocument.Empty
            .AddNode("a", "test.const", 1)
            .AddNode("b", "test.negate", 1)
            .Connect("a.bogus", "b.in")
            .Connect("a.out", "b.bogus");
        var errors = Validate(doc);
        Assert.That(errors.Select(e => e.Kind), Is.All.EqualTo(GraphErrorKind.UnknownPort));
        Assert.That(errors, Has.Count.EqualTo(2));
    }

    [Test]
    public void PortTypeMismatch()
    {
        var doc = GraphDocument.Empty
            .AddNode("t", "test.text", 1)
            .AddNode("n", "test.negate", 1)
            .Connect("t.out", "n.in");
        AssertSingleError(doc, GraphErrorKind.PortTypeMismatch);
    }

    [Test]
    public void AnyPortMatchesAllTypes()
    {
        var doc = GraphDocument.Empty
            .AddNode("t", "test.text", 1)
            .AddNode("s", "test.sink", 1)
            .AddNode("any", "test.anySource", 1)
            .AddNode("n", "test.negate", 1)
            .Connect("t.out", "s.in")
            .Connect("any.out", "n.in");
        Assert.That(Validate(doc), Is.Empty);
    }

    [Test]
    public void MultipleEdgesIntoInputPort()
    {
        var doc = GraphDocument.Empty
            .AddNode("a", "test.const", 1)
            .AddNode("b", "test.const", 1)
            .AddNode("n", "test.negate", 1)
            .Connect("a.out", "n.in");
        doc = doc with { Edges = doc.Edges.Append(new GraphEdge("b.out", "n.in")).ToList() };
        AssertSingleError(doc, GraphErrorKind.MultipleEdgesIntoPort);
    }

    [Test]
    public void CycleIsReported()
    {
        var doc = GraphDocument.Empty
            .AddNode("x", "test.negate", 1)
            .AddNode("y", "test.negate", 1)
            .Connect("x.out", "y.in")
            .Connect("y.out", "x.in");
        var errors = Validate(doc);
        Assert.That(errors, Has.Count.EqualTo(1));
        Assert.That(errors[0].Kind, Is.EqualTo(GraphErrorKind.Cycle));
        Assert.That(errors[0].Target, Is.EqualTo("x, y"));
    }

    [Test]
    public void SelfEdgeIsACycle()
    {
        var doc = GraphDocument.Empty.AddNode("x", "test.negate", 1).Connect("x.out", "x.in");
        AssertSingleError(doc, GraphErrorKind.Cycle);
    }
}
