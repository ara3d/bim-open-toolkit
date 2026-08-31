using System.Linq;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>
/// Thin evaluation assertions over FlowTestSession. Value equality is by
/// ValueHash (spec semantics §1.1: equal iff hashes equal). Failures throw
/// FlowAssertionException.
/// </summary>
public static class EvalAssertions
{
    public static void AssertOutput(this FlowTestSession session, string nodeId, string port, FlowValue expected)
    {
        var actual = session.Output(nodeId, port);
        if (ValueHash.Compute(actual) != ValueHash.Compute(expected))
            throw new FlowAssertionException(
                $"Output '{nodeId}.{port}': expected {Describe(expected)}, got {Describe(actual)}");
    }

    public static void AssertOutput(this FlowTestSession session, string nodeId, string port, long expected)
        => session.AssertOutput(nodeId, port, new IntegerValue(expected));

    public static void AssertOutput(this FlowTestSession session, string nodeId, string port, double expected)
        => session.AssertOutput(nodeId, port, new NumberValue(expected));

    public static void AssertOutput(this FlowTestSession session, string nodeId, string port, string expected)
        => session.AssertOutput(nodeId, port, new TextValue(expected));

    public static void AssertOutput(this FlowTestSession session, string nodeId, string port, bool expected)
        => session.AssertOutput(nodeId, port, new BooleanValue(expected));

    public static void AssertStatus(this FlowTestSession session, string nodeId, NodeStatus expected)
    {
        var result = session.Result(nodeId);
        if (result.Status != expected)
            throw new FlowAssertionException(
                $"Node '{nodeId}': expected status {expected}, got {result.Status}"
                + (result.Error is { } e ? $" ({e})" : ""));
    }

    public static void AssertExecutionCount(this FlowTestSession session, string nodeId, int expected)
    {
        var actual = session.Result(nodeId).ExecutionCount;
        if (actual != expected)
            throw new FlowAssertionException(
                $"Node '{nodeId}': expected {expected} executions, got {actual}");
    }

    public static void AssertWarning(this FlowTestSession session, string nodeId, string expectedSubstring)
    {
        var warnings = session.Result(nodeId).Warnings;
        if (!warnings.Any(w => w.Contains(expectedSubstring)))
            throw new FlowAssertionException(
                $"Node '{nodeId}': no warning containing '{expectedSubstring}' in [{string.Join("; ", warnings)}]");
    }

    public static void AssertError(this FlowTestSession session, string nodeId, string expectedSubstring)
    {
        var result = session.Result(nodeId);
        if (result.Status != NodeStatus.Error || result.Error?.Contains(expectedSubstring) != true)
            throw new FlowAssertionException(
                $"Node '{nodeId}': expected an error containing '{expectedSubstring}', "
                + $"got status {result.Status} error '{result.Error}'");
    }

    private static string Describe(FlowValue value)
        => value switch
        {
            BooleanValue b => $"Boolean {(b.Value ? "true" : "false")}",
            IntegerValue i => $"Integer {i.Value}",
            NumberValue n => $"Number {n.Value:R}",
            TextValue t => $"Text \"{t.Value}\"",
            _ => $"{value.Kind} (hash {ValueHash.Compute(value)[..8]}…)",
        };
}
