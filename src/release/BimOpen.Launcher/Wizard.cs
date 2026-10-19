namespace BimOpen.Launcher;

/// <summary>"bimopen setup": six steps, each with a plain message and, when it fails, what to do.</summary>
public static class Wizard
{
    public const int Steps = 6;

    public static async Task<int> Setup(Context context, Func<Task<int>> startHost)
    {
        var terminal = context.Terminal;
        var log = new List<Finding>();
        void Report(Finding finding)
        {
            log.Add(finding);
            terminal.Print(finding);
        }
        void Step(int number, string title)
        {
            terminal.Line();
            terminal.Line($"Step {number} of {Steps}: {title}");
        }

        terminal.Line("BIM Open Toolkit setup");
        terminal.Line("This checks your computer, connects the toolkit to your own Claude, and tests that it works.");
        terminal.Line("It installs nothing outside this folder and the settings of Claude, and running it again changes nothing that is already right.");

        Step(1, "Checking this computer");
        var computer = ComputerChecks(context).ToList();
        computer.ForEach(Report);
        if (computer.AnyFailed())
            return Finish(context, log, 1);
        if (computer.Any(f => f.Subject == SystemChecks.InstallFolder && f.Status == Status.Warn))
            return CopyAndContinue(context, log);

        Step(2, "Finding Claude");
        var claude = FindClaude(context, Report);
        if (claude is null)
            return Finish(context, log, 1);
        var desktop = ClaudeSteps.DesktopFiles(context.Machine);

        Step(3, "Choosing the models folder");
        ChooseModels(context, Report);

        Step(4, "Connecting the toolkit to Claude");
        foreach (var finding in RegistrationSteps.Apply(context, claude))
            Report(finding);
        if (desktop.Count > 0)
        {
            terminal.Line($"  The Claude desktop app is installed here ({desktop.Count} settings file). The servers can be added to it too.");
            if (terminal.Confirm("  Add them to the Claude desktop app?"))
                foreach (var finding in RegistrationSteps.Desktop(context, desktop))
                    Report(finding);
        }

        Step(5, "Testing that it works");
        terminal.Line("  Starting the host, evaluating a sample graph, and asking the IFC server a question. This takes up to a minute.");
        foreach (var finding in await SelfCheck.Run(context.Layout, context.SelfCheckPorts(context.Settings)))
            Report(finding);

        terminal.Line();
        if (log.Latest().AnyFailed())
        {
            terminal.Line("Setup finished with problems (marked [FAIL] above). Fix them, then run: bimopen doctor");
            return Finish(context, log, 1);
        }
        terminal.Line("Everything works.");

        Step(6, "Starting");
        terminal.Line("  To ask a question from any terminal, run: claude");
        terminal.Line("  and then ask, for example: how many doors are in samples\\nrc\\duplex-enriched.ifc?");
        terminal.Line("  To open the NRC notebooks in your browser later, run: bimopen start");
        if (terminal.Confirm("  Start the notebooks now?"))
            await startHost();
        return Finish(context, log, 0);
    }

    /// <summary>The folder cannot be written to, and the host writes its store and the samples derived files there:
    /// copy the release to the per-user folder and run setup from the copy.</summary>
    private static int CopyAndContinue(Context context, IReadOnlyList<Finding> log)
    {
        var target = SystemChecks.FallbackFolder(context.Machine.Env);
        if (!context.Terminal.Confirm($"  Copy the release to {target} and continue there?"))
            return Finish(context, log, 1);
        context.Terminal.Line($"  Copying {ReleaseCopy.Copy(context.Layout.Root, target)} files...");
        return context.Relaunch(Path.Combine(target, "bimopen.exe"));
    }

    private static IEnumerable<Finding> ComputerChecks(Context context)
    {
        yield return SystemChecks.Windows(OsInfo.Current);
        yield return SystemChecks.InstallLocation(context.Layout, SystemChecks.IsWritable, SystemChecks.FallbackFolder(context.Machine.Env));
        yield return SystemChecks.DiskSpace(context.Layout.Root, SystemChecks.FreeBytes(context.Layout.Root));
    }

    /// <summary>Finds claude, waiting while the user installs it or signs in; null when they give up.</summary>
    private static ClaudeCli? FindClaude(Context context, Action<Finding> report)
    {
        var terminal = context.Terminal;
        while (true)
        {
            var found = ClaudeSteps.Installed(context.Claude);
            report(found);
            if (found.Status == Status.Ok)
                break;
            if (terminal.Read("  Press Enter after installing Claude Code to check again, or type q to stop: ") is not { } answer
                || answer.Trim().Equals("q", StringComparison.OrdinalIgnoreCase))
                return null;
        }
        var claude = context.Claude!;
        while (true)
        {
            var signedIn = ClaudeSteps.SignedIn(claude);
            report(signedIn);
            if (signedIn.Status != Status.Fail)
                return claude;
            if (terminal.Read("  Press Enter after signing in to check again, type c to continue without, or q to stop: ") is not { } answer
                || answer.Trim().Equals("q", StringComparison.OrdinalIgnoreCase))
                return null;
            if (answer.Trim().Equals("c", StringComparison.OrdinalIgnoreCase))
                return claude;
        }
    }

    private static void ChooseModels(Context context, Action<Finding> report)
    {
        var settings = context.Settings;
        context.Terminal.Line("  The toolkit opens IFC and BOS models from folders. The bundled public samples (the Duplex and others) and the NRC files are always there.");
        var answer = context.Terminal.Ask("  A folder of your own models to add (Enter for none)", settings.ModelsFolder ?? "");
        if (answer.Length == 0)
        {
            settings = settings with { ModelsFolder = null };
            report(Finding.Ok("Models folder", "the bundled public samples and the NRC files."));
        }
        else if (Directory.Exists(answer))
        {
            settings = settings with { ModelsFolder = Path.GetFullPath(answer) };
            report(Finding.Ok("Models folder", $"{settings.ModelsFolder}, then the NRC files."));
        }
        else
            report(Finding.Warn("Models folder", $"{answer} does not exist, so the choice was not saved.", "Run: bimopen setup again with a folder that exists."));
        settings.Save(context.Layout.SettingsFile);
    }

    private static int Finish(Context context, IReadOnlyList<Finding> log, int code)
    {
        try
        {
            File.AppendAllText(context.Layout.SetupLog,
                $"{DateTimeOffset.Now:u} bimopen setup, exit {code}{Environment.NewLine}{log.Text()}{Environment.NewLine}{Environment.NewLine}");
            context.Terminal.Line($"A report was added to {context.Layout.SetupLog}");
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            context.Terminal.Line($"The report could not be written to {context.Layout.SetupLog}: {e.Message}");
        }
        return code;
    }
}
