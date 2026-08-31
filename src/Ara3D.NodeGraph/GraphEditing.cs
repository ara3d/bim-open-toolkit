using System;
using System.Collections.Generic;
using System.Linq;

namespace Ara3D.NodeGraph;

/// <summary>
/// Pure editing operations: each returns a new document, the input is never mutated.
/// </summary>
public static class GraphEditing
{
    public static GraphDocument AddNode(this GraphDocument doc, string id, string kind, int version)
        => doc.FindNode(id) is null
            ? doc with { Nodes = doc.Nodes.Append(new GraphNode(id, kind, version)).ToList() }
            : throw new ArgumentException($"Node id '{id}' already exists", nameof(id));

    /// <summary>Removes the node and everything that hangs off it: its edges, values, and layout.</summary>
    public static GraphDocument RemoveNode(this GraphDocument doc, string id)
        => doc.FindNode(id) is null
            ? throw new ArgumentException($"No node with id '{id}'", nameof(id))
            : doc with
            {
                Nodes = doc.Nodes.Where(n => n.Id != id).ToList(),
                Edges = doc.Edges.Where(e => e.FromRef.NodeId != id && e.ToRef.NodeId != id).ToList(),
                Values = doc.Values.Where(kv => kv.Key != id).ToDictionary(kv => kv.Key, kv => kv.Value),
                Layout = doc.Layout.Where(kv => kv.Key != id).ToDictionary(kv => kv.Key, kv => kv.Value),
            };

    /// <summary>
    /// Adds an edge from "nodeId.port" to "nodeId.port". An input port takes at most
    /// one edge, so any existing edge into the target port is replaced.
    /// </summary>
    public static GraphDocument Connect(this GraphDocument doc, string from, string to)
    {
        PortRef.Parse(from);
        PortRef.Parse(to);
        return doc with { Edges = doc.Edges.Where(e => e.To != to).Append(new GraphEdge(from, to)).ToList() };
    }

    public static GraphDocument Disconnect(this GraphDocument doc, string from, string to)
        => doc.Edges.Any(e => e.From == from && e.To == to)
            ? doc with { Edges = doc.Edges.Where(e => e.From != from || e.To != to).ToList() }
            : throw new ArgumentException($"No edge '{from}' -> '{to}'");

    public static GraphDocument SetParam(this GraphDocument doc, string nodeId, string name, string value)
        => doc.WithNodeParams(nodeId, parameters => Set(parameters, name, value));

    public static GraphDocument RemoveParam(this GraphDocument doc, string nodeId, string name)
        => doc.WithNodeParams(nodeId, parameters => Without(parameters, name));

    public static GraphDocument SetLayout(this GraphDocument doc, string nodeId, NodeLayout layout)
        => doc.FindNode(nodeId) is null
            ? throw new ArgumentException($"No node with id '{nodeId}'", nameof(nodeId))
            : doc with { Layout = Set(doc.Layout, nodeId, layout) };

    private static GraphDocument WithNodeParams(this GraphDocument doc, string nodeId,
        Func<IReadOnlyDictionary<string, string>, IReadOnlyDictionary<string, string>> change)
    {
        if (doc.FindNode(nodeId) is null)
            throw new ArgumentException($"No node with id '{nodeId}'", nameof(nodeId));
        var current = doc.Values.GetValueOrDefault(nodeId) ?? new Dictionary<string, string>();
        var changed = change(current);
        return doc with
        {
            Values = changed.Count == 0
                ? doc.Values.Where(kv => kv.Key != nodeId).ToDictionary(kv => kv.Key, kv => kv.Value)
                : Set(doc.Values, nodeId, changed),
        };
    }

    private static IReadOnlyDictionary<TK, TV> Set<TK, TV>(IReadOnlyDictionary<TK, TV> d, TK key, TV value)
        where TK : notnull
    {
        var copy = d.ToDictionary(kv => kv.Key, kv => kv.Value);
        copy[key] = value;
        return copy;
    }

    private static IReadOnlyDictionary<TK, TV> Without<TK, TV>(IReadOnlyDictionary<TK, TV> d, TK key)
        where TK : notnull
        => d.Where(kv => !kv.Key.Equals(key)).ToDictionary(kv => kv.Key, kv => kv.Value);
}
