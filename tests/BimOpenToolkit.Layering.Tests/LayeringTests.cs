// Enforces the folder layering: references only point down (mcp -> flow -> data; studio on all;
// plugins and tools on data), and the viewer never depends on the flow web editor. The data
// layer is the bim-open-data repository, reached through deps/ ($(DepsRoot)bim-open-data/...);
// the generic flow, mcp, and Ask projects are bim-open-flow's ($(DepsRoot)bim-open-flow/...),
// whose folders keep the group names they had here.
using System.Text.RegularExpressions;
using BimOpenToolkit.TestSupport;

namespace BimOpenToolkit.Layering.Tests;

public static class Layering
{
    public static readonly DirectoryInfo Root = new(RepoPaths.Root);

    /// <summary>tests/BimOpenToolkit.TestSupport: paths and fixtures only, no src reference,
    /// so every test group may reference it (checked by TestSupportReferencesNoSourceProject).</summary>
    public static readonly string[] TestSupport = ["BimOpenToolkit.TestSupport"];

    /// <summary>Layers a project in the given group may reference, besides its own group and
    /// external dependencies (deps/ other than bim-open-data's and bim-open-flow's layers).</summary>
    public static readonly IReadOnlyDictionary<string, string[]> Allowed = new Dictionary<string, string[]>
    {
        ["flow"] = ["data"],
        ["mcp"] = ["data", "flow"],
        ["studio"] = ["data", "flow", "mcp"],
        ["plugins"] = ["data"],
        ["tools"] = ["data"],
    };

    /// <summary>The group of anything outside this repository's own layers.</summary>
    public const string External = "external";

    /// <summary>The MSBuild property every reference into deps/ starts with (Directory.Build.props).</summary>
    public const string DepsRootProperty = "$(DepsRoot)";

    public static IEnumerable<FileInfo> Projects(string top)
        => new DirectoryInfo(Path.Combine(Root.FullName, top)).EnumerateFiles("*.csproj", SearchOption.AllDirectories)
            .Where(f => !f.FullName.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"));

    /// <summary>The group a repository-relative path belongs to: data (bim-open-data's src/data, through
    /// deps/), flow, mcp, or studio (here or bim-open-flow's src/ and tests/, through deps/),
    /// plugins, tools, or external.</summary>
    public static string GroupOf(string fullPath)
    {
        var rel = Path.GetRelativePath(Root.FullName, fullPath).Replace('\\', '/');
        var parts = rel.Split('/');
        return parts[0] switch
        {
            "deps" when parts.Length > 3 && parts[1] == "bim-open-data" && parts[2] == "src" => parts[3],
            "deps" when parts.Length > 3 && parts[1] == "bim-open-flow" && parts[2] is "src" or "tests" => parts[3],
            "deps" => External,
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
            var raw = m.Groups[1].Value.Replace('\\', Path.DirectorySeparatorChar);
            if (raw.StartsWith(DepsRootProperty))
                yield return (project, Path.GetFullPath(Path.Combine(Root.FullName, "deps", raw[DepsRootProperty.Length..])));
            else if (!raw.StartsWith("$("))
                yield return (project, Path.GetFullPath(Path.Combine(project.DirectoryName!, raw)));
        }
    }

    public static IEnumerable<string> Violations()
    {
        foreach (var (group, allowed) in Allowed)
        {
            var top = group is "flow" or "mcp" or "studio" ? null : group;
            var projects = top != null
                ? Projects(top)
                : Projects("src").Concat(Projects("tests")).Where(p => GroupOf(p.FullName) == group);
            foreach (var project in projects)
                foreach (var (from, to) in References(project))
                {
                    var target = GroupOf(to);
                    if (target == group || target == External || TestSupport.Contains(target) || allowed.Contains(target))
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
        Assert.That(edges, Is.GreaterThan(50), "expected the src and tests projects to carry more than fifty project references");
    }

    /// <summary>src/mcp is empty here since BimOpenMcp.Flow moved to bim-open-flow.</summary>
    [Test]
    public void EveryGroupHasProjects()
    {
        foreach (var group in new[] { "flow", "studio" })
            Assert.That(Layering.Projects("src").Any(p => Layering.GroupOf(p.FullName) == group), $"src/{group} has no projects");
    }

    /// <summary>A reference into bim-open-flow lands in the group its folder names, so the
    /// studio's references to the host and the BIM packs' to Nodes.Support are checked.</summary>
    [Test]
    public void FlowDependencyMapsToItsGroups()
    {
        var targets = Layering.Projects("src").SelectMany(Layering.References)
            .Where(r => Path.GetRelativePath(Layering.Root.FullName, r.To).Replace('\\', '/').StartsWith("deps/bim-open-flow/"))
            .Select(r => Layering.GroupOf(r.To))
            .ToHashSet();
        Assert.That(targets, Is.SupersetOf(new[] { "flow", "mcp", "studio" }));
    }

    [Test]
    public void TestSupportReferencesNoSourceProject()
    {
        var targets = Layering.TestSupport.SelectMany(t => Layering.Projects(Path.Combine("tests", t)))
            .SelectMany(Layering.References)
            .Select(r => Path.GetRelativePath(Layering.Root.FullName, r.To))
            .ToList();
        Assert.That(targets, Is.Empty, "TestSupport is referenceable from every group only because it references nothing: " + string.Join("\n", targets));
    }

    [Test]
    public void ViewerDoesNotDependOnTheFlowEditor()
    {
        var viewer = new DirectoryInfo(Path.Combine(Layering.Root.FullName, "deps", "bim-open-viewer", "packages"));
        var offenders = viewer.EnumerateFiles("package.json", SearchOption.AllDirectories)
            .Where(f => !f.FullName.Contains("node_modules"))
            .Where(f => File.ReadAllText(f.FullName).Contains("\"@bimopenflow/"))
            .Select(f => Path.GetRelativePath(Layering.Root.FullName, f.FullName))
            .ToList();
        Assert.That(offenders, Is.Empty, string.Join("\n", offenders));
    }
}
