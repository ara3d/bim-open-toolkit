using System.Text.Json;

namespace BimOpen.Launcher;

/// <summary>The host that "bimopen start" left running, remembered in state/host.json for "bimopen stop".</summary>
public sealed record HostState(int Pid, int Port, DateTimeOffset Started)
{
    public static HostState? Read(string path)
    {
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize<HostState>(File.ReadAllText(path)) : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public void Write(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(this));
    }

    public static void Delete(string path)
        => File.Delete(path);
}
