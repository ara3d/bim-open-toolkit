namespace BimOpen.Launcher;

/// <summary>Step 2: finds the command-line program of Claude Code.</summary>
public static class ClaudeFinder
{
    public static readonly IReadOnlyList<string> Names = ["claude.exe", "claude.cmd", "claude.bat"];

    public const string InstallPage = "https://code.claude.com/docs/en/setup";

    /// <summary>The documented Windows install, printed for the user to run; setup never runs it.</summary>
    public const string InstallCommand = "irm https://claude.ai/install.ps1 | iex";

    public static string InstallHelp
        => "Install Claude Code, then open a new terminal and run setup again.\n"
            + $"In PowerShell: {InstallCommand}\n"
            + $"Other ways (WinGet, npm) are on {InstallPage}";

    /// <summary>The folders searched: PATH first, then where the installer and npm put it.</summary>
    public static IReadOnlyList<string> Folders(Func<string, string?> env)
    {
        var path = (env("PATH") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var known = new[]
        {
            env("USERPROFILE") is { } home ? Path.Combine(home, ".local", "bin") : null,
            env("APPDATA") is { } appData ? Path.Combine(appData, "npm") : null,
            env("LOCALAPPDATA") is { } local ? Path.Combine(local, "Programs", "claude") : null,
        };
        return [.. path, .. known.OfType<string>()];
    }

    public static string? Find(Func<string, string?> env, Func<string, bool> fileExists)
        => Folders(env)
            .SelectMany(folder => Names.Select(name => Path.Combine(folder, name)))
            .FirstOrDefault(fileExists);
}
