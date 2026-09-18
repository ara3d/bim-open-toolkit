using System.Text.Json.Nodes;
using BimOpenFlow.Ask;

namespace BimOpenMcp.Ifc.Ask.Tests;

/// <summary>The transcript and the results file are pure functions of the answers, so their shape
/// is checked here without a model, a server, or a file on disk.</summary>
public sealed class IfcAskReportTests
{
    private static readonly IfcAskAnswer Answer = new(
        "How many storeys?",
        "Four, from ifc_sql, 4 rows.",
        Turns: 3,
        InputTokens: 1200,
        OutputTokens: 80,
        Events:
        [
            new AskEvent("tool", "ifc_open", new JsonObject { ["path"] = "C:/m.ifc" }, true, "IFC4, 512 entities"),
            new AskEvent("text", Text: "Now I will count the storeys."),
            new AskEvent("tool", "ifc_sql", new JsonObject { ["sql"] = "SELECT 1" }, false, "no such column"),
        ]);

    private static readonly IfcAskReport.Header Head =
        new(new DateTimeOffset(2026, 9, 18, 10, 0, 0, TimeSpan.Zero), "gpt-test", "C:/m.ifc", "abc1234");

    [Test]
    public void TheHeaderNamesTheRunAndTheCommit()
    {
        var markdown = IfcAskReport.Markdown(Head, [Answer]);
        Assert.That(markdown, Does.Contain("2026-09-18").And.Contain("gpt-test").And.Contain("C:/m.ifc")
            .And.Contain("`abc1234`"));
    }

    [Test]
    public void WithoutACommitTheLineIsLeftOut()
        => Assert.That(IfcAskReport.Markdown(Head with { Commit = null }, [Answer]),
            Does.Not.Contain("Toolkit commit"));

    [Test]
    public void EachQuestionIsAHeadingWithItsCallsTextAnswerAndCost()
    {
        var markdown = IfcAskReport.Markdown(Head, [Answer]);
        Assert.That(markdown, Does.Contain("### How many storeys?"));
        Assert.That(markdown, Does.Contain("**Agent calls** `ifc_open` with"));
        Assert.That(markdown, Does.Contain("\"path\": \"C:/m.ifc\""), "arguments go in as JSON");
        Assert.That(markdown, Does.Contain("**Result** IFC4, 512 entities"));
        Assert.That(markdown, Does.Contain("**Result** failed: no such column"));
        Assert.That(markdown, Does.Contain("Now I will count the storeys."));
        Assert.That(markdown, Does.Contain("**Answer:** Four, from ifc_sql, 4 rows."));
        Assert.That(markdown, Does.Contain("Turns 3; input tokens 1200; output tokens 80."));
        Assert.That(markdown, Does.Not.Contain("SELECT 1\","), "only the summary of a result, never the whole text");
    }

    [Test]
    public void TheResultsFileIsAnArrayOfQuestionsWithTheirCalls()
    {
        var array = JsonNode.Parse(IfcAskReport.Json([Answer]))!.AsArray();
        Assert.That(array, Has.Count.EqualTo(1));
        var row = array[0]!.AsObject();
        Assert.That(row.Select(p => p.Key),
            Is.EqualTo(new[] { "question", "answer", "turns", "inputTokens", "outputTokens", "toolCalls" }));
        Assert.That(row["question"]!.GetValue<string>(), Is.EqualTo("How many storeys?"));
        Assert.That(row["turns"]!.GetValue<int>(), Is.EqualTo(3));
        Assert.That(row["inputTokens"]!.GetValue<long>(), Is.EqualTo(1200));

        var calls = row["toolCalls"]!.AsArray();
        Assert.That(calls, Has.Count.EqualTo(2), "text events are not tool calls");
        Assert.That(calls[0]!.AsObject().Select(p => p.Key), Is.EqualTo(new[] { "name", "args", "ok", "summary" }));
        Assert.That(calls[0]!["name"]!.GetValue<string>(), Is.EqualTo("ifc_open"));
        Assert.That(calls[0]!["args"]!["path"]!.GetValue<string>(), Is.EqualTo("C:/m.ifc"));
        Assert.That(calls[1]!["ok"]!.GetValue<bool>(), Is.False);
        Assert.That(calls[1]!["summary"]!.GetValue<string>(), Is.EqualTo("no such column"));
    }

    [Test]
    public void GitCommitIsNullRatherThanAnErrorWhereThereIsNoRepository()
        => Assert.That(IfcAskReport.GitCommit(Path.GetTempPath()), Is.Null);
}
