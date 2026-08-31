using System;
using System.Collections.Generic;
using System.Linq;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.NodeGraph;

public enum GraphErrorKind
{
    DuplicateNodeId,
    UnknownNodeKind,
    DanglingEdgeEndpoint,
    UnknownPort,
    PortTypeMismatch,
    MultipleEdgesIntoPort,
    Cycle,
}

/// <summary>Target is the offending node id, endpoint, or edge, as fits the kind.</summary>
public sealed record GraphError(GraphErrorKind Kind, string Target, string Message);

public static class GraphValidation
{
    /// <summary>
    /// Structural validation against a node registry. Returns all errors found;
    /// an empty list means the document is valid. Never throws.
    /// </summary>
    public static IReadOnlyList<GraphError> Validate(this GraphDocument doc, INodeRegistry registry)
    {
        var errors = new List<GraphError>();
        var specs = new Dictionary<string, NodeSpec>();

        foreach (var group in doc.Nodes.GroupBy(n => n.Id).Where(g => g.Count() > 1))
            errors.Add(new(GraphErrorKind.DuplicateNodeId, group.Key,
                $"Node id '{group.Key}' occurs {group.Count()} times"));

        foreach (var node in doc.Nodes)
        {
            var found = registry.Find(node.Kind, node.Version);
            if (found is null)
                errors.Add(new(GraphErrorKind.UnknownNodeKind, node.Id,
                    $"Node '{node.Id}' has unknown kind '{node.Kind}' version {node.Version}"));
            else
                specs[node.Id] = found.Spec;
        }

        foreach (var edge in doc.Edges)
        {
            var fromType = ResolvePort(doc, specs, edge.FromRef, isOutput: true, errors);
            var toType = ResolvePort(doc, specs, edge.ToRef, isOutput: false, errors);
            if (fromType is { } f && toType is { } t && !Compatible(f, t))
                errors.Add(new(GraphErrorKind.PortTypeMismatch, $"{edge.From} -> {edge.To}",
                    $"Edge '{edge.From}' ({f}) -> '{edge.To}' ({t}): incompatible port types"));
        }

        foreach (var group in doc.Edges.GroupBy(e => e.To).Where(g => g.Count() > 1))
            errors.Add(new(GraphErrorKind.MultipleEdgesIntoPort, group.Key,
                $"Input port '{group.Key}' has {group.Count()} incoming edges"));

        var cyclic = FindCyclicNodes(doc);
        if (cyclic.Count > 0)
            errors.Add(new(GraphErrorKind.Cycle, string.Join(", ", cyclic),
                $"Graph contains a cycle involving: {string.Join(", ", cyclic)}"));

        return errors;
    }

    /// <summary>Returns the port type, or null if it could not be resolved (an error was reported, or the kind is unknown).</summary>
    private static PortType? ResolvePort(GraphDocument doc, IReadOnlyDictionary<string, NodeSpec> specs,
        PortRef port, bool isOutput, List<GraphError> errors)
    {
        if (doc.FindNode(port.NodeId) is null)
        {
            errors.Add(new(GraphErrorKind.DanglingEdgeEndpoint, port.ToString(),
                $"Edge endpoint '{port}' references unknown node '{port.NodeId}'"));
            return null;
        }
        if (!specs.TryGetValue(port.NodeId, out var spec))
            return null;
        var ports = isOutput ? spec.Outputs : spec.Inputs;
        foreach (var p in ports)
            if (p.Name == port.Port)
                return p.Type;
        errors.Add(new(GraphErrorKind.UnknownPort, port.ToString(),
            $"Node '{port.NodeId}' (kind '{spec.Kind}') has no {(isOutput ? "output" : "input")} port '{port.Port}'"));
        return null;
    }

    private static bool Compatible(PortType from, PortType to)
        => from == PortType.Any || to == PortType.Any || to.Accepts(from.ToValueKind());

    private static ValueKind ToValueKind(this PortType type)
        => type switch
        {
            PortType.Boolean => ValueKind.Boolean,
            PortType.Integer => ValueKind.Integer,
            PortType.Number => ValueKind.Number,
            PortType.Text => ValueKind.Text,
            PortType.Table => ValueKind.Table,
            _ => throw new ArgumentOutOfRangeException(nameof(type)),
        };

    /// <summary>Kahn's algorithm over node ids; the ids left un-peeled participate in a cycle.</summary>
    private static IReadOnlyList<string> FindCyclicNodes(GraphDocument doc)
    {
        var ids = doc.Nodes.Select(n => n.Id).Distinct().ToList();
        var edges = doc.Edges
            .Select(e => (From: e.FromRef.NodeId, To: e.ToRef.NodeId))
            .Where(e => ids.Contains(e.From) && ids.Contains(e.To))
            .ToList();
        var inDegree = ids.ToDictionary(id => id, _ => 0);
        foreach (var e in edges)
            inDegree[e.To]++;
        var ready = new Queue<string>(ids.Where(id => inDegree[id] == 0));
        while (ready.Count > 0)
        {
            var id = ready.Dequeue();
            inDegree.Remove(id);
            foreach (var e in edges.Where(e => e.From == id))
                if (inDegree.ContainsKey(e.To) && --inDegree[e.To] == 0)
                    ready.Enqueue(e.To);
        }
        return inDegree.Keys.OrderBy(id => id, StringComparer.Ordinal).ToList();
    }
}
