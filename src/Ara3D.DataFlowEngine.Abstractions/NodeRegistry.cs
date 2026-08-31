using System;
using System.Collections.Generic;
using System.Linq;

namespace Ara3D.DataFlowEngine.Abstractions;

public interface INodeRegistry
{
    IReadOnlyList<IFlowNode> Nodes { get; }
    IFlowNode? Find(string kind, int version);
}

public sealed class NodeRegistry : INodeRegistry
{
    private readonly Dictionary<(string, int), IFlowNode> _nodes;

    public NodeRegistry(IReadOnlyList<IFlowNode> nodes)
        => _nodes = nodes.ToDictionary(n => (n.Spec.Kind, n.Spec.Version), n => n);

    public IReadOnlyList<IFlowNode> Nodes
        => _nodes.Values.ToList();

    public IFlowNode? Find(string kind, int version)
        => _nodes.GetValueOrDefault((kind, version));

    public static NodeRegistry Combine(params IReadOnlyList<IFlowNode>[] packs)
        => new(packs.SelectMany(p => p).ToList());
}
