using System.Text.RegularExpressions;
using BimOpenFlow.Nodes.Relations;
using BimOpenFlow.Relations;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// The four structural checks TKT-85 asks for, run over one evaluated sample flow. Each
/// returns the node ids it flags; an empty list is a pass. These are heuristics over the
/// engine's own content hashes and row counts, not a rewrite of the node kinds' logic, so a
/// pack change never has to keep a second copy of what "no-op" means in step with the first.
/// </summary>
public static class Lint
{
    private static readonly string[] SortFilterLimitKinds =
        ["table.sort", "table.filter", "table.limit", "rel.sort", "rel.filter", "rel.limit"];

    private static readonly Regex UnresolvedPlaceholder = new("\\{[A-Z_]+\\}", RegexOptions.Compiled);

    /// <summary>A node with no edge at all (neither an input nor an output is wired), in a
    /// graph of more than one node: almost always a leftover from editing, since a graph with
    /// exactly one node has nothing to wire.</summary>
    public static IReadOnlyList<string> DisconnectedNodes(GraphDocument doc)
    {
        if (doc.Nodes.Count <= 1)
            return [];
        var wired = doc.Edges.SelectMany(e => new[] { e.FromRef.NodeId, e.ToRef.NodeId }).ToHashSet();
        return doc.Nodes.Select(n => n.Id).Where(id => !wired.Contains(id)).ToList();
    }

    /// <summary>A table.sort/filter/limit or rel.sort/filter/limit node whose single output
    /// carries the exact same content hash as its single input: per spec semantics, two
    /// values with equal hashes are equal, so the node did nothing to its input.</summary>
    public static IReadOnlyList<string> NoOpTransforms(GraphDocument doc, EvalSnapshot snapshot, INodeRegistry registry)
    {
        var edgeInto = doc.Edges.ToDictionary(e => e.ToRef, e => e.FromRef);
        var flagged = new List<string>();
        foreach (var node in doc.Nodes.Where(n => SortFilterLimitKinds.Contains(n.Kind)))
        {
            var result = snapshot.Results.GetValueOrDefault(node.Id);
            if (result is null || result.Status != NodeStatus.Ok || result.OutputHashes.Count == 0)
                continue;
            var spec = registry.Find(node.Kind, node.Version)?.Spec;
            var inputPort = spec is { Inputs.Count: > 0 } ? spec.Inputs[0].Name : null;
            if (inputPort is null || !edgeInto.TryGetValue(new PortRef(node.Id, inputPort), out var source))
                continue;
            var upstream = snapshot.Results.GetValueOrDefault(source.NodeId);
            if (upstream is null || upstream.Status != NodeStatus.Ok)
                continue;
            var upstreamSpec = registry.Find(doc.FindNode(source.NodeId)!.Kind, doc.FindNode(source.NodeId)!.Version)?.Spec;
            var outputIndex = upstreamSpec is null ? -1 : IndexOfOutput(upstreamSpec, source.Port);
            if (outputIndex < 0 || outputIndex >= upstream.OutputHashes.Count)
                continue;
            if (result.OutputHashes[0] == upstream.OutputHashes[outputIndex])
                flagged.Add(node.Id);
        }
        return flagged;
    }

    /// <summary>A node nothing downstream reads (no outgoing edge), all of whose table or
    /// relation outputs have zero rows: the flow's answer, materialized, is empty. A node with
    /// several outputs (e.g. chart.bar's table plus its legend) is only flagged when every one
    /// of them is empty, so an intentionally empty side output such as an unpopulated colour
    /// legend does not count as the flow's answer being empty.</summary>
    public static IReadOnlyList<string> EmptyFinalTables(GraphDocument doc, EvalSnapshot snapshot, RelationRuntime runtime)
    {
        var hasOutgoing = doc.Edges.Select(e => e.FromRef.NodeId).ToHashSet();
        var flagged = new List<string>();
        foreach (var node in doc.Nodes.Where(n => !hasOutgoing.Contains(n.Id)))
        {
            var result = snapshot.Results.GetValueOrDefault(node.Id);
            if (result is null || result.Status != NodeStatus.Ok)
                continue;
            var rowCounts = result.Outputs.Select(output => output switch
            {
                TableValue t => t.Table.Rows.Count,
                RelationValue { Payload: Plan plan } => runtime.Materialize(plan, 1).Rows.Count,
                _ => (int?)null,
            }).Where(rows => rows is not null).ToList();
            if (rowCounts.Count > 0 && rowCounts.All(rows => rows == 0))
                flagged.Add(node.Id);
        }
        return flagged;
    }

    /// <summary>A "{WORD}" placeholder still literally present in a parameter value after
    /// seeding rewrote paths: the profile named no target directory for it, so the node reads
    /// the literal placeholder text as a path. SampleSeeding already skips seeding such a
    /// graph (TKT-83), so this is a defensive re-check, not the primary catch.</summary>
    public static IReadOnlyList<string> UnresolvedPlaceholders(GraphDocument doc)
        => doc.Values
            .Where(node => node.Value.Values.Any(v => UnresolvedPlaceholder.IsMatch(v)))
            .Select(node => node.Key)
            .ToList();

    private static int IndexOfOutput(Ara3D.DataFlowEngine.Abstractions.NodeSpec spec, string port)
    {
        for (var i = 0; i < spec.Outputs.Count; i++)
            if (spec.Outputs[i].Name == port)
                return i;
        return -1;
    }
}
