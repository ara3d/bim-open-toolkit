using System;
using System.Collections.Generic;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine;

public enum NodeStatus
{
    /// <summary>Evaluated (directly or via memo); outputs and hashes are available.</summary>
    Ok,

    /// <summary>An input port has no edge, or an upstream node is unready. Not an error.</summary>
    Unready,

    /// <summary>Effect node outside a Run: inputs captured in EffectInputs, node not executed.</summary>
    EffectPending,

    /// <summary>An upstream node is in Error or EffectPending; BlockingNodeId names the origin.</summary>
    Unavailable,

    /// <summary>The node threw during Eval; Error carries the message.</summary>
    Error,
}

/// <summary>One node's state after an evaluation pass. Immutable snapshot data.</summary>
public sealed record NodeResult(
    string NodeId,
    NodeStatus Status,
    IReadOnlyList<FlowValue> Outputs,
    IReadOnlyList<string> OutputHashes,
    IReadOnlyList<FlowValue> EffectInputs,
    IReadOnlyList<string> Warnings,
    string? Error = null,
    string? BlockingNodeId = null,
    int ExecutionCount = 0)
{
    public static readonly IReadOnlyList<FlowValue> NoValues = Array.Empty<FlowValue>();
    public static readonly IReadOnlyList<string> NoStrings = Array.Empty<string>();
}

/// <summary>
/// A consistent view of one evaluation of one document state: every result comes
/// from the same pass. Warnings aggregate all node warnings as "nodeId: message".
/// </summary>
public sealed record EvalSnapshot(
    GraphDocument Document,
    IReadOnlyDictionary<string, NodeResult> Results,
    IReadOnlyList<string> Warnings);
