namespace BimOpen.Launcher;

/// <summary>"bimopen doctor": every check again, changing nothing, with what is wrong and how to fix it.</summary>
public static class Doctor
{
    public static async Task<int> Run(Context context)
    {
        var terminal = context.Terminal;
        var findings = new List<Finding>();
        void Report(Finding finding)
        {
            findings.Add(finding);
            terminal.Print(finding);
        }

        terminal.Line("BIM Open Toolkit doctor");
        terminal.Line();
        Report(SystemChecks.Windows(OsInfo.Current));
        Report(SystemChecks.InstallLocation(context.Layout, SystemChecks.IsWritable, SystemChecks.FallbackFolder(context.Machine.Env)));
        Report(SystemChecks.DiskSpace(context.Layout.Root, SystemChecks.FreeBytes(context.Layout.Root)));

        var claude = context.Claude;
        Report(ClaudeSteps.Installed(claude));
        if (claude is not null)
        {
            Report(ClaudeSteps.SignedIn(claude));
            RegistrationSteps.Inspect(context).ToList().ForEach(Report);
        }
        RegistrationSteps.InspectDesktop(context, ClaudeSteps.DesktopFiles(context.Machine)).ToList().ForEach(Report);

        var folders = context.Settings.ModelFolders(context.Layout);
        var missing = folders.Where(f => !Directory.Exists(f)).ToList();
        Report(missing.Count == 0
            ? Finding.Ok("Models folder", string.Join("; ", folders))
            : Finding.Fail("Models folder", $"{string.Join(", ", missing)} does not exist.",
                "Run: bimopen setup, and choose a folder that exists."));

        terminal.Line("  Testing the host and the IFC server (up to a minute)...");
        foreach (var finding in await SelfCheck.Run(context.Layout, context.SelfCheckPorts(context.Settings)))
            Report(finding);

        terminal.Line();
        var problems = findings.Count(f => f.Status == Status.Fail);
        var warnings = findings.Count(f => f.Status == Status.Warn);
        terminal.Line(problems == 0
            ? $"No problems found{(warnings > 0 ? $" ({warnings} to look at)" : "")}."
            : $"{problems} problem{(problems == 1 ? "" : "s")} found. The line under each [FAIL] says what to do.");
        return problems == 0 ? 0 : 1;
    }
}
