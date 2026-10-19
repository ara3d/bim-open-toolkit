using System.Text.Json;

namespace BimOpen.Launcher;

/// <summary>What the user chose in setup, kept in bimopen.json beside bimopen.exe.</summary>
public sealed record Settings(string? ModelsFolder = null)
{
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true, PropertyNameCaseInsensitive = true };

    public static Settings Load(string path)
    {
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize<Settings>(File.ReadAllText(path), Options) ?? new() : new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    public void Save(string path)
        => File.WriteAllText(path, JsonSerializer.Serialize(this, Options) + Environment.NewLine);

    /// <summary>The folders the host and the MCP server list models from: the chosen one first, then the NRC files
    /// the notebooks read; with no choice, the bundled public samples and the NRC files.</summary>
    public IReadOnlyList<string> ModelFolders(Layout layout)
        => ModelsFolder is { Length: > 0 } chosen
            ? [chosen, .. layout.DefaultModelFolders.Skip(1)]
            : layout.DefaultModelFolders;

    public string ModelsArgument(Layout layout)
        => string.Join(';', ModelFolders(layout));
}
