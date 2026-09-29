using System.Text.Json.Nodes;
using Ara3D.MCP;

namespace BimOpenMcp.Ifc.Tests;

/// <summary>tools/call through <see cref="McpServer.HandlePost"/>, returning the tool's payload.</summary>
public static class McpCalls
{
    /// <summary>The payload's data, asserting the tool reported ok.</summary>
    public static JsonNode CallData(this McpServer mcp, string tool, JsonObject arguments)
    {
        var payload = mcp.Call(tool, arguments);
        Assert.That(payload["ok"]!.GetValue<bool>(), Is.True, payload["error"]?.GetValue<string>());
        return payload["data"]!;
    }

    public static JsonObject Call(this McpServer mcp, string tool, JsonObject arguments)
    {
        var request = new JsonObject
        {
            ["jsonrpc"] = "2.0",
            ["id"] = 1,
            ["method"] = "tools/call",
            ["params"] = new JsonObject { ["name"] = tool, ["arguments"] = arguments },
        };

        var result = mcp.HandlePost(request.ToJsonString());
        var response = JsonNode.Parse(result.JsonBody!)!;
        Assert.That(response["error"], Is.Null, response["error"]?.ToJsonString());
        var text = response["result"]!["content"]![0]!["text"]!.GetValue<string>();
        return (JsonObject)JsonNode.Parse(text)!;
    }

    /// <summary>The rows of an ifc_sql call.</summary>
    public static JsonArray Rows(this McpServer mcp, string path, string sql)
        => mcp.CallData("ifc_sql", new JsonObject { ["path"] = path, ["sql"] = sql, ["take"] = 100 })["rows"]!.AsArray();
}
