using System.Globalization;
using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO.Bcf;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.Support;

namespace BimOpenFlow.Nodes.Bcf;

/// <summary>bcf.issue: a reviewer's comment, the elements it is about and a camera, as an issue
/// table that bcf.topics previews and bcf.write writes as a BCF topic with a viewpoint and a comment.</summary>
public sealed class BcfIssueNode : IFlowNode, ISchemaNode
{
    public const string Kind = "bcf.issue";

    /// <summary>Camera columns appended to the issue columns when a camera table is connected.</summary>
    public static readonly string[] CameraColumns =
    [
        "CameraX", "CameraY", "CameraZ", "DirectionX", "DirectionY", "DirectionZ",
        "UpX", "UpY", "UpZ", "FieldOfView", "AspectRatio",
    ];

    private const string CommentColumn = "Comment";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("camera", PortType.Table, Optional: true)],
        Outputs: [new PortSpec("issues", PortType.Table)],
        Params:
        [
            new ParamSpec("title", ParamKind.Text),
            new ParamSpec("description", ParamKind.Text),
            new ParamSpec("comment", ParamKind.Text),
            new ParamSpec("author", ParamKind.Text),
            new ParamSpec("created", ParamKind.Text),
            new ParamSpec("status", ParamKind.Text, "Open"),
            new ParamSpec("priority", ParamKind.Text),
            new ParamSpec("type", ParamKind.Text, "Issue"),
            new ParamSpec("ids", ParamKind.Text, List: true),
        ],
        "One reviewer's comment as an issue table: columns GlobalId, Title, Description, Status, Priority, "
        + "Type, Comment, CommentAuthor, CommentDate, Author, CreationDate, with one row per distinct GlobalId in 'ids' (the elements the "
        + "issue is about; one row with an empty GlobalId when there are none, a comment on the model as a "
        + "whole). Author and CreationDate belong to the topic; CommentAuthor and CommentDate to its comment, "
        + "and here carry the same values (the author and the time of creation). Wire a view3d.camera table into 'camera' and each row also carries the camera columns "
        + "CameraX..CameraZ, DirectionX..DirectionZ, UpX..UpZ, FieldOfView and AspectRatio, which bcf.write "
        + "turns into the topic's viewpoint (direction is target minus position, normalised; up is the z "
        + "axis made perpendicular to it; aspect ratio 1). The 3D pane's 'Comment' button adds this node "
        + "with its title, comment and author, the current selection in 'ids' and the time in 'created' "
        + "(UTC, yyyy-MM-ddTHH:mm:ssZ; the node reads no clock). 'title' is required. Wire the table into "
        + "bcf.topics to preview the topic and bcf.write to write the BCF file on Run.",
        Schemas: [SchemaSpec.Inferred("issues")]);

    public SchemaResult Infer(string output, IReadOnlyList<SchemaInput> inputs, ParamValues parameters, ISchemaCatalog catalog)
        => SchemaResult.Of(FixedColumns().Concat(inputs[0].Connected ? CameraKindColumns() : []).ToSchema());

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var title = parameters.RequiredText("title", Kind);
        var ids = parameters.GetText("ids").SplitNames().Distinct().ToList();
        if (ids.Count == 0)
            ids.Add("");
        var camera = inputs.Count > 0 && inputs[0] is TableValue t ? CameraValues(t.Table) : null;

        object?[] Repeat(string value) => [.. ids.Select(_ => (object?)value)];
        var b = new DataTableBuilder("issues");
        b.AddColumn(ids.Cast<object?>().ToArray(), IssueColumns.GlobalId, typeof(string));
        b.AddColumn(Repeat(title), IssueColumns.Title, typeof(string));
        b.AddColumn(Repeat(parameters.GetText("description")), IssueColumns.Description, typeof(string));
        b.AddColumn(Repeat(Or(parameters.GetText("status"), "Open")), IssueColumns.Status, typeof(string));
        b.AddColumn(Repeat(parameters.GetText("priority")), IssueColumns.Priority, typeof(string));
        b.AddColumn(Repeat(Or(parameters.GetText("type"), "Issue")), IssueColumns.Type, typeof(string));
        b.AddColumn(Repeat(parameters.GetText("comment")), CommentColumn, typeof(string));
        b.AddColumn(Repeat(parameters.GetText("author")), BcfColumnNames.CommentAuthor, typeof(string));
        b.AddColumn(Repeat(parameters.GetText("created")), BcfColumnNames.CommentDate, typeof(string));
        b.AddColumn(Repeat(parameters.GetText("author")), BcfColumnNames.Author, typeof(string));
        b.AddColumn(Repeat(parameters.GetText("created")), BcfColumnNames.CreationDate, typeof(string));
        if (camera is not null)
            for (var i = 0; i < CameraColumns.Length; i++)
                b.AddColumn(ids.Select(_ => (object?)camera[i]).ToArray(), CameraColumns[i], typeof(double));
        return [new TableValue(b.Build())];
    }

    private static string Or(string value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value;

    private static IEnumerable<KindColumn> FixedColumns()
        => [
            ColumnKinds.GlobalId, ColumnKinds.Title.NotNull(), ColumnKinds.Description, ColumnKinds.Status.NotNull(),
            ColumnKinds.Priority, ColumnKinds.Type.NotNull(),
            KindColumn.Plain(CommentColumn, ColumnType.Text, nullable: true),
            KindColumn.Plain(BcfColumnNames.CommentAuthor, ColumnType.Text, nullable: true),
            KindColumn.Plain(BcfColumnNames.CommentDate, ColumnType.Text, nullable: true),
            ColumnKinds.Author, ColumnKinds.CreationDate,
        ];

    private static IEnumerable<KindColumn> CameraKindColumns()
        => CameraColumns.Select(c => KindColumn.Plain(c, ColumnType.Number, nullable: false));

    /// <summary>The camera columns' values in <see cref="CameraColumns"/> order, from the first row of a
    /// view3d.camera table (posX..posZ, targetX..targetZ, optional fov defaulting to 60).</summary>
    private static double[] CameraValues(IDataTable table)
    {
        if (table.Rows.Count == 0)
            throw new ArgumentException($"{Kind}: the camera table has no rows.");
        double Cell(string name, double? fallback = null)
            => BcfIssues.Find(table, name) is { } column
                ? Convert.ToDouble(table[column, 0], CultureInfo.InvariantCulture)
                : fallback ?? throw new ArgumentException($"{Kind}: the camera table has no column named '{name}'.");

        double[] position = [Cell("posX"), Cell("posY"), Cell("posZ")];
        double[] target = [Cell("targetX"), Cell("targetY"), Cell("targetZ")];
        var direction = Normalize([target[0] - position[0], target[1] - position[1], target[2] - position[2]])
            ?? throw new ArgumentException($"{Kind}: the camera's position and target are the same point, so it has no direction.");
        return [.. position, .. direction, .. Up(direction), Cell("fov", 60), 1];
    }

    /// <summary>The z axis with its component along <paramref name="direction"/> removed, normalised;
    /// the y axis instead when the camera looks straight along z.</summary>
    private static double[] Up(double[] direction)
    {
        foreach (var axis in new[] { 2, 1 })
        {
            double[] v = [0, 0, 0];
            v[axis] = 1;
            for (var i = 0; i < 3; i++)
                v[i] -= direction[axis] * direction[i];
            if (Normalize(v, 1e-9) is { } up)
                return up;
        }
        throw new InvalidOperationException("A unit direction cannot be parallel to both z and y.");
    }

    private static double[]? Normalize(double[] v, double epsilon = 0)
    {
        var length = Math.Sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return length > epsilon ? [v[0] / length, v[1] / length, v[2] / length] : null;
    }
}
