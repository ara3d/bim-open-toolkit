// Enforces the folder layering: references only point down (mcp -> flow -> data; studio on all;
// plugins, apps, and tools on data), and the viewer never depends on the flow web editor.
using System.Text.RegularExpressions;

namespace BimOpenToolkit.Layering.Tests;

public static class Layering
{
    public static readonly DirectoryInfo Root = FindRoot();

    /// <summary>Layers a project in the given group may reference, besides its own group and submodules.</summary>
    public static readonly IReadOnlyDictionary<string, string[]> Allowed = new Dictionary<string, string[]>
    {
        ["data"] = [],
        ["flow"] = ["data"],
        ["mcp"] = ["data", "flow"],
        ["studio"] = ["data", "flow", "mcp"],
        ["plugins"] = ["data"],
        ["apps"] = ["data"],
        ["tools"] = ["data"],
    };

    static DirectoryInfo FindRoot()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
            if (File.Exists(Path.Combine(d.FullName, "BimOpenToolkit.sln")))
                return d;
        throw new InvalidOperationException("BimOpenToolkit.sln not found above " + AppContext.BaseDirectory);
    }

    public static IEnumerable<FileInfo> Projects(string top)
        => new DirectoryInfo(Path.Combine(Root.FullName, top)).EnumerateFiles("*.csproj", SearchOption.AllDirectories)
            .Where(f => !f.FullName.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"));

    /// <summary>The group a repository-relative path belongs to: data, flow, mcp, studio, plugins, apps, tools, submodules.</summary>
    public static string GroupOf(string fullPath)
    {
        var rel = Path.GetRelativePath(Root.FullName, fullPath).Replace('\\', '/');
        var parts = rel.Split('/');
        return parts[0] switch
        {
            "src" or "tests" => parts[1],
            _ => parts[0],
        };
    }

    static readonly Regex ProjectRef = new(@"<ProjectReference\s+Include=""([^""]+)""", RegexOptions.Compiled);

    public static IEnumerable<(FileInfo From, string To)> References(FileInfo project)
    {
        var text = File.ReadAllText(project.FullName);
        foreach (Match m in ProjectRef.Matches(text))
        {
            var raw = m.Groups[1].Value;
            if (raw.StartsWith("$(")) continue;
            yield return (project, Path.GetFullPath(Path.Combine(project.DirectoryName!, raw.Replace('\\', Path.DirectorySeparatorChar))));
        }
    }

    public static IEnumerable<string> Violations()
    {
        foreach (var (group, allowed) in Allowed)
        {
            var top = group is "data" or "flow" or "mcp" or "studio" ? null : group;
            var projects = top != null
                ? Projects(top)
                : Projects("src").Concat(Projects("tests")).Where(p => GroupOf(p.FullName) == group);
            foreach (var project in projects)
                foreach (var (from, to) in References(project))
                {
                    var target = GroupOf(to);
                    if (target == group || target == "submodules" || allowed.Contains(target))
                        continue;
                    yield return $"{Path.GetRelativePath(Root.FullName, from.FullName)} -> {Path.GetRelativePath(Root.FullName, to)} ({group} may not reference {target})";
                }
        }
    }
}

public class LayeringTests
{
    [Test]
    public void ProjectReferencesOnlyPointDown()
    {
        var violations = Layering.Violations().ToList();
        Assert.That(violations, Is.Empty, string.Join("\n", violations));
    }

    [Test]
    public void FindsTheReferenceGraph()
    {
        var edges = Layering.Projects("src").Concat(Layering.Projects("tests")).SelectMany(Layering.References).Count();
        Assert.That(edges, Is.GreaterThan(100), "expected the src and tests projects to carry more than a hundred project references");
    }

    [Test]
    public void EveryGroupHasProjects()
    {
        foreach (var group in new[] { "data", "flow", "mcp", "studio" })
            Assert.That(Layering.Projects("src").Any(p => Layering.GroupOf(p.FullName) == group), $"src/{group} has no projects");
    }

    [Test]
    public void ViewerDoesNotDependOnTheFlowEditor()
    {
        var viewer = new DirectoryInfo(Path.Combine(Layering.Root.FullName, "viz", "packages"));
        var offenders = viewer.EnumerateFiles("package.json", SearchOption.AllDirectories)
            .Where(f => !f.FullName.Contains("node_modules"))
            .Where(f => File.ReadAllText(f.FullName).Contains("\"@bimopenflow/"))
            .Select(f => Path.GetRelativePath(Layering.Root.FullName, f.FullName))
            .ToList();
        Assert.That(offenders, Is.Empty, string.Join("\n", offenders));
    }
}
