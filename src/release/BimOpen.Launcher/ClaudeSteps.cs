namespace BimOpen.Launcher;

/// <summary>Step 2: whether Claude Code is installed and signed in. Read-only, so the doctor shares it.</summary>
public static class ClaudeSteps
{
    public static Finding Installed(ClaudeCli? claude)
        => claude is null
            ? Finding.Fail("Claude Code", "the claude command was not found on PATH or in its usual folders.", ClaudeFinder.InstallHelp)
            : claude.Version() is { } version
                ? Finding.Ok("Claude Code", $"{version} at {claude.Executable}.")
                : Finding.Fail("Claude Code", $"{claude.Executable} was found but did not run.",
                    "Run it in a terminal to see why: claude --version. Reinstalling Claude Code usually fixes it.");

    /// <summary>Asks Claude Code whether it is signed in; the question uses no tokens.</summary>
    public static Finding SignedIn(ClaudeCli claude)
        => claude.Auth() switch
        {
            { LoggedIn: true, Method: { } method } => Finding.Ok("Sign-in", $"Claude Code is signed in ({method})."),
            { LoggedIn: true } => Finding.Ok("Sign-in", "Claude Code is signed in."),
            { LoggedIn: false } => Finding.Fail("Sign-in", "Claude Code is not signed in.",
                "Run: claude auth login\nFollow the browser page it opens with your own Claude account, then run this again."),
            _ => Finding.Warn("Sign-in", "Claude Code did not say whether it is signed in.",
                "Run: claude auth status\nIf it says you are not logged in, run: claude auth login"),
        };

    public static IReadOnlyList<string> DesktopFiles(Machine machine)
        => DesktopConfig.Find(machine.Env, machine.FileExists, machine.Subfolders);
}
