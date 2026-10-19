using System.Text.Json;

namespace BimOpen.Launcher;

/// <summary>The graphs the sample notebooks show (their ids start with nb-): a fresh host does not hold them, so the first
/// Re-evaluate in a notebook would find nothing to read. The notebook page puts a graph back from the copy in its own embed
/// when it finds it missing, but only while it re-evaluates; this puts them there at start, so the first pass is already right.</summary>
public static class NotebookGraphs
{
    public sealed record Graph(string Id, string Document);

    /// <summary>Every graph embed (kind "graph", with an analysisId and its document) in a notebook file's text, once per id.</summary>
    public static IReadOnlyList<Graph> In(string notebookJson)
    {
        var found = new Dictionary<string, Graph>();
        try
        {
            using var json = JsonDocument.Parse(notebookJson);
            Walk(json.RootElement, found);
        }
        catch (JsonException)
        {
        }
        return [.. found.Values];
    }

    private static void Walk(JsonElement element, Dictionary<string, Graph> found)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (element.TryGetProperty("kind", out var kind) && kind.GetString() == "graph"
                    && element.TryGetProperty("analysisId", out var id) && id.ValueKind == JsonValueKind.String
                    && element.TryGetProperty("document", out var document) && document.ValueKind == JsonValueKind.String)
                    found.TryAdd(id.GetString()!, new(id.GetString()!, document.GetString()!));
                foreach (var property in element.EnumerateObject())
                    Walk(property.Value, found);
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    Walk(item, found);
                break;
        }
    }

    /// <summary>Every graph the notebooks of the release need. A graph embed carries the document the notebook recorded, so that comes
    /// first (the page then finds the host's copy identical, unless the document names a placeholder to fill); the graphs a notebook only
    /// reads results of are the files in samples/notebooks/graphs. {SAMPLES} and {ARTIFACTS} are filled in as the host fills them in
    /// for its own samples.</summary>
    public static IReadOnlyList<Graph> All(Layout layout)
    {
        var embedded = Directory.Exists(layout.Notebooks)
            ? Directory.EnumerateFiles(layout.Notebooks, "*.notebook.json").Order(StringComparer.Ordinal).SelectMany(file => In(File.ReadAllText(file)))
                .Select(graph => graph with { Document = Rewrite(graph.Document, layout) })
            : [];
        var files = Directory.Exists(layout.NotebookGraphFolder)
            ? Directory.EnumerateFiles(layout.NotebookGraphFolder, "*.json", SearchOption.AllDirectories).Order(StringComparer.Ordinal)
                .Select(file => new Graph(Path.GetFileNameWithoutExtension(file), Rewrite(File.ReadAllText(file), layout)))
                .Where(graph => !graph.Document.Contains(Unfilled, StringComparison.Ordinal))
            : [];
        return [.. embedded.Concat(files).DistinctBy(g => g.Id)];
    }

    /// <summary>A graph that needs the private Snowdon model has no value to fill in on another computer, so it is left out.</summary>
    public const string Unfilled = "{SNOWDON}";

    public static string Rewrite(string graphJson, Layout layout)
        => graphJson
            .Replace("{SAMPLES}", Slashes(Path.Combine(layout.Samples, "nrc")), StringComparison.Ordinal)
            .Replace("{ARTIFACTS}", Slashes(Path.Combine(layout.Root, "artifacts")), StringComparison.Ordinal);

    private static string Slashes(string path)
        => path.Replace('\\', '/');

    /// <summary>How many graphs were put, were there already, or could not be put.</summary>
    public sealed record Result(int Put, int Already, int Failed);

    /// <summary>Puts each graph the host lacks (GET answers 404) and leaves the others alone, so a graph the user edited stays;
    /// with <paramref name="replace"/> it puts every graph, for a release folder that moved and so changed the paths in them.</summary>
    public static async Task<Result> Install(IReadOnlyList<Graph> graphs, IHostApi host, bool replace = false)
    {
        int put = 0, already = 0, failed = 0;
        foreach (var graph in graphs)
        {
            var path = $"api/analyses/{Uri.EscapeDataString(graph.Id)}";
            if (!replace && (await host.Get(path)).Status != 404)
                already++;
            else if ((await host.Put(path, graph.Document)).Status is >= 200 and < 300)
                put++;
            else
                failed++;
        }
        return new(put, already, failed);
    }
}

/// <summary>Remembers which folder the notebook graphs were last put from, so a moved release puts them again.</summary>
public static class NotebookGraphMarker
{
    public static string FileOf(Layout layout)
        => Path.Combine(layout.State, "notebook-graphs.root");

    public static bool Moved(Layout layout)
        => !File.Exists(FileOf(layout)) || File.ReadAllText(FileOf(layout)).Trim() != layout.Root;

    public static void Record(Layout layout)
    {
        Directory.CreateDirectory(layout.State);
        File.WriteAllText(FileOf(layout), layout.Root);
    }
}
