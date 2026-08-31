using Ara3D.DataFlowEngine.TestKit;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.TestKit.Tests;

[TestFixture]
public class GraphBuilderTests
{
    private static GraphDocument Chain()
        => Graph.Node("c1", "test.const", ("value", "42"))
            .Node("n1", "test.negate")
            .Connect("c1.out", "n1.in")
            .Build();

    [Test]
    public void Builder_matches_GraphEditing_equivalent()
    {
        var edited = GraphDocument.Empty
            .AddNode("c1", "test.const", 1)
            .AddNode("n1", "test.negate", 1)
            .Connect("c1.out", "n1.in")
            .SetParam("c1", "value", "42");
        Assert.That(Chain(), Is.EqualTo(edited));
    }

    [Test]
    public void Built_document_round_trips_through_canonical_json()
    {
        var doc = Chain();
        var round = GraphDocumentIO.Parse(doc.ToCanonicalJson());
        Assert.That(round, Is.EqualTo(doc));
        Assert.That(round.ToCanonicalJson(), Is.EqualTo(doc.ToCanonicalJson()));
    }

    [Test]
    public void Builder_is_immutable()
    {
        var one = Graph.Node("a", "test.const", ("value", "1"));
        var two = one.Node("b", "test.negate");
        Assert.That(one.Build().Nodes, Has.Count.EqualTo(1));
        Assert.That(two.Build().Nodes, Has.Count.EqualTo(2));
    }

    [Test]
    public void Explicit_version_param_and_layout_land_in_the_document()
    {
        var doc = Graph.Node("c", "test.const", 2, ("kind", "Text"))
            .Param("c", "value", "hi")
            .Layout("c", 10, 20)
            .Build();
        Assert.That(doc.FindNode("c")!.Version, Is.EqualTo(2));
        Assert.That(doc.Values["c"]["value"], Is.EqualTo("hi"));
        Assert.That(doc.Layout["c"].X, Is.EqualTo(10));
    }

    [Test]
    public void Duplicate_node_id_throws()
        => Assert.Throws<ArgumentException>(
            () => Graph.Node("a", "test.const").Node("a", "test.const"));

    [Test]
    public void Built_document_validates_against_the_testkit_registry()
        => Assert.That(Chain().Validate(TestNodes.Registry), Is.Empty);
}
