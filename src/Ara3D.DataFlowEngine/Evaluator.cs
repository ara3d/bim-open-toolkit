using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine;

/// <summary>
/// One evaluation pass over a validated document. Pure nodes evaluate (or hit the
/// memo cache); Effect nodes are skipped with their would-be inputs captured.
/// Mutates only the memo cache and execution counts handed to it.
/// </summary>
internal static class Evaluator
{
    private static readonly IReadOnlyDictionary<string, string> EmptyParams = new Dictionary<string, string>();

    public static (Dictionary<string, NodeResult> Results, List<string> Warnings) Run(
        GraphDocument doc,
        INodeRegistry registry,
        MemoCache memo,
        Dictionary<string, int> counts,
        CancellationToken ct)
    {
        var flowNodes = doc.Nodes.ToDictionary(n => n.Id, n => registry.Find(n.Kind, n.Version)!);
        var edgeInto = doc.Edges.ToDictionary(e => e.To, e => e.FromRef);
        var results = new Dictionary<string, NodeResult>();
        var warnings = new List<string>();

        foreach (var node in doc.Sort())
        {
            ct.ThrowIfCancellationRequested();
            var result = EvaluateNode(node, flowNodes, doc, edgeInto, results, memo, counts, ct);
            results[node.Id] = result;
            foreach (var w in result.Warnings)
                warnings.Add($"{node.Id}: {w}");
        }
        return (results, warnings);
    }

    private static NodeResult EvaluateNode(
        GraphNode node,
        IReadOnlyDictionary<string, IFlowNode> flowNodes,
        GraphDocument doc,
        IReadOnlyDictionary<string, PortRef> edgeInto,
        IReadOnlyDictionary<string, NodeResult> results,
        MemoCache memo,
        Dictionary<string, int> counts,
        CancellationToken ct)
    {
        var flowNode = flowNodes[node.Id];
        var spec = flowNode.Spec;
        var inputs = new List<FlowValue>(spec.Inputs.Count);
        var inputHashes = new List<(string Port, string Hash)>(spec.Inputs.Count);
        var unready = false;
        string? unreadyOrigin = null;
        string? blocking = null;

        foreach (var port in spec.Inputs)
        {
            if (!edgeInto.TryGetValue($"{node.Id}.{port.Name}", out var source))
            {
                unready = true;
                continue;
            }
            var upstream = results[source.NodeId];
            switch (upstream.Status)
            {
                case NodeStatus.Ok:
                    var index = IndexOfOutput(flowNodes[source.NodeId].Spec, source.Port);
                    inputs.Add(upstream.Outputs[index]);
                    inputHashes.Add((port.Name, upstream.OutputHashes[index]));
                    break;
                case NodeStatus.Unready:
                    unready = true;
                    unreadyOrigin ??= upstream.BlockingNodeId ?? source.NodeId;
                    break;
                default:
                    blocking ??= upstream.BlockingNodeId ?? source.NodeId;
                    break;
            }
        }

        var count = counts.GetValueOrDefault(node.Id);
        if (blocking is not null)
            return new(node.Id, NodeStatus.Unavailable, NodeResult.NoValues, NodeResult.NoStrings,
                NodeResult.NoValues, NodeResult.NoStrings, BlockingNodeId: blocking, ExecutionCount: count);
        if (unready)
            return new(node.Id, NodeStatus.Unready, NodeResult.NoValues, NodeResult.NoStrings,
                NodeResult.NoValues, NodeResult.NoStrings, BlockingNodeId: unreadyOrigin, ExecutionCount: count);
        if (spec.Capability == NodeCapability.Effect)
            return new(node.Id, NodeStatus.EffectPending, NodeResult.NoValues, NodeResult.NoStrings,
                inputs, NodeResult.NoStrings, ExecutionCount: count);

        return EvaluatePure(node, flowNode, doc, inputs, inputHashes, memo, counts, ct);
    }

    private static NodeResult EvaluatePure(
        GraphNode node,
        IFlowNode flowNode,
        GraphDocument doc,
        IReadOnlyList<FlowValue> inputs,
        IReadOnlyList<(string Port, string Hash)> inputHashes,
        MemoCache memo,
        Dictionary<string, int> counts,
        CancellationToken ct)
    {
        var spec = flowNode.Spec;
        var parameters = doc.Values.GetValueOrDefault(node.Id) ?? EmptyParams;
        var key = MemoKey.Compute(node.Kind, node.Version, parameters, inputHashes);
        if (memo.TryGet(key, out var entry))
            return new(node.Id, NodeStatus.Ok, entry.Outputs, entry.OutputHashes,
                NodeResult.NoValues, entry.Warnings, ExecutionCount: counts.GetValueOrDefault(node.Id));

        var warnings = new List<string>();
        var context = new EvalContext(isRun: false, ct, warnings.Add);
        counts[node.Id] = counts.GetValueOrDefault(node.Id) + 1;
        try
        {
            var outputs = flowNode.Eval(context, inputs, new ParamValues(parameters));
            if (outputs.Count != spec.Outputs.Count)
                throw new InvalidOperationException(
                    $"Node returned {outputs.Count} outputs; spec declares {spec.Outputs.Count}");
            var hashes = outputs.Select(ValueHash.Compute).ToList();
            memo.Add(key, new(outputs, hashes, warnings));
            return new(node.Id, NodeStatus.Ok, outputs, hashes,
                NodeResult.NoValues, warnings, ExecutionCount: counts[node.Id]);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return new(node.Id, NodeStatus.Error, NodeResult.NoValues, NodeResult.NoStrings,
                NodeResult.NoValues, warnings, Error: $"{ex.GetType().Name}: {ex.Message}",
                BlockingNodeId: node.Id, ExecutionCount: counts[node.Id]);
        }
    }

    private static int IndexOfOutput(NodeSpec spec, string port)
    {
        for (var i = 0; i < spec.Outputs.Count; i++)
            if (spec.Outputs[i].Name == port)
                return i;
        throw new InvalidOperationException($"No output port '{port}' on kind '{spec.Kind}'");
    }
}
