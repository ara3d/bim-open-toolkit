using System.Text.Json;

namespace BimOpen.Launcher;

/// <summary>What release.json says about the folder: its version and the commit it was built from.</summary>
public static class Release
{
    public static string Describe(Layout layout)
    {
        var path = Path.Combine(layout.Root, "release.json");
        try
        {
            using var json = JsonDocument.Parse(File.ReadAllText(path));
            var root = json.RootElement;
            return $"BIM Open Toolkit {root.GetProperty("version").GetString()} (commit {root.GetProperty("commit").GetString()?[..Math.Min(10, root.GetProperty("commit").GetString()!.Length)]})";
        }
        catch (Exception e) when (e is IOException or JsonException or KeyNotFoundException)
        {
            return "BIM Open Toolkit (no release.json beside bimopen.exe)";
        }
    }
}
