using System.Net;
using System.Text;
using System.Text.Json.Nodes;

namespace BimOpenMcp.Ifc.Ask.Tests;

/// <summary>Stands in for the OpenAI API: each reply is handed back in order, exactly as the API
/// would shape it, and every request is kept so a test can read what the agent sent. No key and no
/// network are involved. (`BimOpenFlow.Studio.Tests` has its own copy; sharing one would mean
/// putting it in `BimOpenToolkit.TestSupport`, which deliberately references no source project.)</summary>
public sealed class ScriptedModel(params string[] replies) : HttpMessageHandler
{
    public readonly List<JsonObject> Requests = [];

    private int _next;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Requests.Add(JsonNode.Parse(await request.Content!.ReadAsStringAsync(ct))!.AsObject());
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(replies[_next++], Encoding.UTF8, "application/json"),
        };
    }

    /// <summary>The function names offered on the request numbered <paramref name="index"/>.</summary>
    public IReadOnlyList<string> FunctionsOffered(int index)
        => Requests[index]["tools"]!.AsArray().Select(t => t!["function"]!["name"]!.GetValue<string>()).ToList();

    public static string ToolCall(string callId, string name, string arguments)
        => Reply("tool_calls", new JsonObject
        {
            ["role"] = "assistant",
            ["content"] = null,
            ["tool_calls"] = new JsonArray(new JsonObject
            {
                ["id"] = callId,
                ["type"] = "function",
                ["function"] = new JsonObject { ["name"] = name, ["arguments"] = arguments },
            }),
        });

    public static string Text(string text)
        => Reply("stop", new JsonObject { ["role"] = "assistant", ["content"] = text });

    private static string Reply(string finishReason, JsonObject message)
        => new JsonObject
        {
            ["choices"] = new JsonArray(new JsonObject { ["finish_reason"] = finishReason, ["message"] = message }),
            ["usage"] = new JsonObject { ["prompt_tokens"] = 100, ["completion_tokens"] = 20 },
        }.ToJsonString();
}
