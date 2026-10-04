// Enforces the seam between the generic graph tool (moving to ara3d/bim-open-flow, repository
// split phase 5) and the BIM projects that stay in the toolkit. The C# side is checked here;
// the web side is checked by two vitest files, named below so this suite indexes every rule.
using BimOpenFlow.NodeDocs;

namespace BimOpenToolkit.Layering.Tests;

public static class BimSeam
{
    /// <summary>The BIM node packs, and Ifc.Mesher, which only Geometry needs (native tessellation).</summary>
    public static readonly string[] BimOnly =
        ["BimOpenFlow.Nodes.Bos", "BimOpenFlow.Nodes.BimAnalysis", "BimOpenFlow.Nodes.Geometry", "Ara3D.Ifc.Mesher"];

    /// <summary>Projects under src/flow, src/mcp, tests/flow, and tests/mcp that stay in the toolkit,
    /// because they are or test the BIM packs, or read the toolkit's private samples.</summary>
    public static readonly string[] Stays =
    [
        "BimOpenFlow.Nodes.Bos", "BimOpenFlow.Nodes.BimAnalysis", "BimOpenFlow.Nodes.Geometry",
        "BimOpenFlow.Nodes.Bos.Tests", "BimOpenFlow.Nodes.BimAnalysis.Tests", "BimOpenFlow.Nodes.Geometry.Tests",
        "BimOpenFlow.PocParity.Tests", "BimOpenFlow.View3dWorkflows.Tests",
    ];

    /// <summary>The toolkit's test support; the projects that move use their copy, BimOpenFlow.TestSupport.</summary>
    public const string ToolkitTestSupport = "BimOpenToolkit.TestSupport";

    /// <summary>Projects under src/studio and tests/studio that move with flow.</summary>
    public static readonly string[] MovesFromStudio = ["BimOpenFlow.Ask", "BimOpenFlow.Ask.Tests"];

    static readonly string[] Folders = ["src/flow", "src/mcp", "tests/flow", "tests/mcp", "tests/BimOpenFlow.TestSupport"];

    static IEnumerable<FileInfo> ProjectsIn(string folder)
        => Layering.Projects(folder.Replace('/', Path.DirectorySeparatorChar));

    /// <summary>Every project under those folders, and the studio projects that move.</summary>
    public static IEnumerable<FileInfo> Candidates()
        => Folders.SelectMany(ProjectsIn)
            .Concat(ProjectsIn("src/studio").Concat(ProjectsIn("tests/studio"))
                .Where(p => MovesFromStudio.Contains(FlowLayering.NameOf(p.FullName))));

    /// <summary>The projects that move to bim-open-flow: the candidates less Stays.</summary>
    public static IEnumerable<FileInfo> Moves()
        => Candidates().Where(p => !Stays.Contains(FlowLayering.NameOf(p.FullName)));

    public static IEnumerable<string> Violations()
        => from project in Moves()
           from edge in Layering.References(project)
           let to = FlowLayering.NameOf(edge.To)
           let rel = Path.GetRelativePath(Layering.Root.FullName, edge.To).Replace('\\', '/')
           where BimOnly.Contains(to) || to == ToolkitTestSupport || (rel.StartsWith("src/studio/") || rel.StartsWith("tests/studio/")) && !MovesFromStudio.Contains(to)
           select $"{Path.GetRelativePath(Layering.Root.FullName, project.FullName)} -> {rel} (a project moving to bim-open-flow may reference no BIM pack, no Ifc.Mesher, nothing in studio, and BimOpenFlow.TestSupport rather than {ToolkitTestSupport})";
}

public class BimSeamTests
{
    [Test]
    public void ProjectsThatMoveToFlowReferenceNoBimPackAndNoStudio()
    {
        var violations = BimSeam.Violations().ToList();
        Assert.That(violations, Is.Empty, string.Join("\n", violations));
    }

    [Test]
    public void EveryNamedProjectExists()
    {
        var names = BimSeam.Candidates().Select(p => FlowLayering.NameOf(p.FullName)).ToHashSet();
        var missing = BimSeam.Stays.Concat(BimSeam.MovesFromStudio).Where(n => !names.Contains(n)).ToList();
        Assert.That(missing, Is.Empty, "named in BimSeam but not found: " + string.Join(", ", missing));
        Assert.That(BimSeam.Moves().Count(), Is.GreaterThan(40), "expected the flow extraction set to hold more than forty projects");
    }

    /// <summary>The generic node reference may carry notes only for kinds the generic packs
    /// register; a note for a bos.*, bim.*, or view3d.* kind belongs with the studio's BimNodeNotes.</summary>
    [Test]
    public void GenericNodeNotesNameOnlyGenericKinds()
    {
        var kinds = NodeDocsProgram.GenericPacks.SelectMany(p => p.Nodes).Select(n => n.Spec.Kind).ToHashSet();
        var strays = NodeNotes.Generic.Keys.Where(k => !kinds.Contains(k)).ToList();
        Assert.That(strays, Is.Empty, "notes for kinds no generic pack registers: " + string.Join(", ", strays));
    }

    /// <summary>The web rules live in vitest, beside the code they guard; this test fails if
    /// either file disappears or stops naming what it forbids.</summary>
    [TestCase("bimopenflow/web/packages/client/test/genericPackages.test.ts", "@bim-open-viewer/", "@bimopenflow/pane-3d")]
    [TestCase("bimopenflow/web/packages/bim-open-notebook/test/layering.test.ts", "@bim-open-viewer/", "@bimopenflow/pane-3d")]
    public void WebSeamsAreEnforcedByVitest(string file, string viewer, string pane)
    {
        var path = Path.Combine(Layering.Root.FullName, file);
        Assert.That(File.Exists(path), file);
        var text = File.ReadAllText(path);
        Assert.That(text, Does.Contain(viewer).And.Contain(pane));
    }
}
