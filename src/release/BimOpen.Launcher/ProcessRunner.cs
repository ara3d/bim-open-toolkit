using System.ComponentModel;
using System.Diagnostics;

namespace BimOpen.Launcher;

public sealed record RunResult(int ExitCode, string Output, string Error)
{
    public bool Succeeded => ExitCode == 0;

    public static RunResult Missing(string message) => new(-1, "", message);
}

/// <summary>Runs a program and collects its output; a fake stands in for it in tests.</summary>
public interface IProcessRunner
{
    RunResult Run(string file, IReadOnlyList<string> arguments, TimeSpan timeout);
}

public sealed class ProcessRunner : IProcessRunner
{
    public RunResult Run(string file, IReadOnlyList<string> arguments, TimeSpan timeout)
    {
        var info = new ProcessStartInfo(file)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
        };
        foreach (var argument in arguments)
            info.ArgumentList.Add(argument);
        try
        {
            using var process = Process.Start(info)!;
            process.StandardInput.Close();
            var output = process.StandardOutput.ReadToEndAsync();
            var error = process.StandardError.ReadToEndAsync();
            if (process.WaitForExit(timeout))
                return new(process.ExitCode, output.Result, error.Result);
            process.Kill(entireProcessTree: true);
            return RunResult.Missing($"{Path.GetFileName(file)} did not finish in {timeout.TotalSeconds:0} seconds.");
        }
        catch (Exception e) when (e is Win32Exception or InvalidOperationException)
        {
            return RunResult.Missing(e.Message);
        }
    }
}
