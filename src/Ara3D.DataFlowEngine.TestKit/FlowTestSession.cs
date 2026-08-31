using System;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>
/// An EvalSession paired with its registry, so results and outputs resolve by
/// node id and port name. Defaults to the test.* vocabulary registry.
/// </summary>
public sealed class FlowTestSession
{
    public FlowTestSession(INodeRegistry? registry = null)
    {
        Registry = registry ?? TestNodes.Registry;
        Session = new EvalSession(Registry);
    }

    public INodeRegistry Registry { get; }
    public EvalSession Session { get; }

    public EvalSnapshot Snapshot
        => Session.Snapshot;

    public EvalSnapshot Evaluate(GraphDocument doc)
        => Session.SetDocument(doc);

    public EvalSnapshot Evaluate(Func<GraphDocument, GraphDocument> edit)
        => Session.UpdateDocument(edit);

    public NodeResult Result(string nodeId)
        => Snapshot.Results.TryGetValue(nodeId, out var result)
            ? result
            : throw new FlowAssertionException($"No result for node '{nodeId}': not in the evaluated document");

    /// <summary>The Ok output value on "nodeId" port "port"; throws if the node is not Ok or the port is unknown.</summary>
    public FlowValue Output(string nodeId, string port)
    {
        var result = Result(nodeId);
        if (result.Status != NodeStatus.Ok)
            throw new FlowAssertionException(
                $"Node '{nodeId}' has no outputs: status is {result.Status}"
                + (result.Error is { } e ? $" ({e})" : ""));
        return result.Outputs[OutputIndex(nodeId, port)];
    }

    public FlowValue Output(string endpoint)
    {
        var portRef = PortRef.Parse(endpoint);
        return Output(portRef.NodeId, portRef.Port);
    }

    private int OutputIndex(string nodeId, string port)
    {
        var node = Snapshot.Document.FindNode(nodeId)
            ?? throw new FlowAssertionException($"No node '{nodeId}' in the document");
        var spec = Registry.Find(node.Kind, node.Version)?.Spec
            ?? throw new FlowAssertionException($"Kind '{node.Kind}' v{node.Version} not in the registry");
        for (var i = 0; i < spec.Outputs.Count; i++)
            if (spec.Outputs[i].Name == port)
                return i;
        throw new FlowAssertionException($"Kind '{node.Kind}' has no output port '{port}'");
    }
}
