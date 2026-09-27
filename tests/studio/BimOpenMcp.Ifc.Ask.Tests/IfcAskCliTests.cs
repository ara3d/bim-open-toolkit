using System.Text.Json;
using System.Text.Json.Nodes;
using Ara3D.MCP;
using BimOpenFlow.Ask;
using BimOpenToolkit.TestSupport;

namespace BimOpenMcp.Ifc.Ask.Tests;

/// <summary>IfcAskRunner over a ClaudeCliBackend: the fake claude.cmd (see tests/studio/fake-claude)
/// stands in for the real command line, but every call it makes really reaches the IFC tool server
/// over HTTP, against a real one-wall model. No key, no login, no real claude process.</summary>
public sealed class IfcAskCliTests
{
    private string _ifc = null!;
    private string _workDir = null!;
    private IfcSessionCache _cache = null!;
    private McpServer _tools = null!;

    private static string FakeClaudePath => Path.Combine(AppContext.BaseDirectory, "fake-claude", "claude.cmd");

    [SetUp]
    public void CreateServerAndWorkDir()
    {
        _ifc = Path.Combine(Path.GetTempPath(), "ifc-ask-cli-tests-" + Guid.NewGuid().ToString("N") + ".ifc");
        File.WriteAllText(_ifc, MiniIfc.Wall);
        _cache = new IfcSessionCache();
        _tools = IfcAskRunner.CreateServer(_cache);
        _workDir = Path.Combine(Path.GetTempPath(), "ifc-ask-cli-tests-work-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_workDir);
    }

    [TearDown]
    public void DeleteModelAndWorkDir()
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
        try
        {
            Directory.Delete(_workDir, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    private void WriteScript(string json)
        => File.WriteAllText(Path.Combine(_workDir, "fake-claude-script.json"), json);

    private List<JsonObject> ReadCallLog()
        => File.ReadAllLines(Path.Combine(_workDir, "fake-claude-calls.jsonl"))
            .Where(line => line.Trim().Length > 0)
            .Select(line => (JsonObject)JsonNode.Parse(line)!)
            .ToList();

    private IfcAskRunner Runner(int maxTurns = IfcAskRunner.DefaultMaxTurns)
        => new(new ClaudeCliBackend(IfcAskRunner.Setup(_tools, maxTurns),
            new ClaudeCliSettings(FakeClaudePath, "claude-haiku-4-5-20251001", "medium", _workDir)
            {
                Timeout = TimeSpan.FromSeconds(30),
            }), _ifc);

    [Test]
    public async Task AnIfcOpenCallGivesAToolEventOkWithAnIfc4SummaryAndTheFakesAnswer()
    {
        var openCall = "{\"call\":\"ifc_open\",\"args\":{\"path\":" + JsonSerializer.Serialize(_ifc) + "}}";
        WriteScript("{\"runs\":[{\"steps\":[" + openCall + ",{\"result\":\"One wall, from ifc_open.\"}]}]}");

        var answers = await Runner().RunAsync(["how many walls?"], CancellationToken.None);

        Assert.That(answers, Has.Count.EqualTo(1));
        var answer = answers[0];
        Assert.That(answer.Answer, Is.EqualTo("One wall, from ifc_open."));
        Assert.That(answer.ToolCalls, Has.Count.EqualTo(1));
        Assert.That(answer.ToolCalls[0].Ok, Is.True);
        Assert.That(answer.ToolCalls[0].Summary, Does.Contain("IFC4"));
    }

    [Test]
    public async Task TwoQuestionsGiveTwoInvocationsNeitherWithResume()
    {
        WriteScript("""
            {"runs":[
                {"steps":[{"result":"first answer"}]},
                {"steps":[{"result":"second answer"}]}
            ]}
            """);

        var answers = await Runner().RunAsync(["one?", "two?"], CancellationToken.None);

        Assert.That(answers.Select(a => a.Answer), Is.EqualTo(new[] { "first answer", "second answer" }));
        var calls = ReadCallLog();
        Assert.That(calls, Has.Count.EqualTo(2));
        foreach (var call in calls)
        {
            var args = call["args"]!.AsArray().Select(a => a!.GetValue<string>()).ToList();
            Assert.That(args, Does.Not.Contain("--resume"), "each question is its own session");
        }
    }

    [Test]
    public async Task TheDisallowedToolsValueHoldsTheFourHiddenToolsPrefixed()
    {
        WriteScript("""{"runs":[{"steps":[{"result":"ok"}]}]}""");

        await Runner().RunAsync(["anything?"], CancellationToken.None);

        var args = ReadCallLog()[0]["args"]!.AsArray().Select(a => a!.GetValue<string>()).ToList();
        var index = args.IndexOf("--disallowedTools");
        Assert.That(index, Is.GreaterThanOrEqualTo(0));
        var expected = IfcAskRunner.HiddenTools
            .OrderBy(name => name, StringComparer.Ordinal)
            .Select(name => $"mcp__{IfcAskRunner.ServerKey}__{name}");
        Assert.That(args[index + 1], Is.EqualTo(string.Join(",", expected)));
    }

    [Test]
    public async Task NotLoggedInIsRecordedAsNotAnsweredAndTheNextQuestionStillRuns()
    {
        WriteScript("""
            {"runs":[
                {"steps":[{"error":"Not logged in · Please run /login"}]},
                {"steps":[{"result":"second answer"}]}
            ]}
            """);

        var answers = await Runner().RunAsync(["one?", "two?"], CancellationToken.None);

        Assert.That(answers[0].Answer, Is.EqualTo("Not answered: Claude Code: Not logged in · Please run /login"));
        Assert.That(answers[1].Answer, Is.EqualTo("second answer"));
    }
}
