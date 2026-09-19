using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Ara3D.MCP;
using BimOpenFlow.Ask;
using BimOpenFlow.Host;
using BimOpenFlow.Host.Api;
using BimOpenFlow.Host.Store;
using BimOpenMcp.Flow;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace BimOpenFlow.Studio;

/// <summary>A request, and optionally the graph whose conversation it continues.</summary>
public sealed record AskRequest(string Request, string? AnalysisId = null);

/// <summary>POST /api/ask: a plain-language request in, a server-sent event
/// stream out (one JSON object per 'data:' line): 'start', then 'tool' and
/// 'text' events as the agent works, then 'done' with the analysis id, or
/// 'error'. With 'analysisId' the request continues that graph's conversation,
/// so a follow-up ("now sort by name") sees everything the agent did before.
/// Requests run one at a time; the store is last-writer-wins.</summary>
public static class AskEndpoint
{
    public const string Route = "/api/ask";
    public const string ModelInfoRoute = "/api/ask/model";
    private const int ConversationsKept = 24;
    private const int CheckRounds = 2;

    /// <summary>Not offered to the Ask agent: the prompt already carries the
    /// catalog and the database list, and runs, models and whole-document saves
    /// play no part in building a graph from a request.</summary>
    public static readonly IReadOnlySet<string> HiddenTools = new HashSet<string>(StringComparer.Ordinal)
    {
        "getNodeCatalog", "listDatabases", "listModels", "saveAnalysis", "createRun", "listRuns",
    };

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public static IEndpointRouteBuilder MapAsk(this IEndpointRouteBuilder app, HostServices host)
    {
        var services = new FlowServices(host, new AnalysisSessions(host.Store, host.Registry));
        var tools = FlowMcpServer.RegisterTools(
            new McpServer(McpServer.DefaultPort, FlowMcpServer.ServerName, FlowMcpServer.ServerVersion, transport: McpTransport.Http),
            services);
        var system = new Lazy<string>(() => AskPrompts.System(services));
        var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
        var model = OpenAiChat.ResolveModel();
        var conversations = new ConcurrentDictionary<string, JsonArray>(StringComparer.Ordinal);
        var recent = new ConcurrentQueue<string>();

        app.MapGet(ModelInfoRoute, () => Results.Json(new { model, configured = KeyStatus() is null, problem = KeyStatus() }));
        app.MapPost(Route, async (HttpContext context, AskRequest body, CancellationToken ct) =>
        {
            context.Response.Headers.ContentType = "text/event-stream";
            context.Response.Headers.CacheControl = "no-cache";
            await context.Response.StartAsync(ct);
            Task Emit(object payload) => WriteEvent(context.Response, payload, ct);

            if (string.IsNullOrWhiteSpace(body.Request))
            {
                await Emit(new { type = "error", message = "Type a request first." });
                return;
            }
            string apiKey;
            try
            {
                apiKey = OpenAiChat.ResolveApiKey() ?? throw new InvalidOperationException(MissingKey);
            }
            catch (Exception e)
            {
                await Emit(new { type = "error", message = e.Message });
                return;
            }

            await Gate.WaitAsync(ct);
            try
            {
                // A follow-up continues a conversation this host remembers (even one that
                // only asked a question back) or, after a restart, a graph that exists.
                var requested = body.AnalysisId?.Trim();
                var known = requested is { Length: > 0 } && conversations.TryGetValue(requested, out var remembered)
                    ? remembered
                    : null;
                var continuing = known is not null || (requested is { Length: > 0 } && host.Store.Exists(requested));
                var id = continuing ? requested! : AskIds.For(body.Request, host.Store.Exists);
                var messages = known ?? Remember(conversations, recent, id, AskAgent.NewConversation(system.Value));
                var user = continuing
                    ? AskPrompts.FollowUp(body.Request, id, resumed: known is null)
                    : AskPrompts.User(body.Request, id);
                await Emit(new { type = "start", analysisId = id, model, continuing });
                var agent = new AskAgent(tools, new OpenAiChat(http, apiKey, model)) { Hidden = HiddenTools };
                Task Report(AskEvent e)
                    => Emit(new { type = e.Type, name = e.Name, args = e.Args, ok = e.Ok, summary = e.Summary, text = e.Text });
                var outcome = await agent.RunAsync(messages, user, Report, ct);

                // The host's own check: the agent gets up to two more turns to fix or
                // explain a graph that does not evaluate or answers with no rows.
                var problem = AskChecks.Verify(services, id);
                for (var round = 0; problem is not null && round < CheckRounds; round++)
                {
                    await Emit(new { type = "check", ok = false, summary = problem });
                    var retry = await agent.RunAsync(messages, AskPrompts.Check(problem), Report, ct);
                    outcome = new AskOutcome(retry.Text, outcome.Turns + retry.Turns,
                        outcome.InputTokens + retry.InputTokens, outcome.OutputTokens + retry.OutputTokens);
                    problem = AskChecks.Verify(services, id);
                }
                await Emit(new
                {
                    type = "done",
                    analysisId = id,
                    built = host.Store.Exists(id),
                    verified = host.Store.Exists(id) && problem is null,
                    problem,
                    text = outcome.Text,
                    turns = outcome.Turns,
                    inputTokens = outcome.InputTokens,
                    outputTokens = outcome.OutputTokens,
                    model,
                });
            }
            catch (OperationCanceledException)
            {
                // The browser went away; nothing to tell it.
            }
            catch (Exception e)
            {
                await Emit(new { type = "error", message = e.Message });
            }
            finally
            {
                Gate.Release();
            }
        });
        return app;
    }

    private const string MissingKey =
        "No OpenAI key: set OPENAI_API_KEY, or OPENAI_API_KEY_FILE to a file whose first line is the key, and restart the studio host.";

    private static JsonArray Remember(ConcurrentDictionary<string, JsonArray> conversations, ConcurrentQueue<string> recent,
        string id, JsonArray messages)
    {
        conversations[id] = messages;
        recent.Enqueue(id);
        while (recent.Count > ConversationsKept && recent.TryDequeue(out var old))
            conversations.TryRemove(old, out _);
        return messages;
    }

    private static string? KeyStatus()
    {
        try
        {
            return OpenAiChat.ResolveApiKey() is null ? MissingKey : null;
        }
        catch (Exception e)
        {
            return e.Message;
        }
    }

    private static async Task WriteEvent(HttpResponse response, object payload, CancellationToken ct)
    {
        var line = "data: " + JsonSerializer.Serialize(payload, Json) + "\n\n";
        await response.Body.WriteAsync(Encoding.UTF8.GetBytes(line), ct);
        await response.Body.FlushAsync(ct);
    }
}

/// <summary>Analysis ids for asked-for graphs: 'ask-' plus the first words of
/// the request, with a numeric suffix when the id is taken.</summary>
public static partial class AskIds
{
    public const string Prefix = "ask-";
    private const int MaxWords = 5;
    private const int MaxLength = 48;

    public static string For(string request, Func<string, bool> exists)
    {
        var words = NonSlug().Replace(request.ToLowerInvariant(), " ")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => !StopWords.Contains(w))
            .Take(MaxWords)
            .ToList();
        var stem = Prefix + (words.Count > 0 ? string.Join('-', words) : "graph");
        if (stem.Length > MaxLength)
            stem = stem[..MaxLength].TrimEnd('-');
        var id = stem;
        for (var n = 2; exists(id); n++)
            id = $"{stem}-{n}";
        return id;
    }

    private static readonly HashSet<string> StopWords =
    [
        "a", "an", "the", "of", "for", "to", "in", "on", "by", "and", "or", "with", "me", "my", "i", "we",
        "is", "are", "be", "please", "show", "list", "give", "build", "make", "create", "want", "need",
        "how", "many", "much", "which", "what", "each", "every", "all", "that", "this", "it", "its", "their",
    ];

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlug();
}

/// <summary>The stable system prompt (databases, node vocabulary, the schema
/// guide, working rules) and the per-request user messages.</summary>
public static class AskPrompts
{
    public static string System(FlowServices services)
    {
        var databases = McpJson.Serialize(FlowDatabaseTools.ListDatabases(services));
        var catalog = McpJson.Serialize(FlowDocumentTools.GetNodeCatalog(services));
        var preferred = DefaultDatabase(services);
        return
            "You build BimOpenFlow dataflow graphs for a DuckDB workflow studio, using only the tools provided. "
            + "A graph is a set of nodes joined by edges from an output port ('nodeId.port') to an input port. "
            + "Every graph tool takes the analysis id given in the request; pass it as 'id' on every call.\n\n"
            + "Databases available (give the path to the duck.source node's 'path' parameter):\n" + databases + "\n"
            + (preferred is null
                ? ""
                : $"Use {preferred} unless the request names another database; the other files are variants of the same model.\n")
            + "\n"
            + "Node kinds available, with their input ports, output ports, and parameters (parameter values are strings; "
            + "enum parameters list their allowed values):\n" + catalog + "\n\n"
            + SchemaGuide + "\n\n"
            + NodeGuide + "\n\n"
            + Rules;
    }

    /// <summary>The database the existing graphs use most (their duck.source
    /// paths), so the agent builds against the same export the studio shows;
    /// null when no graph names one.</summary>
    public static string? DefaultDatabase(FlowServices services)
    {
        var store = services.Host.Store;
        return store.List()
            .Select(entry => store.Load(entry.Id))
            .SelectMany(doc => doc.Nodes
                .Where(n => n.Kind == "duck.source")
                .Select(n => doc.Values.TryGetValue(n.Id, out var values) && values.TryGetValue("path", out var path) ? path : null))
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .GroupBy(path => path!, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key, StringComparer.Ordinal)
            .Select(g => g.Key)
            .FirstOrDefault();
    }

    /// <summary>The guides and rules, read from the .claude/skills/bim-flow files embedded
    /// at build time, so the Claude Code skill and this prompt never drift apart.</summary>
    public static readonly string SchemaGuide = Guide("schema-guide");
    public static readonly string NodeGuide = Guide("node-guide");
    public static readonly string Rules = Guide("working-rules");

    private static string Guide(string name)
        => EmbeddedText.Read(typeof(AskPrompts).Assembly, $"skills/bim-flow/{name}.md");

    public static string User(string request, string analysisId)
        => $"Analysis id: {analysisId}\n\nRequest: {request.Trim()}";

    /// <summary>The host's automatic check, handed to the agent as one more turn.</summary>
    public static string Check(string problem)
        => $"Automatic check of the graph: {problem} Fix the graph and evaluate again, or, if the request cannot be "
           + "satisfied from this database, say so plainly in your answer.";

    /// <summary>A follow-up on an existing graph. When the conversation was lost
    /// (host restarted), the agent is told to read the graph first.</summary>
    public static string FollowUp(string request, string analysisId, bool resumed)
        => resumed
            ? $"Analysis id: {analysisId} (this graph already exists; call getAnalysis to read it before changing it)\n\nFollow-up: {request.Trim()}"
            : $"Follow-up on analysis {analysisId}: {request.Trim()}";
}
