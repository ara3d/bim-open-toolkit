using System.Linq;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>Entry point for the fluent builder: Graph.Node("c", "test.const", ("value", "42")).</summary>
public static class Graph
{
    public static GraphBuilder Node(string id, string kind, params (string Name, string Value)[] parameters)
        => GraphBuilder.Empty.Node(id, kind, parameters);

    public static GraphBuilder Node(string id, string kind, int version, params (string Name, string Value)[] parameters)
        => GraphBuilder.Empty.Node(id, kind, version, parameters);
}

/// <summary>
/// Immutable fluent wrapper over GraphEditing; every call returns a new builder.
/// Build() yields the accumulated GraphDocument.
/// </summary>
public sealed class GraphBuilder
{
    public static readonly GraphBuilder Empty = new(GraphDocument.Empty);

    private readonly GraphDocument _doc;

    private GraphBuilder(GraphDocument doc)
        => _doc = doc;

    public GraphBuilder Node(string id, string kind, params (string Name, string Value)[] parameters)
        => Node(id, kind, 1, parameters);

    public GraphBuilder Node(string id, string kind, int version, params (string Name, string Value)[] parameters)
        => new(parameters.Aggregate(
            _doc.AddNode(id, kind, version),
            (doc, p) => doc.SetParam(id, p.Name, p.Value)));

    public GraphBuilder Connect(string from, string to)
        => new(_doc.Connect(from, to));

    public GraphBuilder Param(string nodeId, string name, string value)
        => new(_doc.SetParam(nodeId, name, value));

    public GraphBuilder Layout(string nodeId, double x, double y)
        => new(_doc.SetLayout(nodeId, new NodeLayout(x, y)));

    public GraphDocument Build()
        => _doc;
}
