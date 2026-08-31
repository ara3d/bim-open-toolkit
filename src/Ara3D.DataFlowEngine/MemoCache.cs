using System.Collections.Generic;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine;

internal sealed record MemoEntry(
    IReadOnlyList<FlowValue> Outputs,
    IReadOnlyList<string> OutputHashes,
    IReadOnlyList<string> Warnings);

/// <summary>Transient, unbounded cache of successful Pure evaluations, keyed by MemoKey.</summary>
internal sealed class MemoCache
{
    private readonly Dictionary<string, MemoEntry> _entries = new();

    public bool TryGet(string key, out MemoEntry entry)
        => _entries.TryGetValue(key, out entry!);

    public void Add(string key, MemoEntry entry)
        => _entries[key] = entry;
}
