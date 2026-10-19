namespace BimOpen.Launcher;

/// <summary>"bimopen start" and "bimopen stop": the host with the bim profile, and the notebook page in the default browser.</summary>
public static class HostCommands
{
    private static readonly TimeSpan StartLimit = TimeSpan.FromSeconds(120);

    public static async Task<int> Start(Context context)
    {
        var layout = context.Layout;
        var terminal = context.Terminal;
        if (SelfCheck.Files(layout).AnyFailed())
        {
            terminal.Print(SelfCheck.Files(layout)[0]);
            return 1;
        }
        using var http = new HttpClient();
        var running = HostState.Read(layout.HostFile) is { } state ? new HostProcess(state.Pid, state.Port) : null;
        if (running is not null && running.IsRunning() && await running.WaitUntilUp(TimeSpan.FromSeconds(3), http))
            terminal.Line($"The host is already running on port {running.Port}.");
        else
        {
            var port = HostProcess.FreePort();
            var arguments = HostArguments.For(layout, context.Settings, port, layout.Store, layout.Cache);
            var log = Path.Combine(layout.Logs, "host.log");
            terminal.Line($"Starting the host on port {port} (log: {log})...");
            running = HostProcess.Start(layout, arguments, port, log);
            if (!await running.WaitUntilUp(StartLimit, http))
            {
                running.Stop();
                terminal.Print(Finding.Fail("Host", "did not answer in time.", $"Read {log} for the reason, then run: bimopen doctor"));
                return 1;
            }
            new HostState(running.Pid, running.Port, DateTimeOffset.Now).Write(layout.HostFile);
            var installed = await NotebookGraphs.Install(NotebookGraphs.All(layout), new HostApi(running.Port, http), NotebookGraphMarker.Moved(layout));
            if (installed.Failed == 0)
                NotebookGraphMarker.Record(layout);
            if (installed.Put > 0)
                terminal.Line($"Put {installed.Put} graphs of the sample notebooks on the host.");
            if (installed.Failed > 0)
                terminal.Print(Finding.Warn("Notebook graphs", $"{installed.Failed} could not be put on the host.", $"Read {log}. Re-evaluate in a notebook puts a missing graph back itself, on its second press."));
        }
        var url = HostArguments.Url(running.Port, Layout.StartPage);
        terminal.Line($"The NRC notebooks are at {url}");
        terminal.Line("The host keeps running after this window closes. To stop it: bimopen stop");
        context.OpenUrl(url);
        return 0;
    }

    public static int Stop(Context context)
    {
        var terminal = context.Terminal;
        var path = context.Layout.HostFile;
        if (HostState.Read(path) is not { } state)
        {
            terminal.Line("No host started by bimopen is recorded, so there is nothing to stop.");
            return 0;
        }
        var host = new HostProcess(state.Pid, state.Port);
        var wasRunning = host.IsRunning();
        host.Stop();
        HostState.Delete(path);
        terminal.Line(wasRunning ? $"Stopped the host on port {state.Port}." : "The host had already stopped.");
        return 0;
    }
}
