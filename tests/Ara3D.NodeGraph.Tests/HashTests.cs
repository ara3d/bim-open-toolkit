namespace Ara3D.NodeGraph.Tests;

public class HashTests
{
    [Test]
    public void HashIsLowercaseHexSha256()
        => Assert.That(TestDocs.ConstNegate().ComputeGraphHash(), Does.Match("^[0-9a-f]{64}$"));

    [Test]
    public void HashIgnoresLayoutAndSession()
    {
        var doc = TestDocs.ConstNegate();
        var moved = doc.SetLayout("a", new NodeLayout(-50, 999)) with { Session = null };
        var stripped = doc with
        {
            Layout = new Dictionary<string, NodeLayout>(),
            Session = null,
        };
        Assert.That(moved.ComputeGraphHash(), Is.EqualTo(doc.ComputeGraphHash()));
        Assert.That(stripped.ComputeGraphHash(), Is.EqualTo(doc.ComputeGraphHash()));
    }

    [Test]
    public void HashChangesWithStructure()
    {
        var doc = TestDocs.ConstNegate();
        Assert.That(doc.AddNode("c", "test.text", 1).ComputeGraphHash(), Is.Not.EqualTo(doc.ComputeGraphHash()));
        Assert.That(doc.Disconnect("a.out", "b.in").ComputeGraphHash(), Is.Not.EqualTo(doc.ComputeGraphHash()));
    }

    [Test]
    public void HashChangesWithValues()
    {
        var doc = TestDocs.ConstNegate();
        Assert.That(doc.SetParam("a", "value", "43").ComputeGraphHash(), Is.Not.EqualTo(doc.ComputeGraphHash()));
    }

    [Test]
    public void HashIsIndependentOfAuthoringOrder()
    {
        var doc = TestDocs.ConstNegate();
        var reordered = GraphDocument.Empty
            .AddNode("a", "test.const", 1)
            .SetParam("a", "value", "42")
            .AddNode("b", "test.negate", 1)
            .Connect("a.out", "b.in");
        Assert.That(reordered.ComputeGraphHash(), Is.EqualTo(doc.ComputeGraphHash()));
    }
}
