using System;

namespace Ara3D.NodeGraph;

/// <summary>
/// An edge endpoint "nodeId.port". Node ids contain no dot, so the first dot splits unambiguously.
/// </summary>
public readonly record struct PortRef(string NodeId, string Port)
{
    public override string ToString()
        => $"{NodeId}.{Port}";

    public static bool TryParse(string endpoint, out PortRef result)
    {
        result = default;
        var i = endpoint.IndexOf('.');
        if (i <= 0 || i >= endpoint.Length - 1)
            return false;
        result = new PortRef(endpoint[..i], endpoint[(i + 1)..]);
        return true;
    }

    public static PortRef Parse(string endpoint)
        => TryParse(endpoint, out var r)
            ? r
            : throw new ArgumentException($"Invalid edge endpoint '{endpoint}': expected 'nodeId.port'", nameof(endpoint));
}
