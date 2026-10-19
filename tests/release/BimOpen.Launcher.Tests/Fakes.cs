using System.Text.Json.Nodes;

namespace BimOpen.Launcher.Tests;

/// <summary>A console that answers from a script and keeps what was said.</summary>
public sealed class FakeTerminal(params string[] answers) : ITerminal
{
    private readonly Queue<string> _answers = new(answers);

    public List<string> Lines { get; } = [];

    public List<string> Prompts { get; } = [];

    public string Said => string.Join("\n", Lines);

    public void Line(string text = "")
        => Lines.Add(text);

    public string? Read(string prompt)
    {
        Prompts.Add(prompt);
        return _answers.Count > 0 ? _answers.Dequeue() : null;
    }
}

/// <summary>A stand-in for the claude program: answers version and auth, and writes "mcp add" into the user config file as Claude Code does.</summary>
public sealed class FakeClaude(string configFile, bool signedIn = true) : IProcessRunner
{
    public List<string> Calls { get; } = [];

    public RunResult Run(string file, IReadOnlyList<string> arguments, TimeSpan timeout)
    {
        Calls.Add(string.Join(' ', arguments));
        switch (arguments[0])
        {
            case "--version":
                return new(0, "2.1.299 (Claude Code)\n", "");
            case "auth":
                return signedIn
                    ? new(0, """{"loggedIn": true, "authMethod": "claude.ai"}""", "")
                    : new(1, """{"loggedIn": false}""", "");
            case "mcp" when arguments[1] == "add":
                Edit(servers => servers[arguments[4]] = new JsonObject
                {
                    ["type"] = "stdio",
                    ["command"] = arguments[6],
                    ["args"] = new JsonArray([.. arguments.Skip(7).Select(a => (JsonNode?)JsonValue.Create(a))]),
                });
                return new(0, "Added\n", "");
            case "mcp" when arguments[1] == "remove":
                Edit(servers => servers.Remove(arguments[4]));
                return new(0, "Removed\n", "");
            default:
                return new(1, "", "unexpected call");
        }
    }

    private void Edit(Action<JsonObject> change)
    {
        var root = File.Exists(configFile) ? JsonNode.Parse(File.ReadAllText(configFile))!.AsObject() : new JsonObject();
        var servers = root["mcpServers"] as JsonObject ?? new JsonObject();
        change(servers);
        root["mcpServers"] = servers;
        File.WriteAllText(configFile, root.ToJsonString());
    }
}

/// <summary>A release folder and a user profile in a temporary folder, with the machine that sees them.</summary>
public sealed class Sandbox : IDisposable
{
    public string Folder { get; } = Path.Combine(Path.GetTempPath(), "bimopen-test-" + Guid.NewGuid().ToString("N"));

    public Layout Layout => new(Path.Combine(Folder, "release"));

    public string Profile => Path.Combine(Folder, "profile");

    public string ClaudeConfigDir => Path.Combine(Profile, ".claude");

    public string UserConfig => Path.Combine(ClaudeConfigDir, ".claude.json");

    public string ClaudePath => Path.Combine(Profile, ".local", "bin", "claude.exe");

    public Sandbox()
    {
        Directory.CreateDirectory(Layout.Root);
        Directory.CreateDirectory(ClaudeConfigDir);
    }

    /// <summary>The files the release must have, and one skill folder to install.</summary>
    public Sandbox WithRelease()
    {
        foreach (var file in Layout.Required)
            Touch(Path.Combine(Layout.Root, file));
        Touch(Path.Combine(Layout.SkillSources, "bim-flow", "SKILL.md"), "bim flow");
        Touch(Path.Combine(Layout.SkillSources, "ifc-ask", "SKILL.md"), "ifc ask");
        foreach (var folder in Layout.DefaultModelFolders)
            Directory.CreateDirectory(folder);
        Touch(Path.Combine(Layout.Notebooks, "one.notebook.json"), NotebookWithGraph);
        return this;
    }

    public Machine Machine(bool claudeInstalled = true, string? desktopConfig = null)
        => new(
            name => name switch
            {
                "CLAUDE_CONFIG_DIR" => ClaudeConfigDir,
                "USERPROFILE" => Profile,
                "APPDATA" => Path.Combine(Profile, "AppData", "Roaming"),
                "LOCALAPPDATA" => Path.Combine(Profile, "AppData", "Local"),
                "PATH" => Path.GetDirectoryName(ClaudePath),
                _ => null,
            },
            path => (claudeInstalled && path == ClaudePath) || (desktopConfig is not null && path == desktopConfig) || File.Exists(path),
            dir => Directory.Exists(dir) ? Directory.GetDirectories(dir) : []);

    public Context Context(FakeTerminal terminal, IProcessRunner runner, ISelfCheckPorts? ports = null, bool claudeInstalled = true,
        string? desktopConfig = null, Action<string>? open = null)
        => new(terminal, Layout, Machine(claudeInstalled, desktopConfig), runner, _ => ports ?? new FakePorts(), open ?? (_ => { }),
            _ => 0);

    /// <summary>A notebook with one graph embed, whose document is itself JSON text, as the notebook format stores it.</summary>
    public const string NotebookWithGraph = """{"turns":[{"reply":{"embeds":[{"kind":"table","id":"t"},{"kind":"graph","id":"g","analysisId":"nb-one-graph","document":"{\"formatVersion\":\"0.1.0\"}"}]}}]}""";

    public static void Touch(string path, string text = "x")
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, text);
    }

    public void Dispose()
    {
        try
        {
            Directory.Delete(Folder, recursive: true);
        }
        catch (IOException)
        {
        }
    }
}

/// <summary>A host and an IFC server that answer as the real ones should, or as told to fail.</summary>
public sealed class FakePorts(bool hostUp = true, string graphStatus = "Ok", string ifcAnswer = "IfcDoor 12", int putStatus = 200) : ISelfCheckPorts
{
    public int Started { get; private set; }

    public List<string> Puts { get; } = [];

    public Task<IHostHandle?> StartHost()
    {
        Started++;
        return Task.FromResult<IHostHandle?>(hostUp ? new Handle(this, graphStatus) : null);
    }

    public Task<string> CallIfcTool(string tool, string argumentsJson)
        => Task.FromResult(ifcAnswer);

    private sealed class Handle(FakePorts ports, string graphStatus) : IHostHandle
    {
        public int Port => 5999;

        public Task<(int Status, string Body)> Get(string path)
            => Task.FromResult(path switch
            {
                var p when p.StartsWith("api/analyses/nb-") => (ports.Puts.Contains(p) ? 200 : 404, ""),
                var p when p.StartsWith("api/analyses/") => (200, $$"""{"nodes":[{"id":"a","status":"{{graphStatus}}"},{"id":"b","status":"{{graphStatus}}"}]}"""),
                "__notebooks/" => (200, """["one.notebook.json","two.notebook.json"]"""),
                _ => (200, "<html>"),
            });

        public Task<(int Status, string Body)> Put(string path, string json)
        {
            if (ports._putStatus is >= 200 and < 300)
                ports.Puts.Add(path);
            return Task.FromResult((ports._putStatus, ""));
        }

        public void Dispose()
        {
        }
    }

    private readonly int _putStatus = putStatus;
}
