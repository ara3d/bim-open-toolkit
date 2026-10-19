using System.Text.Json;

namespace BimOpen.Launcher;

/// <summary>Who Claude Code is signed in as, from "claude auth status --json".</summary>
public sealed record ClaudeAuth(bool LoggedIn, string? Method);

/// <summary>The few things asked of the claude command: its version, whether it is signed in, and the user-scope MCP list.
/// None of them calls the model, so none spends tokens.</summary>
public sealed class ClaudeCli(string executable, IProcessRunner runner)
{
    private static readonly TimeSpan Quick = TimeSpan.FromSeconds(60);

    public string Executable => executable;

    public string? Version()
        => runner.Run(executable, ["--version"], Quick) is { Succeeded: true } result ? result.Output.Trim() : null;

    public ClaudeAuth? Auth()
        => ParseAuth(runner.Run(executable, ["auth", "status", "--json"], Quick));

    /// <summary>Signed in or not; null when the command gave no readable answer. A not-signed-in claude exits 1 with JSON that says so.</summary>
    public static ClaudeAuth? ParseAuth(RunResult result)
    {
        try
        {
            using var json = JsonDocument.Parse(result.Output);
            var root = json.RootElement;
            return root.TryGetProperty("loggedIn", out var flag) && flag.ValueKind is JsonValueKind.True or JsonValueKind.False
                ? new(flag.GetBoolean(), root.TryGetProperty("authMethod", out var method) ? method.GetString() : null)
                : null;
        }
        catch (JsonException)
        {
            return result.ExitCode == 1 && result.Output.Contains("Not logged in", StringComparison.OrdinalIgnoreCase)
                ? new(false, null)
                : null;
        }
    }

    public RunResult Add(McpServer server)
        => runner.Run(executable, ["mcp", "add", "--scope", "user", server.Name, "--", server.Command, .. server.Args], Quick);

    public RunResult Remove(string name)
        => runner.Run(executable, ["mcp", "remove", "--scope", "user", name], Quick);
}
