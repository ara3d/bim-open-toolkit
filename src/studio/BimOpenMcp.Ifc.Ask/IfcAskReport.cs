using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BimOpenMcp.Ifc.Ask;

/// <summary>The two records a run leaves behind: a Markdown transcript to read, and a JSON file
/// to check. Both are pure functions of the answers, so a test can assert their shape without
/// running anything. The transcript carries each tool call's arguments in full and its result as
/// one line — the whole result text is what the model read, not what a reader needs.</summary>
public static class IfcAskReport
{
    /// <summary>What the run was: when, which language model, which IFC file, and which commit of
    /// this toolkit produced it. The commit is omitted when git cannot say.</summary>
    public sealed record Header(DateTimeOffset Date, string Model, string IfcPath, string? Commit);

    public static string Markdown(Header header, IReadOnlyList<IfcAskAnswer> answers)
    {
        var text = new StringBuilder();
        text.AppendLine("# IFC questions answered through the MCP tools").AppendLine();
        text.AppendLine($"- Date: {header.Date:yyyy-MM-dd HH:mm:ss zzz}");
        text.AppendLine($"- Language model: {header.Model}");
        text.AppendLine($"- IFC model: `{header.IfcPath}`");
        if (header.Commit is { Length: > 0 })
            text.AppendLine($"- Toolkit commit: `{header.Commit}`");
        foreach (var answer in answers)
            AppendAnswer(text, answer);
        return text.ToString();
    }

    private static void AppendAnswer(StringBuilder text, IfcAskAnswer answer)
    {
        text.AppendLine().AppendLine($"### {answer.Question}").AppendLine();
        foreach (var e in answer.Events)
        {
            if (e.Type == "tool")
            {
                text.AppendLine($"**Agent calls** `{e.Name}` with").AppendLine();
                text.AppendLine("```json").AppendLine(Pretty(e.Args)).AppendLine("```").AppendLine();
                text.AppendLine($"**Result** {(e.Ok == true ? "" : "failed: ")}{e.Summary}").AppendLine();
            }
            else if (!string.IsNullOrWhiteSpace(e.Text))
            {
                text.AppendLine(e.Text.Trim()).AppendLine();
            }
        }
        text.AppendLine($"**Answer:** {answer.Answer}").AppendLine();
        text.AppendLine($"Turns {answer.Turns}; input tokens {answer.InputTokens}; output tokens {answer.OutputTokens}.");
    }

    public static string Json(IReadOnlyList<IfcAskAnswer> answers)
    {
        var array = new JsonArray();
        foreach (var answer in answers)
        {
            var calls = new JsonArray();
            foreach (var call in answer.ToolCalls)
                calls.Add(new JsonObject
                {
                    ["name"] = call.Name,
                    ["args"] = call.Args?.DeepClone() ?? new JsonObject(),
                    ["ok"] = call.Ok ?? false,
                    ["summary"] = call.Summary ?? "",
                });
            array.Add(new JsonObject
            {
                ["question"] = answer.Question,
                ["answer"] = answer.Answer,
                ["turns"] = answer.Turns,
                ["inputTokens"] = answer.InputTokens,
                ["outputTokens"] = answer.OutputTokens,
                ["toolCalls"] = calls,
            });
        }
        return array.ToJsonString(Indented);
    }

    /// <summary>`git rev-parse --short HEAD` in the given directory, or null when there is no git,
    /// no repository, or no commit. Never throws: the transcript is worth writing either way.</summary>
    public static string? GitCommit(string directory)
    {
        try
        {
            using var git = Process.Start(new ProcessStartInfo("git", "rev-parse --short HEAD")
            {
                WorkingDirectory = directory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            });
            if (git is null)
                return null;
            var output = git.StandardOutput.ReadToEnd().Trim();
            git.WaitForExit(GitTimeoutMs);
            return git.HasExited && git.ExitCode == 0 && output.Length > 0 ? output : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private const int GitTimeoutMs = 5000;

    private static readonly JsonSerializerOptions Indented = new() { WriteIndented = true };

    private static string Pretty(JsonNode? args)
        => (args ?? new JsonObject()).ToJsonString(Indented);
}
