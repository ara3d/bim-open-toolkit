using System.Diagnostics;
using System.Text.Json;

namespace BimOpen.Launcher;

/// <summary>A minimal MCP client over stdio: starts a server program, initializes it, calls one tool, stops it.</summary>
public static class McpStdioClient
{
    public static async Task<string> CallTool(string program, string tool, string argumentsJson, TimeSpan limit)
    {
        var info = new ProcessStartInfo(program)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        using var process = Process.Start(info) ?? throw new InvalidOperationException($"{program} did not start.");
        using var cancel = new CancellationTokenSource(limit);
        try
        {
            _ = process.StandardError.ReadToEndAsync();
            var initialize = new { protocolVersion = "2024-11-05", capabilities = new { }, clientInfo = new { name = "bimopen", version = "1" } };
            await Send(process, new { jsonrpc = "2.0", id = 1, method = "initialize", @params = initialize });
            await ReadReply(process, 1, cancel.Token);
            await Send(process, new { jsonrpc = "2.0", method = "notifications/initialized" });
            var call = new { name = tool, arguments = JsonDocument.Parse(argumentsJson).RootElement };
            await Send(process, new { jsonrpc = "2.0", id = 2, method = "tools/call", @params = call });
            return TextOf(await ReadReply(process, 2, cancel.Token));
        }
        catch (OperationCanceledException)
        {
            throw new TimeoutException($"{tool} did not answer within {limit.TotalSeconds:0} seconds.");
        }
        finally
        {
            process.Kill(entireProcessTree: true);
        }
    }

    private static async Task Send(Process process, object message)
    {
        await process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(message));
        await process.StandardInput.FlushAsync();
    }

    private static async Task<JsonElement> ReadReply(Process process, int id, CancellationToken cancel)
    {
        while (await process.StandardOutput.ReadLineAsync(cancel) is { } line)
        {
            if (!line.TrimStart().StartsWith("{", StringComparison.Ordinal))
                continue;
            var reply = JsonDocument.Parse(line).RootElement.Clone();
            if (reply.TryGetProperty("id", out var replyId) && replyId.ValueKind == JsonValueKind.Number && replyId.GetInt32() == id)
                return reply;
        }
        throw new IOException("The server closed its output before it answered.");
    }

    /// <summary>The text parts of a tools/call reply; an error reply throws with its message.</summary>
    public static string TextOf(JsonElement reply)
    {
        if (reply.TryGetProperty("error", out var error))
            throw new InvalidOperationException($"The server answered with an error: {error}");
        var parts = reply.GetProperty("result").TryGetProperty("content", out var content) ? content.EnumerateArray().ToList() : [];
        return string.Join("\n", parts.Select(p => p.TryGetProperty("text", out var t) ? t.GetString() ?? "" : ""));
    }
}
