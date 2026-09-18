using Ara3D.MCP;
using BimOpenFlow.Ask;

namespace BimOpenMcp.Ifc.Ask;

/// <summary>Asks a language model a list of questions about one IFC model, unattended. Each
/// question runs in a fresh conversation against the same in-process tool server, so an answer
/// can never lean on what an earlier question found, and a question that fails does not stop
/// the rest.</summary>
public sealed class IfcAskRunner(McpServer tools, OpenAiChat chat, string modelPath, int maxTurns = IfcAskRunner.DefaultMaxTurns)
{
    public const int DefaultMaxTurns = 40;

    /// <summary>Tools the model is not offered. Exports write files nobody reads here, and the
    /// session tools only matter to a client holding several models open; each one the model
    /// tries costs a turn.</summary>
    public static readonly IReadOnlySet<string> HiddenTools = new HashSet<string>(StringComparer.Ordinal)
    {
        "ifc_export_glb", "ifc_sql_export", "ifc_close", "ifc_models",
    };

    /// <summary>The tool server the runner drives: registered but never started, because the agent
    /// posts to its JSON-RPC handler in process. The caller owns the cache and the server.</summary>
    public static McpServer CreateServer(IfcSessionCache cache)
        => IfcMcpServer.RegisterTools(
            new McpServer(McpServer.DefaultPort, IfcMcpServer.ServerName, IfcMcpServer.ServerVersion, transport: McpTransport.Http),
            cache);

    public string System { get; init; } = IfcAskPrompts.System(modelPath);

    /// <summary>Called as the run proceeds, for a progress line; the console writes these to stderr.</summary>
    public Action<string>? Progress { get; init; }

    public async Task<IReadOnlyList<IfcAskAnswer>> RunAsync(IReadOnlyList<string> questions, CancellationToken ct)
    {
        var answers = new List<IfcAskAnswer>(questions.Count);
        for (var i = 0; i < questions.Count; i++)
        {
            ct.ThrowIfCancellationRequested();
            Progress?.Invoke($"[{i + 1}/{questions.Count}] {questions[i]}");
            var answer = await AskAsync(questions[i], ct);
            Progress?.Invoke($"    {answer.ToolCalls.Count} tool calls, {answer.Turns} turns, "
                + $"{answer.InputTokens} in / {answer.OutputTokens} out tokens");
            answers.Add(answer);
        }
        return answers;
    }

    /// <summary>One question in its own conversation. A model that never answers (the turn limit,
    /// an API failure) is recorded as an unanswered question with the calls it did make, because
    /// an unattended run should finish the list and report what happened.</summary>
    public async Task<IfcAskAnswer> AskAsync(string question, CancellationToken ct)
    {
        var events = new List<AskEvent>();
        var agent = new AskAgent(tools, chat, maxTurns) { Hidden = HiddenTools };
        Task Record(AskEvent e)
        {
            events.Add(e);
            if (e.Type == "tool")
                Progress?.Invoke($"    {e.Name}: {(e.Ok == true ? "" : "FAILED ")}{e.Summary}");
            return Task.CompletedTask;
        }
        try
        {
            var outcome = await agent.RunAsync(System, IfcAskPrompts.User(question), Record, ct);
            return new IfcAskAnswer(question, outcome.Text, outcome.Turns, outcome.InputTokens, outcome.OutputTokens, events);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            Progress?.Invoke($"    not answered: {e.Message}");
            return new IfcAskAnswer(question, $"Not answered: {e.Message}", events.Count, 0, 0, events);
        }
    }
}
