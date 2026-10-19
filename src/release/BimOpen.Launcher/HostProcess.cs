using System.Diagnostics;
using System.Net;
using System.Net.Sockets;

namespace BimOpen.Launcher;

/// <summary>A running studio host: starts it with its output in a log file, waits for it to answer, stops its process tree.</summary>
public sealed class HostProcess(int pid, int port)
{
    public int Pid => pid;

    public int Port => port;

    public static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var free = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return free;
    }

    /// <summary>Starts the host through cmd.exe so that its output goes to the log file and it outlives this program.</summary>
    public static HostProcess Start(Layout layout, IReadOnlyList<string> arguments, int port, string log)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(log)!);
        var command = $"\"\"{layout.StudioExe}\" {string.Join(' ', arguments.Select(Quote))} > \"{log}\" 2>&1\"";
        var info = new ProcessStartInfo("cmd.exe", $"/d /s /c {command}")
        {
            WorkingDirectory = layout.Root,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        // Without this the host logs every request, and the log file grows by megabytes in a session.
        info.Environment["Logging__LogLevel__Default"] = "Warning";
        return new(Process.Start(info)!.Id, port);
    }

    public static string Quote(string argument)
        => argument.Contains(' ') || argument.Contains(';') ? $"\"{argument}\"" : argument;

    public bool IsRunning()
    {
        try
        {
            return !Process.GetProcessById(pid).HasExited;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    public void Stop()
    {
        try
        {
            Process.GetProcessById(pid).Kill(entireProcessTree: true);
        }
        catch (ArgumentException)
        {
        }
    }

    /// <summary>Waits until GET /api/analyses answers, or the process ends, or the time is up.</summary>
    public async Task<bool> WaitUntilUp(TimeSpan limit, HttpClient http)
    {
        var end = DateTime.UtcNow + limit;
        while (DateTime.UtcNow < end && IsRunning())
        {
            try
            {
                if ((await http.GetAsync(HostArguments.Url(port, "api/analyses"))).IsSuccessStatusCode)
                    return true;
            }
            catch (HttpRequestException)
            {
            }
            await Task.Delay(500);
        }
        return false;
    }
}
