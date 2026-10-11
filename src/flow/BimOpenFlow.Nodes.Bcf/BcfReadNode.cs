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
        + "Priority, Type, TopicGuid, Author, CreationDate; one row per topic and selected element, "
        + "with an empty GlobalId for a topic that selects nothing) and a topics table (one row per "
        + "topic with its element count). The issues table joins to a model on GlobalId, so view3d.color "
        + "can colour the elements a colleague flagged.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var path = parameters.RequiredText("path", Kind);
        if (!File.Exists(path))
            throw new FileNotFoundException($"{Kind}: BCF file not found: {path}", path);
        var topics = BcfReader.ReadFile(path);
        var issues = topics.Select(t => new BcfIssue(t.Title, t.GlobalIds, t.Description, t.Status, t.Priority, t.Type)).ToList();
        return [new TableValue(topics.ToTable("issues")), new TableValue(BcfIssues.TopicsTable(issues, "topics"))];
    }
}
