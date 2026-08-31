using System;
using System.Collections.Generic;
using System.Linq;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs;

/// <summary>
/// Freezes a completed evaluation into a run record (runs.md §1-2). The caller
/// supplies external input descriptors (the engine has no I/O), the engine
/// version, and the completion timestamp (passed in for determinism).
/// </summary>
public static class RunRecorder
{
    public static RunRecord Freeze(
        EvalSnapshot snapshot,
        INodeRegistry registry,
        IReadOnlyList<RunInput> inputs,
        string engineVersion,
        DateTimeOffset timestamp)
    {
        var doc = snapshot.Document;
        var connectedOutputs = doc.Edges.Select(e => e.From).ToHashSet();
        var nodeOutputs = new Dictionary<string, string>();
        var recordedOutputs = new Dictionary<string, FlowValue>();
        var effects = new List<EffectRecord>();

        foreach (var node in doc.Sort())
        {
            var result = snapshot.Results[node.Id];
            var spec = registry.Find(node.Kind, node.Version)!.Spec;
            if (result.Status == NodeStatus.Ok)
                for (var i = 0; i < spec.Outputs.Count; i++)
                {
                    var key = $"{node.Id}.{spec.Outputs[i].Name}";
                    nodeOutputs[key] = result.OutputHashes[i];
                    if (!connectedOutputs.Contains(key))
                        recordedOutputs[key] = result.Outputs[i];
                }
            if (spec.Capability == NodeCapability.Effect && Executed(result.Status))
                effects.Add(new(node.Id, ToEffectStatus(result.Status),
                    result.Status == NodeStatus.Error ? result.Error : null));
        }

        return new(
            doc.ComputeGraphHash(),
            engineVersion,
            RunTimestamp.Format(timestamp),
            SortInputs(inputs),
            nodeOutputs,
            recordedOutputs,
            effects,
            snapshot.Warnings);
    }

    public static IReadOnlyList<RunInput> SortInputs(IReadOnlyList<RunInput> inputs)
        => inputs
            .OrderBy(i => i.Node, StringComparer.Ordinal)
            .ThenBy(i => i.Param, StringComparer.Ordinal)
            .ToList();

    private static bool Executed(NodeStatus status)
        => status is NodeStatus.Ok or NodeStatus.Error;

    private static EffectStatus ToEffectStatus(NodeStatus status)
        => status == NodeStatus.Ok ? EffectStatus.Ok : EffectStatus.Failed;
}
