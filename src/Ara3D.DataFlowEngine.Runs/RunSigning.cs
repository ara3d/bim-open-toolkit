using System;

namespace Ara3D.DataFlowEngine.Runs;

// TODO: signing lands in a future runs.md minor version (§5): detached
// signatures over the canonical record bytes plus a record hash field.
// This is only the extension point; v0.1 ships no crypto.

/// <summary>Signs the canonical bytes of a run record; verification is the
/// counterpart a future evidence package consumes.</summary>
public interface IRunSigner
{
    byte[] Sign(ReadOnlySpan<byte> canonicalRecordBytes);
}
