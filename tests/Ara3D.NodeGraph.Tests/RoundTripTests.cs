using System.Text;

namespace Ara3D.NodeGraph.Tests;

public class RoundTripTests
{
    [Test]
    public void LoadOfSaveEqualsOriginal()
    {
        var doc = TestDocs.ConstNegate();
        var text = doc.ToCanonicalJson();
        var loaded = GraphDocumentIO.Parse(text);
        Assert.That(loaded, Is.EqualTo(doc));
        Assert.That(loaded.ToCanonicalJson(), Is.EqualTo(text));
    }

    [Test]
    public void SaveOfLoadCanonicalizesNonCanonicalText()
    {
        const string messy = """
            { "values": { "a": { "value": "42" } },
              "structure": { "edges": [ {"to":"b.in","from":"a.out"} ],
                "nodes": [ {"version":1,"kind":"test.negate","id":"b"}, {"id":"a","kind":"test.const","version":1} ] },
              "layout": { "a": { "y": 200.50, "x": 100.0 } },
              "formatVersion": "0.1.0" }
            """;
        var canonical = GraphDocumentIO.Parse(messy).ToCanonicalJson();
        Assert.That(canonical, Is.EqualTo(GraphDocumentIO.Parse(canonical).ToCanonicalJson()));
        Assert.That(canonical, Does.StartWith("{\n  \"formatVersion\": \"0.1.0\",\n  \"layout\""));
        Assert.That(canonical, Does.Contain("\"y\": 200.5"));
        Assert.That(canonical, Does.Contain("\"x\": 100"));
        Assert.That(canonical, Does.Not.Contain("200.50"));
    }

    [Test]
    public void CanonicalTextUsesLfAndEndsWithSingleNewline()
    {
        var text = TestDocs.ConstNegate().ToCanonicalJson();
        Assert.That(text, Does.Not.Contain('\r'));
        Assert.That(text, Does.EndWith("\n"));
        Assert.That(text, Does.Not.EndWith("\n\n"));
    }

    [Test]
    public void CanonicalTextSortsNodesEdgesAndKeys()
    {
        var text = TestDocs.ConstNegate().ToCanonicalJson();
        Assert.That(text.IndexOf("\"edges\""), Is.LessThan(text.IndexOf("\"nodes\"")));
        Assert.That(text.IndexOf("\"id\": \"a\""), Is.LessThan(text.IndexOf("\"id\": \"b\"")));
        Assert.That(text.IndexOf("\"session\""), Is.LessThan(text.IndexOf("\"structure\"")));
        Assert.That(text.IndexOf("\"camera\""), Is.LessThan(text.IndexOf("\"display\"")));
    }

    [Test]
    public void EmptyLayoutAndSessionAreOmitted()
    {
        var doc = GraphDocument.Empty.AddNode("a", "test.const", 1);
        var text = doc.ToCanonicalJson();
        Assert.That(text, Does.Not.Contain("\"layout\""));
        Assert.That(text, Does.Not.Contain("\"session\""));
        Assert.That(GraphDocumentIO.Parse(text), Is.EqualTo(doc));
    }

    [Test]
    public void SaveAndLoadFileRoundTripsWithoutBom()
    {
        var doc = TestDocs.ConstNegate();
        var path = Path.Combine(Path.GetTempPath(), $"roundtrip-{Guid.NewGuid():N}{GraphFormat.Extension}");
        try
        {
            doc.Save(path);
            Assert.That(GraphDocumentIO.Load(path), Is.EqualTo(doc));
            var bytes = File.ReadAllBytes(path);
            Assert.That(bytes.Take(3), Is.Not.EqualTo(new byte[] { 0xEF, 0xBB, 0xBF }));
            Assert.That(bytes, Is.EqualTo(Encoding.UTF8.GetBytes(doc.ToCanonicalJson())));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Test]
    public void UnknownTopLevelMemberThrows()
        => Assert.Throws<FormatException>(() =>
            GraphDocumentIO.Parse("""{"structure":{"nodes":[],"edges":[]},"values":{},"extra":{}}"""));

    [Test]
    public void NonStringParamValueThrows()
        => Assert.Throws<FormatException>(() => GraphDocumentIO.Parse(
            """{"structure":{"nodes":[{"id":"a","kind":"test.const","version":1}],"edges":[]},"values":{"a":{"value":42}}}"""));

    [Test]
    public void MissingStructureOrValuesThrows()
    {
        Assert.Throws<FormatException>(() => GraphDocumentIO.Parse("""{"values":{}}"""));
        Assert.Throws<FormatException>(() => GraphDocumentIO.Parse("""{"structure":{"nodes":[],"edges":[]}}"""));
    }
}
