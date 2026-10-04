// Enforces that no dependency loops back: deps.json in the repository root and in every
// repository under deps/ (reached through links, nested ones included) may not pin
// bim-open-toolkit. A pin there would make the toolkit depend on itself through a sibling.
using System.Text.Json;

namespace BimOpenToolkit.Layering.Tests;

public static class DepsCycle
{
    public const string ToolkitName = "bim-open-toolkit";

    public static bool IsToolkitUrl(string url)
    {
        var trimmed = url.Trim().TrimEnd('/', '\\');
        if (trimmed.EndsWith(".git", StringComparison.OrdinalIgnoreCase)) trimmed = trimmed[..^4];
        return trimmed.EndsWith("/" + ToolkitName, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>The deps.json files of a repository folder and, recursively, of each folder under its deps/.</summary>
    public static IEnumerable<FileInfo> ManifestFiles(DirectoryInfo repo)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var pending = new Stack<DirectoryInfo>();
        pending.Push(repo);
        while (pending.Count > 0)
        {
            var dir = pending.Pop();
            // Resolve links so a junction back to an ancestor is visited once.
            var real = dir.ResolveLinkTarget(true)?.FullName ?? dir.FullName;
            if (!seen.Add(Path.GetFullPath(real))) continue;

            var manifest = new FileInfo(Path.Combine(dir.FullName, "deps.json"));
            if (manifest.Exists) yield return manifest;

            var deps = new DirectoryInfo(Path.Combine(dir.FullName, "deps"));
            if (deps.Exists)
                foreach (var child in deps.EnumerateDirectories()) pending.Push(child);
        }
    }

    public static IEnumerable<string> Violations(DirectoryInfo repo)
    {
        foreach (var file in ManifestFiles(repo))
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(file.FullName));
            if (doc.RootElement.ValueKind != JsonValueKind.Object) continue;
            foreach (var entry in doc.RootElement.EnumerateObject())
                if (entry.Value.ValueKind == JsonValueKind.Object
                    && entry.Value.TryGetProperty("url", out var url)
                    && url.ValueKind == JsonValueKind.String
                    && IsToolkitUrl(url.GetString()!))
                    yield return $"{file.FullName}: entry \"{entry.Name}\" pins {url.GetString()} (no dependency may loop back to {ToolkitName})";
        }
    }
}

public class DepsCycleTests
{
    [Test]
    public void NoDepsManifestPinsTheToolkit()
    {
        var violations = DepsCycle.Violations(Layering.Root).ToList();
        Assert.That(violations, Is.Empty, string.Join("\n", violations));
    }

    [Test]
    public void APlantedToolkitPinInANestedDepIsFound()
    {
        var root = Directory.CreateTempSubdirectory("deps-cycle-");
        try
        {
            File.WriteAllText(Path.Combine(root.FullName, "deps.json"),
                """{ "ok": { "url": "https://github.com/ara3d/bim-open-flow", "commit": "a" } }""");
            var nested = Directory.CreateDirectory(Path.Combine(root.FullName, "deps", "bim-open-flow"));
            File.WriteAllText(Path.Combine(nested.FullName, "deps.json"),
                """{ "back": { "url": "https://github.com/ara3d/BIM-Open-Toolkit.git", "commit": "b" } }""");

            var violations = DepsCycle.Violations(root).ToList();
            Assert.That(violations, Has.Count.EqualTo(1));
            Assert.That(violations[0], Does.Contain("back"));
        }
        finally { root.Delete(true); }
    }

    [TestCase("https://github.com/ara3d/bim-open-toolkit", true)]
    [TestCase("https://github.com/ara3d/bim-open-toolkit.git", true)]
    [TestCase("git@github.com:ara3d/BIM-Open-Toolkit.GIT", true)]
    [TestCase("https://github.com/ara3d/bim-open-flow", false)]
    [TestCase("https://github.com/ara3d/bim-open-toolkit-extras", false)]
    public void UrlMatchIgnoresCaseAndGitSuffix(string url, bool expected)
        => Assert.That(DepsCycle.IsToolkitUrl(url), Is.EqualTo(expected));
}
