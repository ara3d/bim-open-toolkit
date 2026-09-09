using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using BimOpenFlow.Mcp;

namespace BimOpenFlow.Studio;

/// <summary>The checks the host runs on a built graph after the agent says it is
/// done, independent of how careful the model was: every node Ok, an 'answer'
/// node present, and rows in its table. A finding goes back to the agent as one
/// more turn; nothing is edited on the agent's behalf.</summary>
public static class AskChecks
{
    public const string AnswerNode = "answer";

    /// <summary>Null when the graph passes; otherwise one sentence naming what is wrong.</summary>
    public static string? Verify(FlowServices services, string id)
    {
        if (!services.Host.Store.Exists(id))
            return null;
        var snapshot = services.Sessions.Snapshot(id);
        var doc = snapshot.Document;
        if (doc.Nodes.Count == 0)
            return "The graph has no nodes.";
        var broken = snapshot.Results.Values
            .Where(r => r.Status != NodeStatus.Ok)
            .OrderBy(r => r.NodeId, StringComparer.Ordinal)
            .Select(r => $"{r.NodeId} is {r.Status}{(string.IsNullOrEmpty(r.Error) ? "" : ": " + Clip(r.Error))}")
            .ToList();
        if (broken.Count > 0)
            return "Not every node evaluates: " + string.Join("; ", broken) + ".";
        var answer = doc.FindNode(AnswerNode);
        if (answer is null)
            return $"There is no node with the id '{AnswerNode}'; the final node must be called '{AnswerNode}'.";
        var spec = services.Host.Registry.Find(answer.Kind, answer.Version)?.Spec;
        var result = snapshot.Results.GetValueOrDefault(AnswerNode);
        var tableIndex = spec?.Outputs.ToList().FindIndex(o => o.Type == PortType.Table) ?? -1;
        if (spec is null || result is null || tableIndex < 0 || result.Outputs[tableIndex] is not TableValue table)
            return $"The '{AnswerNode}' node has no table output.";
        return table.Table.Rows.Count == 0
            ? $"The '{AnswerNode}' table has no rows. Rows along the way: {UpstreamRowCounts(services, snapshot)}. "
              + "Fix the step where the rows disappear (a filter, key or join), or explain why the answer is empty."
            : null;
    }

    /// <summary>Row counts of every table-producing node upstream of the answer,
    /// nearest last, so the agent can see where the data ran out.</summary>
    public static string UpstreamRowCounts(FlowServices services, EvalSnapshot snapshot)
    {
        var doc = snapshot.Document;
        var order = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        void Visit(string nodeId)
        {
            if (!seen.Add(nodeId))
                return;
            foreach (var edge in doc.Edges.Where(e => e.ToRef.NodeId == nodeId))
                Visit(edge.FromRef.NodeId);
            order.Add(nodeId);
        }
        Visit(AnswerNode);
        var parts = new List<string>();
        foreach (var nodeId in order)
        {
            var node = doc.FindNode(nodeId);
            var result = snapshot.Results.GetValueOrDefault(nodeId);
            if (node is null || result is null)
                continue;
            var spec = services.Host.Registry.Find(node.Kind, node.Version)?.Spec;
            var index = spec?.Outputs.ToList().FindIndex(o => o.Type == PortType.Table) ?? -1;
            if (index >= 0 && index < result.Outputs.Count && result.Outputs[index] is TableValue t)
                parts.Add($"{nodeId} {t.Table.Rows.Count} rows");
        }
        return parts.Count == 0 ? "no table outputs" : string.Join(" -> ", parts);
    }

    private static string Clip(string text)
        => text.Length <= 160 ? text : text[..160] + "…";
}
