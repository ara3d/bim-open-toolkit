using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Ara3D.NodeGraph;

public sealed record GraphNode(string Id, string Kind, int Version)
{
    public string Id { get; } = Id.Length > 0 && !Id.Contains('.')
        ? Id
        : throw new ArgumentException($"Invalid node id '{Id}': must be non-empty and contain no dot", nameof(Id));
}

public sealed record GraphEdge(string From, string To)
{
    public PortRef FromRef { get; } = PortRef.Parse(From);
    public PortRef ToRef { get; } = PortRef.Parse(To);
}

public sealed record NodeLayout(double X, double Y, double? W = null, double? H = null);

/// <summary>
/// An immutable dataflow graph document: four layers per the frozen format.
/// Structure and Values fully determine evaluation; Layout and Session are presentation only.
/// Equality is semantic: two documents are equal iff their canonical serializations match.
/// </summary>
public sealed record GraphDocument(
    IReadOnlyList<GraphNode> Nodes,
    IReadOnlyList<GraphEdge> Edges,
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Values,
    IReadOnlyDictionary<string, NodeLayout> Layout,
    JsonElement? Session = null)
{
    public static readonly GraphDocument Empty = new(
        Array.Empty<GraphNode>(),
        Array.Empty<GraphEdge>(),
        new Dictionary<string, IReadOnlyDictionary<string, string>>(),
        new Dictionary<string, NodeLayout>());

    public GraphNode? FindNode(string id)
        => Nodes.FirstOrDefault(n => n.Id == id);

    public bool Equals(GraphDocument? other)
        => other is not null && this.ToCanonicalJson() == other.ToCanonicalJson();

    public override int GetHashCode()
        => this.ToCanonicalJson().GetHashCode();
}
