using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO.Bcf;
using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Bcf;

/// <summary>bcf.read: a BCF file (a colleague's comments, or one bcf.write made) back into an
/// issues table, one row per topic and element, plus one row per topic.</summary>
public sealed class BcfReadNode : IFlowNode
{
    public const string Kind = "bcf.read";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs:
        [
            new PortSpec("issues", PortType.Table),
            new PortSpec("topics", PortType.Table),
        ],
        Params: [new ParamSpec("path", ParamKind.FilePath, Bindable: PortType.Text, Suggest: SuggestSource.FilesWith(".bcf"))],
        "Reads a BCF 3.0 (or 2.1) file into an issues table (GlobalId, Title, Description, Status, "
        + "Priority, Type, TopicGuid, Author, CreationDate, AuthoringToolId; one row per topic and "
        + "selected element, with both ids empty for a topic that selects nothing) and a topics table "
        + "(one row per topic with its element count). A component BCF names only by AuthoringToolId "
        + "(a Revit UniqueId, say) has its id in AuthoringToolId and an empty GlobalId. The issues "
        + "table joins to a model on GlobalId, so view3d.color can colour the elements a colleague "
        + "flagged. A viewpoint or markup that cannot be read, or a viewpoint missing from the file, "
        + "is skipped with a warning; the other topics still come through.",
        Schemas:
        [
            KindSchemas.Static("issues",
                ColumnKinds.GlobalId, ColumnKinds.Title, ColumnKinds.Description, ColumnKinds.Status,
                ColumnKinds.Priority, ColumnKinds.Type, ColumnKinds.TopicGuid, ColumnKinds.Author,
                ColumnKinds.CreationDate, ColumnKinds.AuthoringToolId),
            BcfIssues.TopicsSchema("topics"),
        ]);

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var path = parameters.RequiredText("path", Kind);
        if (!File.Exists(path))
            throw new FileNotFoundException($"{Kind}: BCF file not found: {path}", path);
        var contents = BcfReader.ReadFile(path);
        foreach (var warning in contents.Warnings)
            context.Warn($"{Kind}: {warning}");
        var issues = contents.Topics
            .Select(t => new BcfIssue(t.Title, [.. t.GlobalIds, .. t.AuthoringToolIds], t.Description, t.Status, t.Priority, t.Type))
            .ToList();
        return [new TableValue(contents.Topics.ToTable("issues")), new TableValue(BcfIssues.TopicsTable(issues, "topics"))];
    }
}
