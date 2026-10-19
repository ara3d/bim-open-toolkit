namespace BimOpen.Launcher;

/// <summary>"bimopen questions": the Ask runner puts the NRC paper's nine questions to the Duplex model through the claude command,
/// and writes the transcript and the results. It spends tokens from the user's own Claude account, so it never runs on its own.</summary>
public static class QuestionsCommand
{
    public const string Provider = "claude-cli";

    public static string Program(Layout layout)
        => Path.Combine(layout.Bin, "bimopenmcp-ifc-ask.exe");

    public static string OutputFolder(Layout layout)
        => Path.Combine(layout.Root, "artifacts", "nrc");

    public static IReadOnlyList<string> Arguments(Layout layout)
        =>
        [
            "--model", Path.Combine(layout.Samples, "nrc", SelfCheck.SampleModel),
            "--questions", Path.Combine(layout.Samples, "nrc", "questions.txt"),
            "--out", Path.Combine(OutputFolder(layout), "transcript.md"),
            "--results", Path.Combine(OutputFolder(layout), "results.json"),
        ];

    /// <summary>Runs the questions with the console shared with the runner, so its progress shows; needs Claude Code signed in.</summary>
    public static int Run(Context context, Func<string, IReadOnlyList<string>, int> runInConsole)
    {
        var terminal = context.Terminal;
        var claude = context.Claude;
        var installed = ClaudeSteps.Installed(claude);
        if (claude is null || installed.Status != Status.Ok)
        {
            terminal.Print(installed);
            return 1;
        }
        var signedIn = ClaudeSteps.SignedIn(claude);
        if (signedIn.Status == Status.Fail)
        {
            terminal.Print(signedIn);
            return 1;
        }
        terminal.Line("Putting the nine NRC questions to the Duplex model through your Claude Code. This spends tokens from your account");
        terminal.Line($"and takes a few minutes. The answers will be in {OutputFolder(context.Layout)}");
        return runInConsole(Program(context.Layout), Arguments(context.Layout));
    }
}
