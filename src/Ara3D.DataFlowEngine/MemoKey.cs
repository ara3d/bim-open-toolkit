using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;

namespace Ara3D.DataFlowEngine;

/// <summary>
/// The memo key per spec semantics §4: (kind, version, values-layer params,
/// (port name, value hash) per connected input port in name order). Encoded as
/// tagged bytes (text and integer encodings from ValueHash), hashed to lowercase
/// hex. Node id is deliberately absent: identical work shares one cache entry.
/// </summary>
public static class MemoKey
{
    public static string Compute(
        string kind,
        int version,
        IReadOnlyDictionary<string, string> parameters,
        IReadOnlyList<(string Port, string Hash)> inputs)
    {
        using var stream = new MemoryStream();
        using var writer = new BinaryWriter(stream);
        ValueHash.WriteText(writer, kind);
        writer.Write((long)version);
        writer.Write((long)parameters.Count);
        foreach (var kv in parameters.OrderBy(kv => kv.Key, StringComparer.Ordinal))
        {
            ValueHash.WriteText(writer, kv.Key);
            ValueHash.WriteText(writer, kv.Value);
        }
        writer.Write((long)inputs.Count);
        foreach (var (port, hash) in inputs.OrderBy(i => i.Port, StringComparer.Ordinal))
        {
            ValueHash.WriteText(writer, port);
            ValueHash.WriteText(writer, hash);
        }
        writer.Flush();
        return Convert.ToHexString(SHA256.HashData(stream.ToArray())).ToLowerInvariant();
    }
}
