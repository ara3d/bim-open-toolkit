using BimOpenFlow.Host;
using BimOpenFlow.Mcp;

namespace BimOpenFlow.Studio.Tests;

/// <summary>The host's post-build check over real graphs in a temp store.</summary>
public sealed class AskChecksTests
{
    private string _root = null!;
    private FlowServices _services = null!;

    [SetUp]
    public void CreateServices()
    {
        _root = Path.Combine(Path.GetTempPath(), "bof-checks-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(_root, "models"));
        _services = FlowServices.Create(new HostConfig(
            [Path.Combine(_root, "models")], Path.Combine(_root, "cache"), Path.Combine(_root, "analyses"),
            Port: 0, Profile: HostConfig.TablesProfile));
    }

    [TearDown]
    public void DeleteRoot()
    {
        try
        {
            Directory.Delete(_root, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    [Test]
    public void NoGraphIsNotAFinding()
        => Assert.That(AskChecks.Verify(_services, "nothing-built"), Is.Null);

    private void Range(string nodeId, string stop)
        => FlowEditTools.EditGraph(_services, "g", $$"""
            [{"op":"addNode","nodeId":"{{nodeId}}","kind":"table.range"},
             {"op":"setParam","nodeId":"{{nodeId}}","name":"stop","value":"{{stop}}"}]
            """);

    [Test]
    public void AMissingAnswerNodeIsNamed()
    {
        Range("rows", "3");
        Assert.That(AskChecks.Verify(_services, "g"), Does.Contain("no node with the id 'answer'"));
    }

    [Test]
    public void AGraphWhoseAnswerHasRowsPasses()
    {
        Range("answer", "3");
        Assert.That(AskChecks.Verify(_services, "g"), Is.Null);
    }

    [Test]
    public void AnEmptyAnswerTableIsAFinding()
    {
        Range("rows", "3");
        FlowEditTools.EditGraph(_services, "g", """
            [{"op":"addNode","nodeId":"answer","kind":"table.filter"},
             {"op":"setParam","nodeId":"answer","name":"expr","value":"false"},
             {"op":"connect","from":"rows.table","to":"answer.table"}]
            """);
        var finding = AskChecks.Verify(_services, "g");
        Assert.That(finding, Does.Contain("has no rows"));
        // table.range 0..3 is inclusive: four rows in, none out.
        Assert.That(finding, Does.Contain("rows 4 rows -> answer 0 rows"), "names the step where the rows disappear");
    }

    [Test]
    public void ANodeThatDoesNotEvaluateIsNamedWithItsError()
    {
        FlowEditTools.EditGraph(_services, "g", """
            [{"op":"addNode","nodeId":"answer","kind":"duck.query"},
             {"op":"setParam","nodeId":"answer","name":"sql","value":"SELECT 1"},
             {"op":"setParam","nodeId":"answer","name":"path","value":"Z:/no/such.duckdb"}]
            """);
        var finding = AskChecks.Verify(_services, "g");
        Assert.That(finding, Does.StartWith("Not every node evaluates: answer is Error"));
        Assert.That(finding, Does.Contain("no/such.duckdb"));
    }

    [Test]
    public void AnUnreadyNodeIsAFinding()
    {
        FlowEditTools.EditGraph(_services, "g", """[{"op":"addNode","nodeId":"answer","kind":"table.sort"}]""");
        Assert.That(AskChecks.Verify(_services, "g"), Does.Contain("answer is Unready"));
    }
}
