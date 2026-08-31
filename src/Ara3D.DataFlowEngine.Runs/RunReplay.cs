using System;
using System.Collections.Generic;
using System.Linq;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs;

public enum ReplayOutcome
{
    Ok,
    GraphMismatch,
    InputMismatch,
    OutputMismatch,
}

/// <summary>The verdict plus the first mismatch: (Node, Param) for input
/// mismatches, (Node, Port) for output mismatches.</summary>
public sealed record ReplayResult(
    ReplayOutcome Outcome,
    string? Node = null,
    string? Param = null,
    string? Port = null,
    string? Detail = null)
{
    public static readonly ReplayResult Success = new(ReplayOutcome.Ok);
}

/// <summary>
/// Replay per runs.md §4: refuse on graph or input hash mismatch, then
/// recompute effect-free and compare every output hash. The first divergence
/// is reported in dependency order, ties by node id.
/// </summary>
public static class RunReplay
{
    public static ReplayResult Replay(
        RunRecord record,
        GraphDocument doc,
        INodeRegistry registry,
        IReadOnlyList<RunInput> inputs)
        => CheckGraph(record, doc)
           ?? CheckInputs(record, inputs)
           ?? CheckOutputs(record, doc, registry)
           ?? ReplayResult.Success;

    private static ReplayResult? CheckGraph(RunRecord record, GraphDocument doc)
    {
        var hash = doc.ComputeGraphHash();
        return hash == record.GraphHash
            ? null
            : new(ReplayOutcome.GraphMismatch,
                Detail: $"Document hashes to {hash}; record pins {record.GraphHash}");
    }

    private static ReplayResult? CheckInputs(RunRecord record, IReadOnlyList<RunInput> inputs)
    {
        var provided = inputs.ToDictionary(i => (i.Node, i.Param), i => i.ContentHash);
        foreach (var pinned in RunRecorder.SortInputs(record.Inputs))
        {
            if (!provided.TryGetValue((pinned.Node, pinned.Param), out var hash))
                return new(ReplayOutcome.InputMismatch, pinned.Node, pinned.Param,
                    Detail: "No input provided for pinned entry");
            if (hash != pinned.ContentHash)
                return new(ReplayOutcome.InputMismatch, pinned.Node, pinned.Param,
                    Detail: $"Provided input hashes to {hash}; record pins {pinned.ContentHash}");
        }
        return null;
    }

    private static ReplayResult? CheckOutputs(RunRecord record, GraphDocument doc, INodeRegistry registry)
    {
        var snapshot = doc.Evaluate(registry);
        foreach (var node in doc.Sort())
        {
            var result = snapshot.Results[node.Id];
            // TODO: recompute Effect node outputs as pure functions (runs.md §4 step 3)
            // once the engine grows an effect-free Run recomputation; until then their
            // recorded hashes cannot be re-derived and are skipped.
            if (result.Status == NodeStatus.EffectPending)
                continue;
            var spec = registry.Find(node.Kind, node.Version)!.Spec;
            for (var i = 0; i < spec.Outputs.Count; i++)
            {
                var key = $"{node.Id}.{spec.Outputs[i].Name}";
                var recorded = record.NodeOutputs.GetValueOrDefault(key);
                var recomputed = result.Status == NodeStatus.Ok ? result.OutputHashes[i] : null;
                if (recorded != recomputed)
                    return new(ReplayOutcome.OutputMismatch, node.Id, Port: key,
                        Detail: $"Recorded {recorded ?? "nothing"}; recomputed {recomputed ?? "nothing"}");
            }
        }
        return null;
    }
}
