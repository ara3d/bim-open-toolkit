namespace BimOpen.Launcher;

/// <summary>What the wizard reads from the computer: environment variables and the file system. Tests give it a fake.</summary>
public sealed record Machine(
    Func<string, string?> Env,
    Func<string, bool> FileExists,
    Func<string, IReadOnlyList<string>> Subfolders)
{
    public static Machine Real { get; } = new(
        Environment.GetEnvironmentVariable,
        File.Exists,
        dir => Directory.Exists(dir) ? Directory.GetDirectories(dir) : []);
}
