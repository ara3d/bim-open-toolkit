using Ara3D.MCP;
using BimOpenFlow.Ask;
using BimOpenToolkit.TestSupport;

namespace BimOpenMcp.Ifc.Ask.Tests;

/// <summary>The runner against the real IFC tool server over a one-wall model, with the model
/// scripted: the calls really reach the server and really read the file, only the language model
/// is replaced. No key and no network.</summary>
public sealed class IfcAskRunnerTests
{
    private string _ifc = null!;
    private IfcSessionCache _cache = null!;
    private McpServer _tools = null!;

    [SetUp]
    public void CreateServer()
    {
        _ifc = Path.Combine(Path.GetTempPath(), "ifc-ask-tests-" + Guid.NewGuid().ToString("N") + ".ifc");
        File.WriteAllText(_ifc, MiniIfc.Wall);
        _cache = new IfcSessionCache();
        _tools = IfcAskRunner.CreateServer(_cache);
    }

    [TearDown]
    public void DeleteModel()
    {
        _tools.Dispose();
        _cache.Dispose();
        try
        {
            File.Delete(_ifc);
        }
        catch (IOException)
        {
        }
    }

    private IfcAskRunner Runner(ScriptedModel model, int maxTurns = IfcAskRunner.DefaultMaxTurns)
        => new(_tools, new OpenAiChat(new HttpClient(model), "sk-test", "gpt-test"), _ifc, maxTurns);

    private string Open()
        => ScriptedModel.ToolCall("c1", "ifc_open", $$"""{"path":{{System.Text.Json.JsonSerializer.Serialize(_ifc)}}}""");

    [Test]
    public async Task OpensTheModelThenAnswers()
    {
        var model = new ScriptedModel(Open(), ScriptedModel.Text("One wall, from ifc_open, 1 row."));
        var answers = await Runner(model).RunAsync(["How many walls?"], CancellationToken.None);

        Assert.That(answers, Has.Count.EqualTo(1));
        var answer = answers[0];
        Assert.That(answer.Question, Is.EqualTo("How many walls?"));
        Assert.That(answer.Answer, Is.EqualTo("One wall, from ifc_open, 1 row."));
        Assert.That(answer.Turns, Is.EqualTo(2));
        Assert.That((answer.InputTokens, answer.OutputTokens), Is.EqualTo((200L, 40L)));
        Assert.That(answer.ToolCalls.Select(c => (c.Name, c.Ok)), Is.EqualTo(new[] { ("ifc_open", (bool?)true) }));
        Assert.That(answer.ToolCalls[0].Summary, Does.Contain("IFC4"), "the tool really read the file");
    }

    [Test]
    public async Task EachQuestionGetsItsOwnConversation()
    {
        var model = new ScriptedModel(
            ScriptedModel.Text("first answer"),
            ScriptedModel.Text("second answer"));
        var answers = await Runner(model).RunAsync(["one?", "two?"], CancellationToken.None);

        Assert.That(answers.Select(a => a.Answer), Is.EqualTo(new[] { "first answer", "second answer" }));
        var second = model.Requests[1]["messages"]!.AsArray();
        Assert.That(second.Select(m => m!["role"]!.GetValue<string>()), Is.EqualTo(new[] { "system", "user" }),
            "the second question starts from the system prompt, not from the first answer");
        Assert.That(second[1]!["content"]!.GetValue<string>(), Is.EqualTo("two?"));
    }

    [Test]
    public async Task HiddenToolsAreNotOfferedAndTheUsefulOnesAre()
    {
        var model = new ScriptedModel(ScriptedModel.Text("done"));
        await Runner(model).RunAsync(["anything?"], CancellationToken.None);

        var offered = model.FunctionsOffered(0);
        var all = new AskAgent(_tools, new OpenAiChat(new HttpClient(new ScriptedModel()), "sk-test", "gpt-test"))
            .ListFunctions().Select(f => f!["function"]!["name"]!.GetValue<string>()).ToList();
        Assert.That(IfcAskRunner.HiddenTools, Is.Not.Empty);
        foreach (var hidden in IfcAskRunner.HiddenTools)
        {
            Assert.That(all, Does.Contain(hidden), "a hidden name that no tool has hides nothing");
            Assert.That(offered, Does.Not.Contain(hidden));
        }
        Assert.That(offered, Does.Contain("ifc_open").And.Contain("ifc_sql")
            .And.Contain("ifc_properties").And.Contain("ifc_find_by_parameter").And.Contain("ifc_spatial_tree"));
    }

    [Test]
    public async Task TheSystemPromptNamesTheModelAndTheViews()
    {
        var model = new ScriptedModel(ScriptedModel.Text("done"));
        await Runner(model).RunAsync(["anything?"], CancellationToken.None);

        var system = model.Requests[0]["messages"]![0]!["content"]!.GetValue<string>();
        Assert.That(system, Does.Contain(_ifc));
        Assert.That(system, Does.Contain("EntityText").And.Contain("ParameterText")
            .And.Contain("RelationText").And.Contain("StoreyOfEntity"));
        Assert.That(system, Does.Contain(IfcAskPrompts.AnalyticsPrefix));
        Assert.That(system.Split('\n'), Has.Length.LessThan(120), "the prompt stays short enough to read");
    }

    [Test]
    public async Task AQuestionThatRunsOutOfTurnsIsRecordedAndTheRunGoesOn()
    {
        var model = new ScriptedModel(Open(), Open(), ScriptedModel.Text("the second question's answer"));
        var answers = await Runner(model, maxTurns: 2).RunAsync(["loops?", "two?"], CancellationToken.None);

        Assert.That(answers[0].Answer, Does.StartWith("Not answered:").And.Contain("2 model turns"));
        Assert.That(answers[0].ToolCalls, Has.Count.EqualTo(2), "the calls it did make are kept");
        Assert.That(answers[1].Answer, Is.EqualTo("the second question's answer"));
    }

    [Test]
    public async Task AFailedToolCallIsRecordedNotThrown()
    {
        var model = new ScriptedModel(
            ScriptedModel.ToolCall("c1", "ifc_entity", $$"""{"path":{{System.Text.Json.JsonSerializer.Serialize(_ifc)}},"id":9999}"""),
            ScriptedModel.Text("no such entity"));
        var answers = await Runner(model).RunAsync(["what is entity 9999?"], CancellationToken.None);

        Assert.That(answers[0].ToolCalls[0].Ok, Is.False);
        Assert.That(answers[0].Answer, Is.EqualTo("no such entity"));
    }

    [Test]
    public async Task ProgressIsReportedPerQuestionAndPerCall()
    {
        var lines = new List<string>();
        var model = new ScriptedModel(Open(), ScriptedModel.Text("done"));
        var runner = new IfcAskRunner(_tools, new OpenAiChat(new HttpClient(model), "sk-test", "gpt-test"), _ifc)
        {
            Progress = lines.Add,
        };
        await runner.RunAsync(["how many walls?"], CancellationToken.None);

        Assert.That(lines[0], Does.Contain("[1/1]").And.Contain("how many walls?"));
        Assert.That(lines.Any(l => l.Contains("ifc_open")), Is.True);
        Assert.That(lines[^1], Does.Contain("1 tool calls").And.Contain("2 turns"));
    }
}
