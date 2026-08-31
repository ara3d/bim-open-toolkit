using System;
using System.Collections.Generic;
using System.Linq;

namespace Ara3D.DataFlowEngine.Runs;

/// <summary>Internal-consistency checks per runs.md §3: every serialized value
/// must hash to its nodeOutputs entry, else the record is corrupt.</summary>
public static class RunRecordChecks
{
    /// <summary>The first recordedOutputs key whose value does not hash to the
    /// matching nodeOutputs entry (or has no entry), or null when consistent.</summary>
    public static string? FirstCorruptOutput(this RunRecord record)
    {
        foreach (var port in record.RecordedOutputs.Keys.OrderBy(k => k, StringComparer.Ordinal))
            if (record.NodeOutputs.GetValueOrDefault(port) != ValueHash.Compute(record.RecordedOutputs[port]))
                return port;
        return null;
    }
}
