using System.Collections.Generic;

namespace Ara3D.DataFlowEngine.Abstractions;

/// <summary>
/// Pure nodes may be evaluated freely and memoized; Effect nodes execute only inside an explicit Run.
/// </summary>
public enum NodeCapability
{
    Pure,
    Effect,
}

public sealed record NodeSpec(
    string Kind,
    int Version,
    NodeCapability Capability,
    IReadOnlyList<PortSpec> Inputs,
    IReadOnlyList<PortSpec> Outputs,
    IReadOnlyList<ParamSpec> Params,
    string Description = "");
