using System.Diagnostics;
using BimOpen.Launcher;

// bimopen setup    the wizard: checks the computer, finds Claude, registers the MCP servers and skills,
//                  tests the host and the IFC server (also what a double-click runs)
// bimopen doctor   the same checks again, changing nothing, with what to do about each problem
// bimopen start    starts the host with the bim profile and opens the NRC notebook page
// bimopen stop     stops the host that start left running
// bimopen questions  puts the nine NRC questions to the Duplex model through the claude command
var command = args.FirstOrDefault()?.ToLowerInvariant();
var layout = Layout.Here();
var terminal = new ConsoleTerminal();
var http = new HttpClient();
var context = new Context(terminal, layout, Machine.Real, new ProcessRunner(),
    settings => new RealSelfCheckPorts(layout, settings, http), OpenInBrowser, RunSetupFrom);

switch (command)
{
    case null or "setup":
        var code = await Wizard.Setup(context, async () => await HostCommands.Start(context));
        if (command is null)
            terminal.Read("Press Enter to close this window. ");
        return code;
    case "doctor":
        return await Doctor.Run(context);
    case "start":
        return await HostCommands.Start(context);
    case "stop":
        return HostCommands.Stop(context);
    case "questions":
        return QuestionsCommand.Run(context, RunInConsole);
    case "version" or "--version":
        terminal.Line(Release.Describe(layout));
        return 0;
    default:
        terminal.Line("bimopen setup    check this computer, connect the toolkit to your Claude, and test it (a double-click does this)");
        terminal.Line("bimopen doctor   run every check again and say what is wrong and how to fix it");
        terminal.Line("bimopen start    start the host and open the NRC notebooks in your browser");
        terminal.Line("bimopen stop     stop the host that start left running");
        terminal.Line("bimopen questions  put the nine NRC questions to the Duplex model through your Claude Code (spends tokens)");
        return command is "help" or "--help" or "-h" or "/?" ? 0 : 2;
}

// BIMOPEN_NO_BROWSER=1 only prints the address, for scripts and for machines with no browser.
static void OpenInBrowser(string url)
{
    if (Environment.GetEnvironmentVariable("BIMOPEN_NO_BROWSER") is not { Length: > 0 })
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
}

static int RunSetupFrom(string exe)
{
    using var child = Process.Start(new ProcessStartInfo(exe, "setup") { UseShellExecute = false })!;
    child.WaitForExit();
    return child.ExitCode;
}

static int RunInConsole(string exe, IReadOnlyList<string> arguments)
{
    var info = new ProcessStartInfo(exe) { UseShellExecute = false };
    foreach (var argument in arguments)
        info.ArgumentList.Add(argument);
    info.Environment["ASK_PROVIDER"] = QuestionsCommand.Provider;
    using var child = Process.Start(info)!;
    child.WaitForExit();
    return child.ExitCode;
}
