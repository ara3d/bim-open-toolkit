using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.BimOpenSchema.IO.Bcf;
using BimOpenFlow.Nodes.Bcf;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.Nodes.Bcf.Tests;

/// <summary>bcf.issue over in-memory camera tables; no graph.</summary>
[TestFixture]
public sealed class BcfIssueNodeTests
{
    private static readonly BcfIssueNode Node = new();

    private static readonly string[] IssueColumns =
        ["GlobalId", "Title", "Description", "Status", "Priority", "Type", "Comment", "CommentAuthor", "CommentDate", "Author", "CreationDate"];

    /// <summary>A view3d.camera row looking along +x from the origin, a little below the target.</summary>
    private static TableValue Camera(double fov = 60)
        => NodeTestHelpers.Table(
            ("name", typeof(string), ["review"]),
            ("posX", typeof(double), [0.0]), ("posY", typeof(double), [0.0]), ("posZ", typeof(double), [0.0]),
            ("targetX", typeof(double), [10.0]), ("targetY", typeof(double), [0.0]), ("targetZ", typeof(double), [0.0]),
            ("fov", typeof(double), [fov]));

    [Test]
    public void TwoIds_GiveTwoRowsWithTheFixedColumnsAndTheCamera()
    {
        var table = Node.EvalTable([Camera(45)],
            ("title", "Swap handle"), ("comment", "Wrong side"), ("author", "ana"),
            ("created", "2026-10-18T09:30:00Z"), ("ids", "d1,d2"));

        Assert.That(table.ColumnNames(), Is.EqualTo(IssueColumns.Concat(BcfIssueNode.CameraColumns)));
        Assert.That(table.ColumnCells("GlobalId"), Is.EqualTo(new object?[] { "d1", "d2" }));
        Assert.That(table.ColumnCells("Title"), Is.EqualTo(new object?[] { "Swap handle", "Swap handle" }));
        Assert.That(table.Cell("Status", 0), Is.EqualTo("Open"));
        Assert.That(table.Cell("Type", 1), Is.EqualTo("Issue"));
        Assert.That(table.Cell("Comment", 0), Is.EqualTo("Wrong side"));
        Assert.That(table.Cell("Author", 1), Is.EqualTo("ana"));
        Assert.That(table.Cell("CommentAuthor", 1), Is.EqualTo("ana"));
        Assert.That(table.Cell("CommentDate", 0), Is.EqualTo("2026-10-18T09:30:00Z"));
        Assert.That(table.Cell("CreationDate", 0), Is.EqualTo("2026-10-18T09:30:00Z"));
        Assert.That(table.Cell("DirectionX", 0), Is.EqualTo(1.0));
        Assert.That(table.Cell("UpZ", 1), Is.EqualTo(1.0));
        Assert.That(table.Cell("FieldOfView", 0), Is.EqualTo(45.0));
        Assert.That(table.Cell("AspectRatio", 0), Is.EqualTo(1.0));
    }

    [Test]
    public void Direction_IsUnitLength_AndUpIsPerpendicularToIt()
    {
        var camera = NodeTestHelpers.Table(
            ("posX", typeof(double), [1.0]), ("posY", typeof(double), [2.0]), ("posZ", typeof(double), [3.0]),
            ("targetX", typeof(double), [4.0]), ("targetY", typeof(double), [6.0]), ("targetZ", typeof(double), [3.0]));
        var table = Node.EvalTable([camera], ("title", "t"));

        double Get(string name) => (double)table.Cell(name, 0)!;
        double[] d = [Get("DirectionX"), Get("DirectionY"), Get("DirectionZ")];
        double[] up = [Get("UpX"), Get("UpY"), Get("UpZ")];
        Assert.That(d.Sum(c => c * c), Is.EqualTo(1.0).Within(1e-12));
        Assert.That(up.Sum(c => c * c), Is.EqualTo(1.0).Within(1e-12));
        Assert.That(d[0] * up[0] + d[1] * up[1] + d[2] * up[2], Is.Zero.Within(1e-12));
        Assert.That(Get("FieldOfView"), Is.EqualTo(60.0), "no fov column: the default");
    }

    [Test]
    public void LookingStraightDown_StillGivesAUnitUp()
    {
        var camera = NodeTestHelpers.Table(
            ("posX", typeof(double), [0.0]), ("posY", typeof(double), [0.0]), ("posZ", typeof(double), [5.0]),
            ("targetX", typeof(double), [0.0]), ("targetY", typeof(double), [0.0]), ("targetZ", typeof(double), [0.0]));
        var table = Node.EvalTable([camera], ("title", "t"));
        Assert.That(table.Cell("DirectionZ", 0), Is.EqualTo(-1.0));
        Assert.That(table.Cell("UpY", 0), Is.EqualTo(1.0));
    }

    [Test]
    public void NoIds_GiveOneRowWithAnEmptyGlobalId()
    {
        var table = Node.EvalTable([Camera()], ("title", "Model note"), ("ids", ",  ,"));
        Assert.That(table.Rows, Has.Count.EqualTo(1));
        Assert.That(table.Cell("GlobalId", 0), Is.EqualTo(""));
    }

    [Test]
    public void WithoutACamera_OnlyTheIssueColumnsAppear()
    {
        var table = Node.EvalTable([MissingValue.Instance], ("title", "t"), ("ids", "a,a"));
        Assert.That(table.ColumnNames(), Is.EqualTo(IssueColumns));
        Assert.That(table.Rows, Has.Count.EqualTo(1));
    }

    [Test]
    public void BlankTitle_IsAnErrorNamingTheParameter()
        => Assert.That(() => Node.EvalTable([Camera()], ("title", "  ")),
            Throws.ArgumentException.With.Message.Contains("'title'"));

    [Test]
    public void CoincidentPositionAndTarget_IsAnError()
    {
        var camera = NodeTestHelpers.Table(
            ("posX", typeof(double), [1.0]), ("posY", typeof(double), [1.0]), ("posZ", typeof(double), [1.0]),
            ("targetX", typeof(double), [1.0]), ("targetY", typeof(double), [1.0]), ("targetZ", typeof(double), [1.0]));
        Assert.That(() => Node.EvalTable([camera], ("title", "t")), Throws.ArgumentException.With.Message.Contains("no direction"));
    }

    [Test]
    public void TopicsPreview_GroupsTheRowsIntoOneTopic()
    {
        var issues = Node.EvalTable([Camera()], ("title", "Swap handle"), ("ids", "1aj$VJZFn2TxepZUBcKp$i,1s1jVhK8z0pgKYcr9jt781"));
        var topics = new BcfTopicsNode().EvalTable([new TableValue(issues)]);
        Assert.That(topics.Rows, Has.Count.EqualTo(1));
        Assert.That(topics.Cell("Elements", 0), Is.EqualTo(2L));
    }

    private sealed class RunContext : IEvalContext
    {
        public bool IsRun => true;
        public CancellationToken Cancellation => CancellationToken.None;
        public void Warn(string message) { }
    }

    [Test]
    public void IssueWithCameraAndComment_SurvivesWriteAndRead()
    {
        var model = Path.Combine(RepoPaths.Root, "deps", "bim-open-data", "samples", "public", "duplex.bos");
        if (!File.Exists(model))
            Assert.Ignore("deps/bim-open-data/samples/public/duplex.bos is not fetched");
        var folder = Path.Combine(Path.GetTempPath(), "bcf-issue-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            var camera = NodeTestHelpers.Table(
                ("posX", typeof(double), [1.0]), ("posY", typeof(double), [2.0]), ("posZ", typeof(double), [3.0]),
                ("targetX", typeof(double), [4.0]), ("targetY", typeof(double), [6.0]), ("targetZ", typeof(double), [3.0]),
                ("fov", typeof(double), [50.0]));
            var issues = Node.EvalTable([camera], ("title", "Swap handle"), ("comment", "Wrong side"),
                ("author", "ana"), ("created", "2026-10-18T09:30:00Z"),
                ("ids", "1aj$VJZFn2TxepZUBcKp$i,1s1jVhK8z0pgKYcr9jt781"));

            var path = Path.Combine(folder, "issue.bcf");
            new BcfWriteNode().Eval(new RunContext(), [new TableValue(issues)],
                NodeTestHelpers.Params(("path", path), ("model", model)));
            var read = new BcfReadNode().Eval(NodeTestHelpers.Ctx, [], NodeTestHelpers.Params(("path", path)));

            var table = ((TableValue)read[0]).Table;
            Assert.That(table.ColumnCells("GlobalId"), Is.EquivalentTo(new object?[] { "1aj$VJZFn2TxepZUBcKp$i", "1s1jVhK8z0pgKYcr9jt781" }));
            Assert.That((double)table.Cell("CameraX", 0)!, Is.EqualTo(1.0).Within(1e-5));
            Assert.That((double)table.Cell("CameraY", 0)!, Is.EqualTo(2.0).Within(1e-5));
            Assert.That((double)table.Cell("DirectionX", 0)!, Is.EqualTo(0.6).Within(1e-5));
            Assert.That((double)table.Cell("DirectionY", 0)!, Is.EqualTo(0.8).Within(1e-5));
            Assert.That((double)table.Cell("UpZ", 0)!, Is.EqualTo(1.0).Within(1e-5));
            Assert.That((double)table.Cell("FieldOfView", 0)!, Is.EqualTo(50.0).Within(1e-5));
            Assert.That((double)table.Cell("AspectRatio", 0)!, Is.EqualTo(1.0).Within(1e-5));

            var comments = ((TableValue)read[2]).Table;
            Assert.That(comments.Rows, Has.Count.EqualTo(1));
            Assert.That(comments.Cell("Comment", 0), Is.EqualTo("Wrong side"));
            Assert.That(comments.Cell("CommentAuthor", 0), Is.EqualTo("ana"));
            Assert.That(comments.Cell("Title", 0), Is.EqualTo("Swap handle"));
            Assert.That(comments.Cell("CommentDate", 0), Is.EqualTo("2026-10-18T09:30:00Z"));

            Assert.That(BcfReader.ReadFile(path).Topics[0].ModelFile, Is.EqualTo("duplex.bos"));
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }

    private static string Markup(string bcfPath)
    {
        using var zip = System.IO.Compression.ZipFile.OpenRead(bcfPath);
        using var reader = new StreamReader(zip.Entries.First(e => e.FullName.EndsWith("markup.bcf")).Open());
        return reader.ReadToEnd();
    }

    [Test]
    public void Write_WithCreated_IsByteIdenticalAcrossRuns_AndModelDateIsOptIn()
    {
        var model = Path.Combine(RepoPaths.Root, "deps", "bim-open-data", "samples", "public", "duplex.bos");
        if (!File.Exists(model))
            Assert.Ignore("deps/bim-open-data/samples/public/duplex.bos is not fetched");
        var folder = Path.Combine(Path.GetTempPath(), "bcf-stable-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            var issues = new TableValue(Node.EvalTable([], ("title", "Note"), ("ids", "1aj$VJZFn2TxepZUBcKp$i")));
            string Write(string name, params (string, string)[] extra)
            {
                var path = Path.Combine(folder, name);
                new BcfWriteNode().Eval(new RunContext(), [issues],
                    NodeTestHelpers.Params([("path", path), ("model", model), ("created", "2026-10-18T09:30:00Z"), ("guidSeed", "fixed"), .. extra]));
                return path;
            }

            var a = Write("a.bcf");
            Thread.Sleep(1100);
            var b = Write("b.bcf");
            Assert.That(File.ReadAllBytes(b), Is.EqualTo(File.ReadAllBytes(a)));
            Assert.That(Markup(a), Does.Not.Contain("<Date>"));
            Assert.That(Markup(a), Does.Contain("2026-10-18T09:30:00"));

            var dated = Write("c.bcf", ("modelDate", "2026-01-02T03:04:05Z"));
            Assert.That(Markup(dated), Does.Contain("2026-01-02T03:04:05"));
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }

    [TestCase("created", "yesterday")]
    [TestCase("modelDate", "2026-10-18 09:30")]
    public void Write_BadDateParam_IsAnErrorNamingTheParamAndForm(string param, string value)
        => Assert.That(() => new BcfWriteNode().Eval(new RunContext(),
                [new TableValue(Node.EvalTable([], ("title", "t")))],
                NodeTestHelpers.Params(("path", Path.Combine(Path.GetTempPath(), "never.bcf")), (param, value))),
            Throws.ArgumentException.With.Message.Contains($"'{param}'").And.Message.Contains("2026-10-18T09:30:00Z"));
}
