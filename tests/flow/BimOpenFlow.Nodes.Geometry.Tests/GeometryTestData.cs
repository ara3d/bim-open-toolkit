using Ara3D.DataFlowEngine.Abstractions;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

/// <summary>Geometry-pack test fixture: the convention instances table.</summary>
internal static class GeometryTestData
{
    public static TableValue Instances(params long[] entityIds)
        => Table(
            ("instanceIndex", Enumerable.Range(0, entityIds.Length).Select(i => (long)i).ToArray()),
            ("entityId", entityIds));
}
