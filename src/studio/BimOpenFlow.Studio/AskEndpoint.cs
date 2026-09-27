using System.Text;
using System.Text.Json;
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

    /// <summary>The name the model knows the studio's tool server by (Claude Code prefixes
    /// tools with mcp__{ServerKey}__ on the command-line backend; ChatBackend ignores it).</summary>
    public const string ServerKey = "bimopenflow";

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
            new McpServer(LoopbackPorts.Free(), FlowMcpServer.ServerName, FlowMcpServer.ServerVersion, transport: McpTransport.Http),
            services);
        var system = new Lazy<string>(() => AskPrompts.System(services));
        var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
        var selection = ChatSelection.Resolve();
        var model = selection.Model;
        var setup = new AskSetup(tools, ServerKey, HiddenTools, AskAgent.DefaultMaxTurns);
        var backend = BuildBackend(selection, http, setup);
        var handler = new AskHandler(services, backend, () => system.Value, model, selection.Effort);

        app.MapGet(ModelInfoRoute, () => Results.Json(ModelInfoPayload(selection)));
        app.MapPost(Route, async (HttpContext context, AskRequest body, CancellationToken ct) =>
        {
            context.Response.Headers.ContentType = "text/event-stream";
            context.Response.Headers.CacheControl = "no-cache";
            await context.Response.StartAsync(ct);
            Task Emit(object payload) => WriteEvent(context.Response, payload, ct);

            await Gate.WaitAsync(ct);
            try
            {
                await handler.RunAsync(body, Emit, ct);
            }
            catch (OperationCanceledException)
            {
                // The browser went away; nothing to tell it.
            }
            finally
            {
                Gate.Release();
            }
        });
        return app;
    }

    /// <summary>Selection.CreateBackend can throw when no provider is configured; that is
    /// reported as the 'error' event on the first request (see AskHandler.RunAsync), not at
    /// startup, so GET /api/ask/model still answers and a later restart with a key or a login
    /// fixes it without a redeploy.</summary>
    private static IAskBackend BuildBackend(ChatSelection selection, HttpClient http, AskSetup setup)
    {
        try
        {
            return selection.CreateBackend(setup, http);
        }
        catch (Exception e)
        {
            return new FailedBackend(e.Message);
        }
    }

    /// <summary>The GET /api/ask/model payload: provider, model, effort, the claude-cli
    /// executable (null for the API providers), whether a backend is usable, and the one
    /// sentence to show when it is not.</summary>
    public static object ModelInfoPayload(ChatSelection selection)
        => new
        {
            model = selection.Model,
            provider = selection.Provider,
            effort = selection.Effort,
            executable = selection.Executable,
            configured = selection.Configured,
            problem = selection.Problem,
        };

    private sealed class FailedBackend(string message) : IAskBackend
    {
        public IAskConversation Start(string system) => throw new InvalidOperationException(message);
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
