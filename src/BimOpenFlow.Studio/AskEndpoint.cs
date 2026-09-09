using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Ara3D.MCP;
using BimOpenFlow.Host;
using BimOpenFlow.Host.Api;
using BimOpenFlow.Host.Store;
using BimOpenFlow.Mcp;
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
                var agent = new AskAgent(tools, new OpenAiChat(http, apiKey, model));
                Task Report(AskEvent e)
                    => Emit(new { type = e.Type, name = e.Name, args = e.Args, ok = e.Ok, summary = e.Summary, text = e.Text });
                var outcome = await agent.RunAsync(messages, user, Report, ct);

                // The host's own check: the agent gets one more turn to fix or explain
                // a graph that does not evaluate or answers with no rows.
                var problem = AskChecks.Verify(services, id);
                if (problem is not null)
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

    public const string SchemaGuide =
        "About these databases (BIM Open Schema exports of building models):\n"
        + "- One table per element category (door, window, wall, space, storey, roof, floor, stair, ...) plus core tables: "
        + "bim_object (one row per object identity), source_document / source_revision / source_object (where each row came "
        + "from), evidence (how facts were established), model_snapshot, interpretation_policy, material. A category table "
        + "with 0 rows means this export has no elements of that kind: say so plainly and offer what is there; never invent data.\n"
        + "- Element tables share columns: id (a long hash, not for display), element_name (the type or room name), "
        + "element_mark (the tag or number), element_location_primary_storey (a storey.id; join to storey for its name), "
        + "element_location_spaces (list of space ids), element_placement_origin_x/y/z (metres), element_geometry.\n"
        + "- storey: element_name (e.g. 'L1 - Block 35'), number, sort_order, elevation (m), floor_to_floor_height. The same "
        + "level name can appear once per building block, so count and group by storey id, and show the name.\n"
        + "- space (rooms): number, element_name, storey (storey.id), use, department, net_floor_area, clear_height, "
        + "net_volume, design_occupancy, doors (list). door: nominal_width, nominal_height, clear_width, clear_height (metres), "
        + "leaf_count, operation, fire_resistance, is_accessible, adjacent_spaces (list). roof: storey, net_surface_area, "
        + "projected_area, representative_slope, edge_length.\n"
        + "- Every established value x may have companions x_assurance, x_reason, x_explanation, x_evidence. Numeric "
        + "columns are often NULL because the source never established them; x_reason says why (e.g. NotObserved). Never "
        + "replace NULL with 0, never infer a size from a name, and when a requested measure is missing, include its reason "
        + "column and say so in the summary.\n"
        + "- Lineage: source_object (table, row, local_id, source_role) -> source_revision (document_id, exporter) -> "
        + "source_document (name, discipline). The evidence behind a fact x is the list x_evidence of evidence.id values: "
        + "UNNEST the list and join evidence on id (its columns are origin, method, explanation, sources); evidence rows "
        + "do not mention the fact by name, so never search them by text. List columns are VARCHAR[]: in SQL use len(x) for the count, "
        + "list_contains(x, v), or UNNEST(x) to expand; there is no list_length. Never select a list column into a "
        + "duck.query output that feeds table.* nodes (they cannot join, group or sort on lists): count or unnest it in SQL.\n"
        + "- Units are metres, square metres, cubic metres.";

    public const string NodeGuide =
        "About the nodes:\n"
        + "- table.derive 'expr' and table.filter 'expr' use a small expression language, not SQL: literals true/false, "
        + "numbers, 'text', null; column names bare or in [brackets]; operators + - * / % & (text concat), comparisons "
        + "== != < <= > >=, and/or/not, cond ? a : b; builtins abs min max round floor ceil len lower upper contains "
        + "startswith endswith coalesce. Null propagates through every operator, so there is no null test: "
        + "'x == null' and 'x != null' are always null and a filter on them drops every row, and 'x IS NULL' does not "
        + "parse. To flag or keep rows by missing values, do it in SQL (x IS NULL, x IS NOT NULL) in the duck.query or "
        + "a sql.query node.\n"
        + "- table.aggregate: 'groupBy' is a comma-separated column list; 'aggregates' is comma-separated "
        + "'func(column) as name' with func count/sum/min/max/avg (count(*) allowed).\n"
        + "- table.join: 'aKey' and 'bKey' name the key columns of inputs a and b; 'mode' left/inner/full/semi/anti. "
        + "table.sort: 'A', 'B', 'C' name the sort columns with 'descendingA' etc. table.project 'columns' keeps and orders "
        + "columns. A plain table.* node is a fine final 'answer'; view.table only adds a title.\n"
        + "- sql.query runs one SELECT over connected intermediate tables named t1..t4 (t is t1): use it for CASE, "
        + "window functions, UNNEST, null tests, or anything the table.* nodes cannot express. duck.query runs SQL "
        + "directly against the database.";

    public const string Rules =
        "How to work:\n"
        + "1. Call describeDatabase for the database (tables, row counts, column names), then describeDatabase with 'table' "
        + "for each table you will query, to see the column types. Do not guess column names.\n"
        + "2. Build the whole graph with one editGraph call: a duck.source node with the id 'database' and its 'path'; a "
        + "duck.query node per query, each with one read-only SELECT in 'sql' and 'database.source' connected to its 'source' "
        + "input; then the table.* nodes; then the edges. Use addNode/setParam/connect/removeNode only for small fixes.\n"
        + "3. Prefer several small nodes over one large SQL statement: queries that select and rename columns, then "
        + "table.* nodes for joins, filters, derived columns, aggregates, sorts and limits, so the graph shows the steps. "
        + "When no table.* node can express a step (UNNEST, window functions, CASE, list functions), do that step in SQL. "
        + "Column names given to table.* parameters must match the upstream output columns exactly.\n"
        + "4. Give nodes short lowercase ids that say what they hold. The final node must have the id 'answer'. Its columns "
        + "should be readable: names, marks, numbers and measures, not id hashes, unless ids were asked for.\n"
        + "5. When the graph is wired, call evaluate. If any node is not Ok, read its error, fix it, and evaluate again. "
        + "Then call getResult on 'answer' port 'table' with take 10 and check the rows answer the request; fix and "
        + "re-evaluate if they do not.\n"
        + "6. If the request is ambiguous in a way that would change the graph, or asks for data this export does not "
        + "have, ask one short question or say what is missing instead of building; the user can reply.\n"
        + "7. Finish with two or three plain sentences: what the graph does and what the result shows, including any "
        + "caveat about missing values. No markdown.";

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
