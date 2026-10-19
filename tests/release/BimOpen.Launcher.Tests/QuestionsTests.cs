namespace BimOpen.Launcher.Tests;

[TestFixture]
public sealed class QuestionsTests
{
    [Test]
    public void Arguments_NameTheDuplexTheQuestionFileAndTheOutputs()
    {
        var arguments = QuestionsCommand.Arguments(new Layout("C:\\r"));
        Assert.That(arguments, Is.EqualTo(new[]
        {
            "--model", "C:\\r\\samples\\nrc\\duplex-enriched.ifc",
            "--questions", "C:\\r\\samples\\nrc\\questions.txt",
            "--out", "C:\\r\\artifacts\\nrc\\transcript.md",
            "--results", "C:\\r\\artifacts\\nrc\\results.json",
        }));
    }

    [Test]
    public void Run_StartsTheRunnerWhenClaudeIsInstalledAndSignedIn()
    {
        using var sandbox = new Sandbox().WithRelease();
        var calls = new List<string>();

        var code = QuestionsCommand.Run(sandbox.Context(new FakeTerminal(), new FakeClaude(sandbox.UserConfig)),
            (exe, arguments) =>
            {
                calls.Add(exe);
                return 0;
            });

        Assert.That(code, Is.EqualTo(0));
        Assert.That(calls, Is.EqualTo(new[] { sandbox.Layout.Bin + "\\bimopenmcp-ifc-ask.exe" }));
    }

    [Test]
    public void Run_DoesNotSpendTokensWhenNotSignedIn()
    {
        using var sandbox = new Sandbox().WithRelease();
        var terminal = new FakeTerminal();
        var started = false;

        var code = QuestionsCommand.Run(sandbox.Context(terminal, new FakeClaude(sandbox.UserConfig, signedIn: false)),
            (_, _) =>
            {
                started = true;
                return 0;
            });

        Assert.That(code, Is.EqualTo(1));
        Assert.That(started, Is.False);
        Assert.That(terminal.Said, Does.Contain("claude auth login"));
    }
}
