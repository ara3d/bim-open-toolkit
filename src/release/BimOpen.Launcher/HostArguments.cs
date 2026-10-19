namespace BimOpen.Launcher;

/// <summary>The command line of the studio host, started by "bimopen start" and by the self-check.</summary>
public static class HostArguments
{
    public static IReadOnlyList<string> For(Layout layout, Settings settings, int port, string store, string cache)
        =>
        [
            "--profile", "bim",
            "--port", port.ToString(),
            "--web", layout.Web,
            "--store", store,
            "--cache", cache,
            "--models", settings.ModelsArgument(layout),
        ];

    public static string Url(int port, string page = "")
        => $"http://127.0.0.1:{port}/{page}";
}
