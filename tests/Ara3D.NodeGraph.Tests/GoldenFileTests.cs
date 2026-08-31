using System.Text;

namespace Ara3D.NodeGraph.Tests;

/// <summary>
/// golden/minimal.dfg.json was produced by the canonical writer (from
/// TestDocs.ConstNegate) and is committed as the byte-level reference.
/// </summary>
public class GoldenFileTests
{
    private const string PinnedHash = "5ca17f129792a94d9725eda0bb1c1c63c8460430c878cb1571e7409bad6a1a62";

    private static string GoldenPath
        => Path.Combine(TestContext.CurrentContext.TestDirectory, "golden", "minimal.dfg.json");

    [Test]
    public void GoldenFileMatchesCanonicalWriterByteForByte()
        => Assert.That(File.ReadAllBytes(GoldenPath),
            Is.EqualTo(Encoding.UTF8.GetBytes(TestDocs.ConstNegate().ToCanonicalJson())));

    [Test]
    public void GoldenFileRoundTripsThroughLoadAndSave()
    {
        var loaded = GraphDocumentIO.Load(GoldenPath);
        Assert.That(Encoding.UTF8.GetBytes(loaded.ToCanonicalJson()), Is.EqualTo(File.ReadAllBytes(GoldenPath)));
        Assert.That(loaded, Is.EqualTo(TestDocs.ConstNegate()));
    }

    [Test]
    public void GoldenGraphHashIsPinned()
    {
        Assert.That(TestDocs.ConstNegate().ComputeGraphHash(), Is.EqualTo(PinnedHash));
        Assert.That(GraphDocumentIO.Load(GoldenPath).ComputeGraphHash(), Is.EqualTo(PinnedHash));
    }
}
