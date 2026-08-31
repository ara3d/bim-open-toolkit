using System;
using System.Security.Cryptography;

namespace Ara3D.NodeGraph;

/// <summary>
/// Graph identity: SHA-256 lowercase hex of the canonical serialization of the
/// {structure, values} subdocument (no trailing newline). Layout and session
/// never affect the hash.
/// </summary>
public static class GraphHash
{
    public static string ComputeGraphHash(this GraphDocument doc)
        => Convert.ToHexString(SHA256.HashData(
                GraphDocumentIO.Utf8NoBom.GetBytes(
                    CanonicalJson.ToCanonicalString(doc.ToJsonElement(includePresentation: false)))))
            .ToLowerInvariant();
}
