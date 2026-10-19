namespace BimOpen.Launcher;

/// <summary>Step 4: the MCP servers and skills in Claude Code, and in the desktop app on request.</summary>
public static class RegistrationSteps
{
    public static IReadOnlyList<Finding> Apply(Context context, ClaudeCli claude)
    {
        var wanted = McpServer.For(context.Layout, context.Settings);
        var registered = ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(ClaudeConfig.UserFile(context.Machine.Env)));
        var findings = wanted.Select(server => Registration.Apply(claude, server, registered)).ToList();
        findings.Add(InstallSkills(context));
        return findings;
    }

    public static Finding InstallSkills(Context context)
    {
        var target = ClaudeConfig.SkillsFolder(context.Machine.Env);
        return Skills.Report(Skills.Install(context.Layout.SkillSources, target), target);
    }

    public static IReadOnlyList<Finding> Inspect(Context context)
    {
        var wanted = McpServer.For(context.Layout, context.Settings);
        var registered = ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(ClaudeConfig.UserFile(context.Machine.Env)));
        var findings = wanted.Select(server => Registration.Inspect(server, registered)).ToList();
        var stale = Skills.Stale(context.Layout.SkillSources, ClaudeConfig.SkillsFolder(context.Machine.Env));
        findings.Add(stale.Count == 0
            ? Finding.Ok("Skills", "bim-flow and ifc-ask are installed.")
            : Finding.Fail("Skills", $"not installed or out of date: {string.Join(", ", stale)}.", "Run: bimopen setup"));
        return findings;
    }

    public static IReadOnlyList<Finding> Desktop(Context context, IReadOnlyList<string> files)
    {
        var wanted = McpServer.For(context.Layout, context.Settings);
        return files.Select(file => DesktopConfig.Register(file, wanted)).ToList();
    }

    public static IReadOnlyList<Finding> InspectDesktop(Context context, IReadOnlyList<string> files)
    {
        var wanted = McpServer.For(context.Layout, context.Settings);
        return files
            .Select(file => (file, registered: ClaudeConfig.Registered(ClaudeConfig.ReadOrNull(file))))
            .Select(entry => wanted.All(w => Registration.StateOf(w, entry.registered) == RegistrationState.Current)
                ? Finding.Ok("Claude desktop app", $"{entry.file} has both servers.")
                : Finding.Warn("Claude desktop app", $"{entry.file} lacks the BIM Open servers.",
                    "Only needed if you use the desktop app. Run: bimopen setup, and answer yes to the desktop app question."))
            .ToList();
    }
}
