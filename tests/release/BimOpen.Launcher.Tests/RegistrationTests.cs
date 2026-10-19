using System.Text.Json.Nodes;

namespace BimOpen.Launcher.Tests;

[TestFixture]
public sealed class RegistrationTests
{
    [Test]
    public void McpServer_For_NamesBothServersAsTheSkillsDo()
    {
        var servers = McpServer.For(new Layout("C:\\r"), new Settings());
        Assert.That(servers.Select(s => s.Name), Is.EqualTo(new[] { "bimopen-ifc", "bimopenflow-duckdb" }));
        Assert.That(servers[0].Command, Is.EqualTo("C:\\r\\bin\\bimopenmcp-ifc.exe"));
        Assert.That(servers[1].Command, Is.EqualTo("C:\\r\\bin\\bimopenflow-studio.exe"));
        Assert.That(servers[1].Args.Take(3), Is.EqualTo(new[] { "mcp", "--profile", "bim" }));
    }

    [Test]
    public void Apply_RegistersThenLeavesACurrentRegistrationAlone()
    {
        using var sandbox = new Sandbox();
        var claude = new FakeClaude(sandbox.UserConfig);
        var cli = new ClaudeCli("claude", claude);
        var server = McpServer.For(sandbox.Layout, new Settings())[0];

        var first = Registration.Apply(cli, server, ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(sandbox.UserConfig)));
        Assert.That(first.Message, Is.EqualTo("registered in Claude Code."));

        var again = Registration.Apply(cli, server, ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(sandbox.UserConfig)));
        Assert.That(again.Message, Does.StartWith("already registered"));
        Assert.That(claude.Calls.Count(c => c.StartsWith("mcp add")), Is.EqualTo(1));
    }

    [Test]
    public void Apply_ReplacesARegistrationForAnotherFolder()
    {
        using var sandbox = new Sandbox();
        var claude = new FakeClaude(sandbox.UserConfig);
        var cli = new ClaudeCli("claude", claude);
        var old = new McpServer("bimopen-ifc", "C:\\old\\bimopenmcp-ifc.exe", []);
        cli.Add(old);

        var finding = Registration.Apply(cli, McpServer.For(sandbox.Layout, new Settings())[0], ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(sandbox.UserConfig)));

        Assert.That(finding.Message, Is.EqualTo("registration updated in Claude Code."));
        Assert.That(claude.Calls, Does.Contain("mcp remove --scope user bimopen-ifc"));
        Assert.That(ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(sandbox.UserConfig))["bimopen-ifc"].Command, Does.StartWith(sandbox.Layout.Root));
    }

    [Test]
    public void Inspect_ReportsMissingDifferentAndCurrentWithoutChangingAnything()
    {
        var wanted = new McpServer("a", "C:\\a.exe", ["x"]);
        var none = new Dictionary<string, McpServer>();
        Assert.That(Registration.Inspect(wanted, none).Status, Is.EqualTo(Status.Fail));
        Assert.That(Registration.Inspect(wanted, new Dictionary<string, McpServer> { ["a"] = wanted with { Args = ["y"] } }).Message, Does.Contain("another folder"));
        Assert.That(Registration.Inspect(wanted, new Dictionary<string, McpServer> { ["a"] = wanted with { Command = "c:\\A.EXE" } }).Status, Is.EqualTo(Status.Ok));
    }

    [Test]
    public void Registered_ReadsCommandAndArgsAndIgnoresDamagedText()
    {
        var servers = ClaudeConfig.Registered("""{"mcpServers":{"s":{"type":"stdio","command":"c.exe","args":["a","b"],"env":{}},"u":{"url":"http://x"}}}""");
        Assert.That(servers.Keys, Is.EqualTo(new[] { "s" }));
        Assert.That(servers["s"].Args, Is.EqualTo(new[] { "a", "b" }));
        Assert.That(ClaudeConfig.Registered("{ broken"), Is.Empty);
        Assert.That(ClaudeConfig.Registered(null), Is.Empty);
    }

    [Test]
    public void UserFile_FollowsClaudeConfigDir()
    {
        Assert.That(ClaudeConfig.UserFile(n => n == "CLAUDE_CONFIG_DIR" ? "D:\\cfg" : "C:\\u"), Is.EqualTo("D:\\cfg\\.claude.json"));
        Assert.That(ClaudeConfig.UserFile(n => n == "USERPROFILE" ? "C:\\u" : null), Is.EqualTo("C:\\u\\.claude.json"));
        Assert.That(ClaudeConfig.SkillsFolder(n => n == "USERPROFILE" ? "C:\\u" : null), Is.EqualTo("C:\\u\\.claude\\skills"));
    }

    [Test]
    public void Skills_InstallCopiesOnceAndReportsStaleFolders()
    {
        using var sandbox = new Sandbox();
        sandbox.WithRelease();
        var target = Path.Combine(sandbox.ClaudeConfigDir, "skills");

        Assert.That(Skills.Stale(sandbox.Layout.SkillSources, target), Is.EquivalentTo(new[] { "bim-flow", "ifc-ask" }));
        Assert.That(Skills.Install(sandbox.Layout.SkillSources, target), Is.EqualTo(2));
        Assert.That(Skills.Install(sandbox.Layout.SkillSources, target), Is.EqualTo(0));
        Assert.That(Skills.Stale(sandbox.Layout.SkillSources, target), Is.Empty);

        File.WriteAllText(Path.Combine(target, "bim-flow", "SKILL.md"), "edited");
        Assert.That(Skills.Stale(sandbox.Layout.SkillSources, target), Is.EqualTo(new[] { "bim-flow" }));
    }

    [Test]
    public void DesktopConfig_AddsServersKeepsEverythingElseAndBacksUpOnce()
    {
        using var sandbox = new Sandbox();
        var file = Path.Combine(sandbox.Profile, "AppData", "Roaming", "Claude", DesktopConfig.FileName);
        Sandbox.Touch(file, """{"preferences":{"sidebarMode":"x"},"mcpServers":{"other":{"command":"o.exe","args":[]}}}""");
        var servers = McpServer.For(sandbox.Layout, new Settings());

        var first = DesktopConfig.Register(file, servers);
        var root = JsonNode.Parse(File.ReadAllText(file))!;
        Assert.That(first.Message, Does.Contain("registered in"));
        Assert.That(root["preferences"]!["sidebarMode"]!.GetValue<string>(), Is.EqualTo("x"));
        Assert.That(root["mcpServers"]!.AsObject().Select(p => p.Key), Is.EquivalentTo(new[] { "other", "bimopen-ifc", "bimopenflow-duckdb" }));
        Assert.That(File.Exists(file + DesktopConfig.BackupSuffix), Is.True);

        var before = File.ReadAllText(file);
        Assert.That(DesktopConfig.Register(file, servers).Message, Does.Contain("nothing changed"));
        Assert.That(File.ReadAllText(file), Is.EqualTo(before));
    }

    [Test]
    public void DesktopConfig_LeavesAFileThatIsNotAJsonObjectAlone()
    {
        using var sandbox = new Sandbox();
        var file = Path.Combine(sandbox.Folder, DesktopConfig.FileName);
        Sandbox.Touch(file, "[1, 2]");
        Assert.That(DesktopConfig.Register(file, McpServer.For(sandbox.Layout, new Settings())).Status, Is.EqualTo(Status.Warn));
        Assert.That(File.ReadAllText(file), Is.EqualTo("[1, 2]"));
    }

    [Test]
    public void DesktopConfig_Find_ListsPlainAndPackagedCopiesThatExist()
    {
        using var sandbox = new Sandbox();
        var plain = Path.Combine(sandbox.Profile, "AppData", "Roaming", "Claude", DesktopConfig.FileName);
        var packaged = Path.Combine(sandbox.Profile, "AppData", "Local", "Packages", "Claude_abc", "LocalCache", "Roaming", "Claude", DesktopConfig.FileName);
        Sandbox.Touch(plain);
        Sandbox.Touch(packaged);
        var machine = sandbox.Machine();
        Assert.That(DesktopConfig.Find(machine.Env, machine.FileExists, machine.Subfolders), Is.EqualTo(new[] { plain, packaged }));
    }
}
