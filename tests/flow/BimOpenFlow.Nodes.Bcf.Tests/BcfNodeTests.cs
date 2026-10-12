using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.Bcf;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.Nodes.Bcf.Tests;

/// <summary>bcf.topics, bcf.write and bcf.read over in-memory tables and a temporary folder; no
/// graph. The one model file used is bim-open-data's committed samples/public/duplex.bos, for the
/// viewpoint test, and its door GlobalIds are the ones the verdict table names.</summary>
[TestFixture]
public sealed class BcfNodeTests
{
    /// <summary>An Effect node runs only inside a Run; the TestKit's context says it is not one.</summary>
    private sealed class RunContext : IEvalContext
    {
        public bool IsRun => true;
        public CancellationToken Cancellation => CancellationToken.None;
        public List<string> Warnings { get; } = [];
        public void Warn(string message) => Warnings.Add(message);
    }

    private const string Door1 = "1aj$VJZFn2TxepZUBcKp$i", Door2 = "1s1jVhK8z0pgKYcr9jt781", Door3 = "1hOSvn6df7F8_7GcBWlRGQ";

    private string _folder = null!;

    [SetUp]
    public void CreateFolder()
    {
        _folder = Path.Combine(Path.GetTempPath(), "bcf-nodes-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_folder);
    }

    [TearDown]
    public void DeleteFolder()
        => Directory.Delete(_folder, recursive: true);

    /// <summary>The ids.check shape: PascalCase issue columns, two failing doors and one passing.</summary>
    private static TableValue Verdicts()
        => NodeTestHelpers.Table(
            (IssueColumns.GlobalId, typeof(string), [Door1, Door2, Door3]),
            (IssueColumns.CheckId, typeof(string), ["DC-W1", "DC-W1", "DC-W1"]),
            (IssueColumns.CheckTitle, typeof(string), ["Door leaf width at least 850 mm", "Door leaf width at least 850 mm", "Door leaf width at least 850 mm"]),
            (IssueColumns.Citation, typeof(string), ["NBC 2020 3.8.3.12", "NBC 2020 3.8.3.12", "NBC 2020 3.8.3.12"]),
            (IssueColumns.Verdict, typeof(string), ["Fail", "Fail", "Pass"]));

    /// <summary>The check.rule shape: the compliance pack's camelCase columns.</summary>
    private static TableValue CamelVerdicts()
        => NodeTestHelpers.Table(
            ("globalId", typeof(string), [Door1, Door2]),
            ("checkId", typeof(string), ["DC-W1", "DC-W1"]),
            ("checkTitle", typeof(string), ["Narrow doors", "Narrow doors"]),
            ("citation", typeof(string), ["NBC", "NBC"]),
            ("verdict", typeof(string), ["Fail", "Pass"]));

    private static TableValue Issues()
        => NodeTestHelpers.Table(
            (IssueColumns.GlobalId, typeof(string), [Door1, Door2, Door3]),
            (IssueColumns.Title, typeof(string), ["Swap handle", "Swap handle", "Missing tag"]),
            (IssueColumns.Priority, typeof(string), ["High", "High", "Low"]));

    [Test]
    public void Topics_VerdictTable_KeepsFailingRowsAndGroupsByCheckTitle()
    {
        var topics = new BcfTopicsNode().EvalTable([Verdicts()]);
        Assert.That(topics.ColumnNames(), Is.EqualTo(new[] { "Title", "Description", "Status", "Priority", "Type", "Elements", "GlobalIds", "AuthoringToolIds" }));
        Assert.That(topics.Rows, Has.Count.EqualTo(1));
        Assert.That(topics.Cell("Title", 0), Is.EqualTo("Door leaf width at least 850 mm"));
        Assert.That(topics.Cell("Description", 0), Is.EqualTo("NBC 2020 3.8.3.12"));
        Assert.That(topics.Cell("Elements", 0), Is.EqualTo(2L));
        Assert.That(topics.Cell("GlobalIds", 0), Is.EqualTo($"{Door1}, {Door2}"));
    }

    [Test]
    public void Topics_CamelCaseVerdictTable_Works()
    {
        var topics = new BcfTopicsNode().EvalTable([CamelVerdicts()]);
        Assert.That(topics.Cell("Title", 0), Is.EqualTo("Narrow doors"));
        Assert.That(topics.Cell("Elements", 0), Is.EqualTo(1L));
    }

    [Test]
    public void Topics_VerdictsParameter_SelectsWhichRowsCount()
    {
        Assert.That(new BcfTopicsNode().EvalTable([Verdicts()], ("verdicts", "Pass")).Cell("Elements", 0), Is.EqualTo(1L));
        Assert.That(new BcfTopicsNode().EvalTable([Verdicts()], ("verdicts", "")).Cell("Elements", 0), Is.EqualTo(3L));
        var (table, warnings) = new BcfTopicsNode().EvalWithWarnings([Verdicts()], ("verdicts", "InfoNotAvailable"));
        Assert.That(table.Rows, Is.Empty);
        Assert.That(warnings, Has.Exactly(1).Contains("no rows"));
    }

    [Test]
    public void Topics_IssueTable_OneTopicPerTitle()
    {
        var topics = new BcfTopicsNode().EvalTable([Issues()]);
        Assert.That(topics.ColumnCells("Title"), Is.EqualTo(new object?[] { "Swap handle", "Missing tag" }));
        Assert.That(topics.ColumnCells("Priority"), Is.EqualTo(new object?[] { "High", "Low" }));
        Assert.That(topics.ColumnCells("Elements"), Is.EqualTo(new object?[] { 2L, 1L }));
    }

    [Test]
    public void Topics_BadPreset_IsAnArgumentError()
        => Assert.That(() => new BcfTopicsNode().EvalTable([Issues()], ("preset", "nope")), Throws.ArgumentException);

    [Test]
    public void Write_OutsideARun_Refuses()
        => Assert.That(() => new BcfWriteNode().EvalTable([Verdicts()], ("path", Path.Combine(_folder, "x.bcf"))),
            Throws.InvalidOperationException);

    [Test]
    public void Write_InsideARun_WritesTheFile_AndReadReadsItBack()
    {
        var path = Path.Combine(_folder, "nested", "dc-w1.bcf");
        var summary = ((TableValue)new BcfWriteNode().Eval(new RunContext(), [Verdicts()],
            NodeTestHelpers.Params(("path", path), ("author", "tester")))[0]).Table;
        Assert.That(File.Exists(path));
        Assert.That(summary.ColumnNames(), Is.EqualTo(new[] { "path", "topics", "viewpoints", "elements", "elementsWithoutGeometry", "bytes", "sha256" }));
        Assert.That(summary.Cell("topics", 0), Is.EqualTo(1L));
        Assert.That(summary.Cell("viewpoints", 0), Is.EqualTo(0L), "no model, no camera, no viewpoint");
        Assert.That(summary.Cell("elements", 0), Is.EqualTo(2L));
        Assert.That(summary.Cell("bytes", 0), Is.EqualTo(new FileInfo(path).Length));
        Assert.That(((string)summary.Cell("sha256", 0)!).Length, Is.EqualTo(64));

        var outputs = new BcfReadNode().Eval(NodeTestHelpers.Ctx, [], NodeTestHelpers.Params(("path", path)));
        var issues = ((TableValue)outputs[0]).Table;
        var topics = ((TableValue)outputs[1]).Table;
        Assert.That(issues.ColumnCells("GlobalId"), Is.EquivalentTo(new object?[] { Door1, Door2 }));
        Assert.That(issues.ColumnCells("Title"), Has.All.EqualTo("Door leaf width at least 850 mm"));
        Assert.That(issues.Cell("Author", 0), Is.EqualTo("tester"));
        Assert.That(topics.Rows, Has.Count.EqualTo(1));
        Assert.That(topics.Cell("Elements", 0), Is.EqualTo(2L));
    }

    [Test]
    public void Write_WithTheModel_FramesAViewpointPerTopic()
    {
        var model = Path.Combine(RepoPaths.Root, "deps", "bim-open-data", "samples", "public", "duplex.bos");
        if (!File.Exists(model))
            Assert.Ignore("deps/bim-open-data/samples/public/duplex.bos is not fetched");
        var path = Path.Combine(_folder, "doors.bcf");
        var summary = ((TableValue)new BcfWriteNode().Eval(new RunContext(), [Issues()],
            NodeTestHelpers.Params(("path", path), ("model", model), ("guidSeed", "doors")))[0]).Table;
        Assert.That(summary.Cell("topics", 0), Is.EqualTo(2L));
        Assert.That(summary.Cell("viewpoints", 0), Is.EqualTo(2L));
        Assert.That(summary.Cell("elementsWithoutGeometry", 0), Is.EqualTo(0L));
        var issues = ((TableValue)new BcfReadNode().Eval(NodeTestHelpers.Ctx, [], NodeTestHelpers.Params(("path", path)))[0]).Table;
        Assert.That(issues.ColumnCells("GlobalId"), Is.EquivalentTo(new object?[] { Door1, Door2, Door3 }));
    }

    /// <summary>A hand-built BCF with one good topic (a GlobalId and a Revit UniqueId) and one
    /// whose viewpoint is not XML: the node warns, naming the entry, and outputs both topics.</summary>
    [Test]
    public void Read_ABadViewpoint_WarnsAndKeepsTheGoodTopics()
    {
        const string good = "00000000-0000-4000-8000-000000000001", broken = "00000000-0000-4000-8000-000000000002";
        const string revitId = "5a1b2c3d-0000-4000-8000-00000000abcd-0004a1f2";
        var path = Path.Combine(_folder, "colleague.bcf");
        using (var zip = System.IO.Compression.ZipFile.Open(path, System.IO.Compression.ZipArchiveMode.Create))
        {
            foreach (var (guid, title) in new[] { (good, "Swap handle"), (broken, "Broken view") })
                Add(zip, $"{guid}/markup.bcf", $"""
                    <Markup><Topic Guid="{guid}"><Title>{title}</Title>
                    <Viewpoints><ViewPoint Guid="{guid}"><Viewpoint>viewpoint.bcfv</Viewpoint></ViewPoint></Viewpoints>
                    </Topic></Markup>
                    """);
            Add(zip, $"{good}/viewpoint.bcfv", $"""
                <VisualizationInfo><Components><Selection>
                <Component IfcGuid="{Door1}" /><Component><AuthoringToolId>{revitId}</AuthoringToolId></Component>
                </Selection></Components></VisualizationInfo>
                """);
            Add(zip, $"{broken}/viewpoint.bcfv", "not <xml");
        }
        var context = new RunContext();
        var outputs = new BcfReadNode().Eval(context, [], NodeTestHelpers.Params(("path", path)));
        var issues = ((TableValue)outputs[0]).Table;
        var topics = ((TableValue)outputs[1]).Table;
        Assert.Multiple(() =>
        {
            Assert.That(context.Warnings, Has.Count.EqualTo(1));
            Assert.That(context.Warnings[0], Does.StartWith("bcf.read: ").And.Contains($"{broken}/viewpoint.bcfv"));
            Assert.That(issues.ColumnCells("Title"), Is.EqualTo(new object?[] { "Swap handle", "Swap handle", "Broken view" }));
            Assert.That(issues.ColumnCells("GlobalId"), Is.EqualTo(new object?[] { Door1, "", "" }));
            Assert.That(issues.ColumnCells("AuthoringToolId"), Is.EqualTo(new object?[] { "", revitId, "" }));
            Assert.That(topics.ColumnCells("Elements"), Is.EqualTo(new object?[] { 2L, 0L }));
            Assert.That(topics.ColumnCells("GlobalIds"), Is.EqualTo(new object?[] { Door1, "" }));
            Assert.That(topics.ColumnCells("AuthoringToolIds"), Is.EqualTo(new object?[] { revitId, "" }));
        });

        var written = Path.Combine(_folder, "again.bcf");
        new BcfWriteNode().Eval(new RunContext(), [new TableValue(issues)], NodeTestHelpers.Params(("path", written)));
        var again = ((TableValue)new BcfReadNode().Eval(NodeTestHelpers.Ctx, [], NodeTestHelpers.Params(("path", written)))[0]).Table;
        Assert.That(again.ColumnCells("GlobalId"), Has.Exactly(1).EqualTo(Door1), "read, written, and read again");
        Assert.That(again.ColumnCells("AuthoringToolId"), Has.Exactly(1).EqualTo(revitId), "read, written, and read again");
    }

    private static void Add(System.IO.Compression.ZipArchive zip, string name, string text)
    {
        using var entry = zip.CreateEntry(name).Open();
        entry.Write(System.Text.Encoding.UTF8.GetBytes(text));
    }

    [Test]
    public void Read_MissingFile_IsAnError()
        => Assert.That(() => new BcfReadNode().Eval(NodeTestHelpers.Ctx, [], NodeTestHelpers.Params(("path", Path.Combine(_folder, "none.bcf")))),
            Throws.TypeOf<FileNotFoundException>());

    [Test]
    public void Pack_ListsTheThreeNodes_WriteIsTheOnlyEffect()
    {
        Assert.That(BcfNodes.All.Select(n => n.Spec.Kind), Is.EqualTo(new[] { "bcf.topics", "bcf.write", "bcf.read" }));
        Assert.That(BcfNodes.All.Single(n => n.Spec.Capability == NodeCapability.Effect).Spec.Kind, Is.EqualTo("bcf.write"));
    }
}
