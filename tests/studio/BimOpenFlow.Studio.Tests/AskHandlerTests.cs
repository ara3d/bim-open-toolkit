using System.Text.Json.Nodes;
using Ara3D.MCP;
using BimOpenFlow.Ask;
using BimOpenFlow.Host;
using BimOpenMcp.Flow;

namespace BimOpenFlow.Studio.Tests;

/// <summary>AskHandler over a ClaudeCliBackend against the real flow tool server and the fake
/// claude.cmd in tests/studio/fake-claude, so the studio's end-to-end request loop is exercised
/// without an account, a login, or a real claude process (see ClaudeCliBackendTests for the
/// backend's own tests).</summary>
public sealed class AskHandlerTests
{
    private string _root = null!;
    private string _workDir = null!;
    private FlowServices _services = null!;
    private McpServer _tools = null!;

    private static string FakeClaudePath => Path.Combine(AppContext.BaseDirectory, "fake-claude", "claude.cmd");

    [SetUp]
    public void CreateServices()
    {
        _root = Path.Combine(Path.GetTempPath(), "bof-studio-tests-" + Guid.NewGuid().ToString("N"));
        var models = Path.Combine(_root, "models");
        Directory.CreateDirectory(models);
        _services = FlowServices.Create(new HostConfig(
            [models], Path.Combine(_root, "cache"), Path.Combine(_root, "analyses"), Port: 0, Profile: HostConfig.TablesProfile));
        _tools = FlowMcpServer.RegisterTools(
            new McpServer(LoopbackPorts.Free(), "test", "0", transport: McpTransport.Http), _services);
        _workDir = Path.Combine(_root, "claude-cli");
        Directory.CreateDirectory(_workDir);
    }

    [TearDown]
    public void DeleteRoot()
    {
        _tools.Dispose();
        try
        {
            Directory.Delete(_root, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    private AskHandler Handler(string? effort = "medium")
    {
        var setup = new AskSetup(_tools, AskEndpoint.ServerKey, AskEndpoint.HiddenTools, AskAgent.DefaultMaxTurns);
        var settings = new ClaudeCliSettings(FakeClaudePath, "claude-haiku-4-5-20251001", "medium", _workDir)
        {
            Timeout = TimeSpan.FromSeconds(30),
        };
        var backend = new ClaudeCliBackend(setup, settings);
        return new AskHandler(_services, backend, () => "system prompt", "claude-haiku-4-5-20251001", effort);
    }

    private void WriteScript(string json)
        => File.WriteAllText(Path.Combine(_workDir, "fake-claude-script.json"), json);

    private List<JsonObject> ReadCallLog()
        => File.ReadAllLines(Path.Combine(_workDir, "fake-claude-calls.jsonl"))
            .Where(line => line.Trim().Length > 0)
            .Select(line => (JsonObject)JsonNode.Parse(line)!)
            .ToList();

    private static async Task<List<JsonObject>> RunAsync(AskHandler handler, AskRequest request)
    {
        var events = new List<JsonObject>();
        await handler.RunAsync(request, payload =>
        {
            events.Add((JsonObject)JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(payload))!);
            return Task.CompletedTask;
        }, CancellationToken.None);
        return events;
    }

    [Test]
    public async Task WallsPleaseBuildsThenChecksAndReportsDoneWithoutAVerifiedAnswer()
    {
        WriteScript("""
            {"runs":[
                {"steps":[
                    {"call":"addNode","args":{"id":"ask-walls","nodeId":"database","kind":"duck.source"}},
                    {"call":"evaluate","args":{"id":"ask-walls"}},
                    {"result":"Built it."}
                ]},
                {"steps":[{"result":"still working"}]},
                {"steps":[{"result":"still working"}]}
            ]}
            """);
        var handler = Handler();

        var events = await RunAsync(handler, new AskRequest("walls please"));

        Assert.That(events[0]["type"]!.GetValue<string>(), Is.EqualTo("start"));
        Assert.That(events[0]["analysisId"]!.GetValue<string>(), Is.EqualTo("ask-walls"));
        Assert.That(events[0]["effort"]!.GetValue<string>(), Is.EqualTo("medium"));

        var toolEvents = events.Where(e => e["type"]!.GetValue<string>() == "tool").ToList();
        Assert.That(toolEvents.Select(e => e["name"]!.GetValue<string>()), Is.EqualTo(new[] { "addNode", "evaluate" }));

        var checkEvents = events.Where(e => e["type"]!.GetValue<string>() == "check").ToList();
        Assert.That(checkEvents, Is.Not.Empty, "the graph has no 'answer' node, so the host's check should fire");

        var done = events.Last();
        Assert.That(done["type"]!.GetValue<string>(), Is.EqualTo("done"));
        Assert.That(done["built"]!.GetValue<bool>(), Is.True);
        Assert.That(done["verified"]!.GetValue<bool>(), Is.False);
        Assert.That(done["effort"]!.GetValue<string>(), Is.EqualTo("medium"));
    }

    [Test]
    public async Task TheFakesSecondInvocationCarriesResumeAndTheCheckPromptOnStdin()
    {
        WriteScript("""
            {"runs":[
                {"steps":[
                    {"call":"addNode","args":{"id":"ask-walls","nodeId":"database","kind":"duck.source"}},
                    {"call":"evaluate","args":{"id":"ask-walls"}},
                    {"result":"Built it."}
                ]},
                {"steps":[{"result":"still working"}]},
                {"steps":[{"result":"still working"}]}
            ]}
            """);
        var handler = Handler();

        await RunAsync(handler, new AskRequest("walls please"));

        var calls = ReadCallLog();
        Assert.That(calls.Count, Is.GreaterThanOrEqualTo(2));
        var secondArgs = calls[1]["args"]!.AsArray().Select(a => a!.GetValue<string>()).ToList();
        var resumeIndex = secondArgs.IndexOf("--resume");
        Assert.That(resumeIndex, Is.GreaterThanOrEqualTo(0), "the check round should resume the first session");
        Assert.That(secondArgs[resumeIndex + 1], Is.EqualTo("fake-session-0"));

        var problem = AskChecks.Verify(_services, "ask-walls");
        Assert.That(problem, Is.Not.Null);
        Assert.That(calls[1]["stdin"]!.GetValue<string>(), Is.EqualTo(AskPrompts.Check(problem!)));
    }

    [Test]
    public async Task AFollowUpWithAnAnalysisIdResumesTheSameSession()
    {
        WriteScript("""
            {"runs":[
                {"steps":[{"result":"first answer"}]},
                {"steps":[{"result":"second answer"}]}
            ]}
            """);
        var handler = Handler();

        await RunAsync(handler, new AskRequest("build something", "ask-something"));
        var events = await RunAsync(handler, new AskRequest("now sort it", "ask-something"));

        Assert.That(events[0]["continuing"]!.GetValue<bool>(), Is.True);
        var calls = ReadCallLog();
        var secondArgs = calls[1]["args"]!.AsArray().Select(a => a!.GetValue<string>()).ToList();
        var resumeIndex = secondArgs.IndexOf("--resume");
        Assert.That(resumeIndex, Is.GreaterThanOrEqualTo(0));
        Assert.That(secondArgs[resumeIndex + 1], Is.EqualTo("fake-session-0"));
    }

    [Test]
    public async Task AnErrorScriptEmitsExactlyOneErrorPayloadWithTheClisText()
    {
        WriteScript("""{"runs":[{"steps":[{"error":"Not logged in · Please run /login"}]}]}""");
        var handler = Handler();

        var events = await RunAsync(handler, new AskRequest("build something"));

        Assert.That(events.Count(e => e["type"]!.GetValue<string>() == "error"), Is.EqualTo(1));
        var error = events.Single(e => e["type"]!.GetValue<string>() == "error");
        Assert.That(error["message"]!.GetValue<string>(), Is.EqualTo("Claude Code: Not logged in · Please run /login"));
    }

    [Test]
    public async Task AnEmptyRequestEmitsTypeARequestFirst()
    {
        var handler = Handler();

        var events = await RunAsync(handler, new AskRequest("   "));

        Assert.That(events, Has.Count.EqualTo(1));
        Assert.That(events[0]["type"]!.GetValue<string>(), Is.EqualTo("error"));
        Assert.That(events[0]["message"]!.GetValue<string>(), Is.EqualTo("Type a request first."));
    }

    [Test]
    public async Task TheServerKeyIsBimopenflowAndHiddenToolsArriveAsDisallowedTools()
    {
        WriteScript("""{"runs":[{"steps":[{"result":"ok"}]}]}""");
        var handler = Handler();

        await RunAsync(handler, new AskRequest("build something"));

        var args = ReadCallLog()[0]["args"]!.AsArray().Select(a => a!.GetValue<string>()).ToList();
        Assert.That(args, Does.Contain("--allowedTools"));
        Assert.That(args[args.IndexOf("--allowedTools") + 1], Is.EqualTo($"mcp__{AskEndpoint.ServerKey}"));
        var disallowedIndex = args.IndexOf("--disallowedTools");
        Assert.That(disallowedIndex, Is.GreaterThanOrEqualTo(0));
        var disallowed = args[disallowedIndex + 1];
        foreach (var hidden in AskEndpoint.HiddenTools)
            Assert.That(disallowed, Does.Contain($"mcp__{AskEndpoint.ServerKey}__{hidden}"));
    }

    [Test]
    public void TheModelInfoPayloadReportsProviderModelEffortExecutableConfiguredAndProblem()
    {
        var selection = new ChatSelection("claude-cli", "claude-haiku-4-5-20251001", null)
        {
            Effort = "medium",
            Executable = @"C:\bin\claude.exe",
        };

        var payload = AskEndpoint.ModelInfoPayload(selection);
        var json = (JsonObject)JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(payload))!;

        Assert.That(json["model"]!.GetValue<string>(), Is.EqualTo("claude-haiku-4-5-20251001"));
        Assert.That(json["provider"]!.GetValue<string>(), Is.EqualTo("claude-cli"));
        Assert.That(json["effort"]!.GetValue<string>(), Is.EqualTo("medium"));
        Assert.That(json["executable"]!.GetValue<string>(), Is.EqualTo(@"C:\bin\claude.exe"));
        Assert.That(json["configured"]!.GetValue<bool>(), Is.True);
        Assert.That(json["problem"], Is.Null);
    }

    [Test]
    public void TheModelInfoPayloadReportsAProblemWhenNotConfigured()
    {
        var selection = new ChatSelection("claude-cli", "", ChatSelection.ClaudeCliMissing);

        var payload = AskEndpoint.ModelInfoPayload(selection);
        var json = (JsonObject)JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(payload))!;

        Assert.That(json["configured"]!.GetValue<bool>(), Is.False);
        Assert.That(json["problem"]!.GetValue<string>(), Is.EqualTo(ChatSelection.ClaudeCliMissing));
    }
}
