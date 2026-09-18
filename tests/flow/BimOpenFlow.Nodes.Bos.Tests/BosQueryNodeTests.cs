namespace BimOpenFlow.Nodes.Bos.Tests;

/// <summary>bos.query runs one read-only SELECT over its input table as "t".</summary>
[TestFixture]
public sealed class BosQueryNodeTests
{
    [Test]
    public void Query_RunsReadOnlySqlOverT()
    {
        var result = new BosQueryNode().EvalTable(BosTestHelpers.SampleTable(),
            ("sql", "SELECT Name, Count FROM t WHERE Count >= 2 ORDER BY Count DESC"));
        Assert.That(result.Rows, Has.Count.EqualTo(3));
        Assert.That(result.Cell("Count", 0), Is.EqualTo(4L));
        Assert.That(result.Cell("Name", 0), Is.Null);
    }

    [Test]
    public void Query_RejectsNonSelectStatements()
        => Assert.That(
            () => new BosQueryNode().EvalTable(BosTestHelpers.SampleTable(), ("sql", "DELETE FROM t")),
            Throws.ArgumentException);
}
