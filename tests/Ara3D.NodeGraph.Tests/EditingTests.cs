namespace Ara3D.NodeGraph.Tests;

public class EditingTests
{
    [Test]
    public void AddNodeAppends()
    {
        var doc = GraphDocument.Empty.AddNode("a", "test.const", 1);
        Assert.That(doc.Nodes, Has.Count.EqualTo(1));
        Assert.That(doc.FindNode("a"), Is.EqualTo(new GraphNode("a", "test.const", 1)));
        Assert.That(GraphDocument.Empty.Nodes, Is.Empty, "input document must not be mutated");
    }

    [Test]
    public void AddDuplicateNodeIdThrows()
        => Assert.Throws<ArgumentException>(() =>
            GraphDocument.Empty.AddNode("a", "test.const", 1).AddNode("a", "test.text", 1));

    [Test]
    public void NodeIdWithDotThrows()
        => Assert.Throws<ArgumentException>(() => GraphDocument.Empty.AddNode("a.b", "test.const", 1));

    [Test]
    public void RemoveNodeDropsEdgesValuesAndLayout()
    {
        var doc = TestDocs.ConstNegate().RemoveNode("a");
        Assert.That(doc.Nodes.Select(n => n.Id), Is.EqualTo(new[] { "b" }));
        Assert.That(doc.Edges, Is.Empty);
        Assert.That(doc.Values.ContainsKey("a"), Is.False);
        Assert.That(doc.Layout.ContainsKey("a"), Is.False);
        Assert.That(doc.Layout.ContainsKey("b"), Is.True);
    }

    [Test]
    public void RemoveUnknownNodeThrows()
        => Assert.Throws<ArgumentException>(() => GraphDocument.Empty.RemoveNode("a"));

    [Test]
    public void ConnectReplacesExistingEdgeIntoSameInput()
    {
        var doc = TestDocs.ConstNegate()
            .AddNode("c", "test.const", 1)
            .Connect("c.out", "b.in");
        Assert.That(doc.Edges, Has.Count.EqualTo(1));
        Assert.That(doc.Edges[0], Is.EqualTo(new GraphEdge("c.out", "b.in")));
    }

    [Test]
    public void ConnectRejectsMalformedEndpoint()
        => Assert.Throws<ArgumentException>(() => TestDocs.ConstNegate().Connect("a", "b.in"));

    [Test]
    public void DisconnectRemovesEdge()
        => Assert.That(TestDocs.ConstNegate().Disconnect("a.out", "b.in").Edges, Is.Empty);

    [Test]
    public void DisconnectMissingEdgeThrows()
        => Assert.Throws<ArgumentException>(() => TestDocs.ConstNegate().Disconnect("b.out", "a.in"));

    [Test]
    public void SetParamAddsAndOverwrites()
    {
        var doc = TestDocs.ConstNegate().SetParam("a", "value", "7");
        Assert.That(doc.Values["a"]["value"], Is.EqualTo("7"));
        Assert.That(TestDocs.ConstNegate().Values["a"]["value"], Is.EqualTo("42"));
    }

    [Test]
    public void SetParamOnUnknownNodeThrows()
        => Assert.Throws<ArgumentException>(() => TestDocs.ConstNegate().SetParam("ghost", "value", "1"));

    [Test]
    public void RemoveParamDropsEntryAndEmptyNodeEntry()
    {
        var doc = TestDocs.ConstNegate().RemoveParam("a", "value");
        Assert.That(doc.Values.ContainsKey("a"), Is.False);
    }

    [Test]
    public void SetLayoutAddsAndOverwrites()
    {
        var doc = GraphDocument.Empty.AddNode("a", "test.const", 1).SetLayout("a", new NodeLayout(1, 2, 3, 4));
        Assert.That(doc.Layout["a"], Is.EqualTo(new NodeLayout(1, 2, 3, 4)));
    }

    [Test]
    public void UndoRedoWalksHistory()
    {
        var d0 = GraphDocument.Empty;
        var d1 = d0.AddNode("a", "test.const", 1);
        var d2 = d1.AddNode("b", "test.negate", 1);
        var history = GraphHistory.Start(d0).Apply(d1).Apply(d2);

        Assert.That(history.Current, Is.EqualTo(d2));
        Assert.That(history.CanUndo, Is.True);
        Assert.That(history.CanRedo, Is.False);

        history = history.Undo();
        Assert.That(history.Current, Is.EqualTo(d1));
        Assert.That(history.CanRedo, Is.True);

        history = history.Undo();
        Assert.That(history.Current, Is.EqualTo(d0));
        Assert.That(history.CanUndo, Is.False);
        Assert.That(history.Undo(), Is.SameAs(history), "undo at bottom is a no-op");

        history = history.Redo().Redo();
        Assert.That(history.Current, Is.EqualTo(d2));
        Assert.That(history.CanRedo, Is.False);
        Assert.That(history.Redo(), Is.SameAs(history), "redo at top is a no-op");
    }

    [Test]
    public void ApplyClearsRedoStack()
    {
        var d0 = GraphDocument.Empty;
        var d1 = d0.AddNode("a", "test.const", 1);
        var d2 = d0.AddNode("b", "test.negate", 1);
        var history = GraphHistory.Start(d0).Apply(d1).Undo().Apply(d2);
        Assert.That(history.CanRedo, Is.False);
        Assert.That(history.Current, Is.EqualTo(d2));
        Assert.That(history.Undo().Current, Is.EqualTo(d0));
    }
}
