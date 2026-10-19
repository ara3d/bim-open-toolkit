using System.Text.Json;
using System.Text.Json.Nodes;

namespace BimOpen.Launcher;

/// <summary>Step 2, second half: the Claude desktop app keeps MCP servers in its own file, claude_desktop_config.json.</summary>
public static class DesktopConfig
{
    public const string FileName = "claude_desktop_config.json";

    public const string BackupSuffix = ".bimopen-backup";

    private static readonly JsonSerializerOptions Indented = new() { WriteIndented = true };

    /// <summary>The config files that exist: %APPDATA%\Claude, and the Microsoft Store package copy of that folder.</summary>
    public static IReadOnlyList<string> Find(Func<string, string?> env, Func<string, bool> fileExists, Func<string, IReadOnlyList<string>> subfolders)
    {
        var plain = env("APPDATA") is { } appData ? [Path.Combine(appData, "Claude", FileName)] : Array.Empty<string>();
        var packaged = env("LOCALAPPDATA") is { } local
            ? subfolders(Path.Combine(local, "Packages"))
                .Where(dir => Path.GetFileName(dir).StartsWith("Claude_", StringComparison.OrdinalIgnoreCase))
                .Select(dir => Path.Combine(dir, "LocalCache", "Roaming", "Claude", FileName))
            : [];
        return [.. plain.Concat(packaged).Where(fileExists)];
    }

    /// <summary>The file text with the servers added or replaced and everything else untouched; null when it holds them already
    /// or is not a JSON object.</summary>
    public static string? WithServers(string json, IReadOnlyList<McpServer> servers)
    {
        if (servers.All(s => ClaudeConfig.Registered(json).TryGetValue(s.Name, out var have) && have.SameAs(s)))
            return null;
        try
        {
            if (JsonNode.Parse(json) is not JsonObject root)
                return null;
            var table = root["mcpServers"] as JsonObject ?? new JsonObject();
            foreach (var server in servers)
                table[server.Name] = new JsonObject
                {
                    ["command"] = server.Command,
                    ["args"] = new JsonArray([.. server.Args.Select(a => (JsonNode?)JsonValue.Create(a))]),
                };
            root["mcpServers"] = table;
            return root.ToJsonString(Indented) + Environment.NewLine;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Registers the servers in one file, first keeping a copy of it beside it.</summary>
    public static Finding Register(string path, IReadOnlyList<McpServer> servers)
    {
        var json = File.ReadAllText(path);
        if (WithServers(json, servers) is not { } updated)
            return servers.All(s => ClaudeConfig.Registered(json).ContainsKey(s.Name))
                ? Finding.Ok("Claude desktop app", $"already registered in {path}; nothing changed.")
                : Finding.Warn("Claude desktop app", $"{path} is not a JSON object, so it was left alone.",
                    "Open the file, fix it or empty it to {}, and run setup again.");
        var backup = path + BackupSuffix;
        if (!File.Exists(backup))
            File.Copy(path, backup);
        File.WriteAllText(path, updated);
        return Finding.Ok("Claude desktop app", $"registered in {path} (a copy of the old file is {Path.GetFileName(backup)}). Restart the desktop app to load it.");
    }
}
