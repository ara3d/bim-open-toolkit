namespace BimOpen.Launcher.Tests;

[TestFixture]
public sealed class WizardTests
{
    private static Task<int> NoStart() => Task.FromResult(0);

    [Test]
    public async Task SelfCheck_AllWellGivesOkForEachStep()
    {
        using var sandbox = new Sandbox().WithRelease();
        var findings = await SelfCheck.Run(sandbox.Layout, new FakePorts());
        Assert.That(findings.Select(f => f.Subject), Is.EqualTo(new[] { "Release files", "Host", "Sample graph", "Notebook page", "Notebook graphs", "IFC server" }));
        Assert.That(findings.All(f => f.Status == Status.Ok), Is.True, findings.Text());
    }

    [Test]
    public async Task SelfCheck_MissingFilesStopBeforeStartingAnything()
    {
        using var sandbox = new Sandbox();
        var ports = new FakePorts();
        var findings = await SelfCheck.Run(sandbox.Layout, ports);
        Assert.That(findings, Has.Count.EqualTo(1));
        Assert.That(findings[0].Message, Does.Contain("bimopenflow-studio.exe"));
        Assert.That(ports.Started, Is.EqualTo(0));
    }

    [Test]
    public async Task SelfCheck_HostThatDoesNotAnswerPointsAtItsLog()
    {
        using var sandbox = new Sandbox().WithRelease();
        var findings = await SelfCheck.Run(sandbox.Layout, new FakePorts(hostUp: false));
        var host = findings.Single(f => f.Subject == "Host");
        Assert.That(host.Status, Is.EqualTo(Status.Fail));
        Assert.That(host.Fix, Does.Contain(SelfCheck.HostLogName));
    }

    [Test]
    public async Task SelfCheck_GraphThatIsNotOkAndAnIfcAnswerWithoutDoorsFail()
    {
        using var sandbox = new Sandbox().WithRelease();
        var findings = await SelfCheck.Run(sandbox.Layout, new FakePorts(graphStatus: "Error", ifcAnswer: "IfcWall 3"));
        Assert.That(findings.Single(f => f.Subject == "Sample graph").Message, Does.Contain("Error"));
        Assert.That(findings.Single(f => f.Subject == "IFC server").Status, Is.EqualTo(Status.Fail));
    }

    [Test]
    public async Task Setup_HappyPath_RegistersBothServersInstallsSkillsAndWritesAReport()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal("", "n");
        var claude = new FakeClaude(sandbox.UserConfig);

        var code = await Wizard.Setup(sandbox.Context(terminal, claude), NoStart);

        Assert.That(code, Is.EqualTo(0), terminal.Said);
        Assert.That(ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(sandbox.UserConfig)).Keys, Is.EquivalentTo(new[] { "bimopen-ifc", "bimopenflow-duckdb" }));
        Assert.That(File.Exists(Path.Combine(sandbox.ClaudeConfigDir, "skills", "bim-flow", "SKILL.md")), Is.True);
        Assert.That(File.ReadAllText(sandbox.Layout.SetupLog), Does.Contain("exit 0"));
        Assert.That(terminal.Said, Does.Contain("Step 1 of 6").And.Contain("Step 6 of 6").And.Contain("Everything works."));
    }

    [Test]
    public async Task Setup_RunTwice_ChangesNothingTheSecondTime()
    {
        using var sandbox = new Sandbox().WithRelease();
        var claude = new FakeClaude(sandbox.UserConfig);
        await Wizard.Setup(sandbox.Context(new FakeTerminal("", "n"), claude), NoStart);
        var configAfterFirst = File.ReadAllText(sandbox.UserConfig);
        var addsAfterFirst = claude.Calls.Count(c => c.StartsWith("mcp add"));

        var second = new FakeTerminal("", "n");
        await Wizard.Setup(sandbox.Context(second, claude), NoStart);

        Assert.That(claude.Calls.Count(c => c.StartsWith("mcp add")), Is.EqualTo(addsAfterFirst));
        Assert.That(File.ReadAllText(sandbox.UserConfig), Is.EqualTo(configAfterFirst));
        Assert.That(second.Said, Does.Contain("already registered").And.Contain("nothing changed"));
    }

    [Test]
    public async Task Setup_ClaudeMissing_PrintsTheInstallCommandAndStopsWhenTheUserQuits()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal("q");

        var code = await Wizard.Setup(sandbox.Context(terminal, new FakeClaude(sandbox.UserConfig), claudeInstalled: false), NoStart);

        Assert.That(code, Is.EqualTo(1));
        Assert.That(terminal.Said, Does.Contain(ClaudeFinder.InstallCommand));
        Assert.That(File.Exists(sandbox.UserConfig), Is.False);
    }

    [Test]
    public async Task Setup_ClaudeInstalledWhileWaiting_ContinuesOnTheNextCheck()
    {
        using var sandbox = new Sandbox().WithRelease();
        var installed = false;
        var script = new FakeTerminal("", "", "n");
        var context = sandbox.Context(script, new FakeClaude(sandbox.UserConfig));
        context = context with
        {
            Machine = context.Machine with { FileExists = path => path == sandbox.ClaudePath ? installed : File.Exists(path) },
            Terminal = new InstallAfterFirstPrompt(script, () => installed = true),
        };

        Assert.That(await Wizard.Setup(context, NoStart), Is.EqualTo(0), script.Said);
        Assert.That(script.Said, Does.Contain("was not found"));
    }

    [Test]
    public async Task Setup_NotSignedIn_ExplainsAndStopsWhenTheUserQuits()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal("q");

        var code = await Wizard.Setup(sandbox.Context(terminal, new FakeClaude(sandbox.UserConfig, signedIn: false)), NoStart);

        Assert.That(code, Is.EqualTo(1));
        Assert.That(terminal.Said, Does.Contain("claude auth login"));
    }

    [Test]
    public async Task Setup_AFolderOfYourOwn_IsSavedAndReachesTheFlowServer()
    {
        using var sandbox = new Sandbox().WithRelease();
        var mine = Path.Combine(sandbox.Folder, "my models");
        Directory.CreateDirectory(mine);

        await Wizard.Setup(sandbox.Context(new FakeTerminal(mine, "n"), new FakeClaude(sandbox.UserConfig)), NoStart);

        Assert.That(Settings.Load(sandbox.Layout.SettingsFile).ModelsFolder, Is.EqualTo(mine));
        Assert.That(ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(sandbox.UserConfig))["bimopenflow-duckdb"].Args, Does.Contain($"{mine};{sandbox.Layout.DefaultModelFolders[1]}"));
    }

    [Test]
    public async Task Setup_AFolderThatDoesNotExist_IsRefusedWithAWarning()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal(Path.Combine(sandbox.Folder, "nowhere"), "n");

        await Wizard.Setup(sandbox.Context(terminal, new FakeClaude(sandbox.UserConfig)), NoStart);

        Assert.That(terminal.Said, Does.Contain("does not exist"));
        Assert.That(Settings.Load(sandbox.Layout.SettingsFile).ModelsFolder, Is.Null);
    }

    [Test]
    public async Task Setup_DesktopApp_RegistersThereOnlyWhenAsked()
    {
        using var sandbox = new Sandbox().WithRelease();
        var desktop = Path.Combine(sandbox.Profile, "AppData", "Roaming", "Claude", DesktopConfig.FileName);
        Sandbox.Touch(desktop, "{}");

        await Wizard.Setup(sandbox.Context(new FakeTerminal("", "n", "n"), new FakeClaude(sandbox.UserConfig)), NoStart);
        Assert.That(File.ReadAllText(desktop), Is.EqualTo("{}"));

        await Wizard.Setup(sandbox.Context(new FakeTerminal("", "y", "n"), new FakeClaude(sandbox.UserConfig)), NoStart);
        Assert.That(ClaudeConfig.Registered(File.ReadAllText(desktop)).Keys, Is.EquivalentTo(new[] { "bimopen-ifc", "bimopenflow-duckdb" }));
    }

    [Test]
    public async Task Setup_FailedSelfCheck_EndsWithAProblemAndOffersNoStart()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal("", "y");

        var code = await Wizard.Setup(sandbox.Context(terminal, new FakeClaude(sandbox.UserConfig), new FakePorts(hostUp: false)), NoStart);

        Assert.That(code, Is.EqualTo(1));
        Assert.That(terminal.Said, Does.Contain("[FAIL] Host").And.Contain("bimopen doctor"));
        Assert.That(terminal.Said, Does.Not.Contain("Step 6"));
    }

    [Test]
    public async Task Setup_Start_RunsTheStartCommandWhenAccepted()
    {
        using var sandbox = new Sandbox().WithRelease();
        var started = 0;

        await Wizard.Setup(sandbox.Context(new FakeTerminal("", "y"), new FakeClaude(sandbox.UserConfig)), () => Task.FromResult(++started));

        Assert.That(started, Is.EqualTo(1));
    }

    [Test]
    public async Task Doctor_ReportsEveryProblemWithAFixAndChangesNothing()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal();
        var claude = new FakeClaude(sandbox.UserConfig);

        var code = await Doctor.Run(sandbox.Context(terminal, claude));

        Assert.That(code, Is.EqualTo(1));
        Assert.That(terminal.Said, Does.Contain("[FAIL] bimopen-ifc: not registered").And.Contain("Run: bimopen setup"));
        Assert.That(terminal.Said, Does.Contain("[FAIL] Skills"));
        Assert.That(claude.Calls.Any(c => c.StartsWith("mcp")), Is.False);
        Assert.That(File.Exists(sandbox.UserConfig), Is.False);
    }

    [Test]
    public async Task Doctor_AfterSetup_FindsNoProblems()
    {
        using var sandbox = new Sandbox().WithRelease();
        var claude = new FakeClaude(sandbox.UserConfig);
        await Wizard.Setup(sandbox.Context(new FakeTerminal("", "n"), claude), NoStart);
        var terminal = new FakeTerminal();

        var code = await Doctor.Run(sandbox.Context(terminal, claude));

        Assert.That(code, Is.EqualTo(0), terminal.Said);
        Assert.That(terminal.Said, Does.Contain("No problems found"));
    }

    [Test]
    public async Task Doctor_ClaudeMissing_SaysSoWithTheInstallCommand()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal();

        var code = await Doctor.Run(sandbox.Context(terminal, new FakeClaude(sandbox.UserConfig), claudeInstalled: false));

        Assert.That(code, Is.EqualTo(1));
        Assert.That(terminal.Said, Does.Contain("[FAIL] Claude Code").And.Contain(ClaudeFinder.InstallCommand));
    }

    [Test]
    public void Print_PutsTheFixUnderTheMessage()
    {
        var terminal = new FakeTerminal();
        terminal.Print(Finding.Fail("Thing", "broke.", "do this\nthen that"));
        Assert.That(terminal.Lines, Is.EqualTo(new[] { "  [FAIL] Thing: broke.", "         do this", "         then that" }));
    }

    [Test]
    public void Confirm_AndAsk_TakeTheDefaultOnAnEmptyAnswerOrNoInput()
    {
        Assert.That(new FakeTerminal("").Confirm("q", true), Is.True);
        Assert.That(new FakeTerminal("").Confirm("q", false), Is.False);
        Assert.That(new FakeTerminal("yes").Confirm("q", false), Is.True);
        Assert.That(new FakeTerminal("N").Confirm("q", true), Is.False);
        Assert.That(new FakeTerminal().Ask("q", "dflt"), Is.EqualTo("dflt"));
        Assert.That(new FakeTerminal("\"C:\\x y\"").Ask("q", "d"), Is.EqualTo("C:\\x y"));
    }

    /// <summary>Flips a switch (Claude gets installed) when the wizard first stops to wait, then answers from the script.</summary>
    private sealed class InstallAfterFirstPrompt(FakeTerminal inner, Action onFirstPrompt) : ITerminal
    {
        private bool _first = true;

        public void Line(string text = "")
            => inner.Line(text);

        public string? Read(string prompt)
        {
            if (_first)
            {
                _first = false;
                onFirstPrompt();
            }
            return inner.Read(prompt);
        }
    }
}
