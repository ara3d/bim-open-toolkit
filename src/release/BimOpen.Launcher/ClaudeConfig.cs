using System.Text.Json;
using System.Text.Json.Nodes;

namespace BimOpen.Launcher;

/// <summary>Where Claude Code keeps its user-scope settings, and the MCP servers registered there.</summary>
public static class ClaudeConfig
{
    /// <summary>The folder CLAUDE_CONFIG_DIR names, else .claude in the user profile.</summary>
    public static string Folder(Func<string, string?> env)
        => env("CLAUDE_CONFIG_DIR") is { Length: > 0 } dir
            ? dir
            : Path.Combine(env("USERPROFILE") ?? "", ".claude");

    /// <summary>The file with user-scope MCP servers: .claude.json inside CLAUDE_CONFIG_DIR when set, else in the user profile.</summary>
    public static string UserFile(Func<string, string?> env)
        => env("CLAUDE_CONFIG_DIR") is { Length: > 0 } dir
            ? Path.Combine(dir, ".claude.json")
            : Path.Combine(env("USERPROFILE") ?? "", ".claude.json");

    public static string SkillsFolder(Func<string, string?> env)
        => Path.Combine(Folder(env), "skills");

    /// <summary>The servers under "mcpServers" in a Claude config JSON text (Claude Code's file or the desktop app's), by name.</summary>
    public static IReadOnlyDictionary<string, McpServer> Registered(string? json)
    {
        var found = new Dictionary<string, McpServer>();
        if (string.IsNullOrWhiteSpace(json))
            return found;
        try
        {
            if ((JsonNode.Parse(json) as JsonObject)?["mcpServers"] is JsonObject servers)
                foreach (var (name, node) in servers)
                    if (node?["command"]?.GetValue<string>() is { } command)
                        found[name] = new(name, command, node["args"] is JsonArray args ? [.. args.Select(a => a?.GetValue<string>() ?? "")] : []);
        }
        catch (JsonException)
        {
        }
        return found;
    }

    public static string? ReadOrNull(string path)
        => File.Exists(path) ? File.ReadAllText(path) : null;
}
