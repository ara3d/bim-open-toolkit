namespace BimOpen.Launcher;

/// <summary>Everything a command reaches outside itself for. The program builds the real one; tests build fakes.</summary>
public sealed record Context(
    ITerminal Terminal,
    Layout Layout,
    Machine Machine,
    IProcessRunner Runner,
    Func<Settings, ISelfCheckPorts> SelfCheckPorts,
    Action<string> OpenUrl,
    Func<string, int> Relaunch)
{
    public Settings Settings => Settings.Load(Layout.SettingsFile);

    /// <summary>The claude program, or null when none is installed.</summary>
    public ClaudeCli? Claude
        => ClaudeFinder.Find(Machine.Env, Machine.FileExists) is { } path ? new(path, Runner) : null;
}
