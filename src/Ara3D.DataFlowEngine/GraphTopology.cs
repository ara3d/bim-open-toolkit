using System;
using System.Collections.Generic;
using System.Linq;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine;

public static class GraphTopology
{
    /// <summary>
    /// Topological order over a validated (acyclic) document; ties broken by
    /// node id ascending by Unicode code point, per spec semantics §3.
    /// </summary>
    public static IReadOnlyList<GraphNode> Sort(this GraphDocument doc)
    {
        var byId = doc.Nodes.ToDictionary(n => n.Id);
        var inDegree = doc.Nodes.ToDictionary(n => n.Id, _ => 0);
        var downstream = doc.Nodes.ToDictionary(n => n.Id, _ => new List<string>());
        foreach (var edge in doc.Edges)
        {
            downstream[edge.FromRef.NodeId].Add(edge.ToRef.NodeId);
            inDegree[edge.ToRef.NodeId]++;
        }
        var ready = new SortedSet<string>(
            doc.Nodes.Where(n => inDegree[n.Id] == 0).Select(n => n.Id),
            StringComparer.Ordinal);
        var order = new List<GraphNode>(doc.Nodes.Count);
        while (ready.Count > 0)
        {
            var id = ready.Min!;
            ready.Remove(id);
            order.Add(byId[id]);
            foreach (var next in downstream[id])
                if (--inDegree[next] == 0)
                    ready.Add(next);
        }
        return order.Count == doc.Nodes.Count
            ? order
            : throw new InvalidOperationException("Graph contains a cycle; validate before evaluating");
    }
}
