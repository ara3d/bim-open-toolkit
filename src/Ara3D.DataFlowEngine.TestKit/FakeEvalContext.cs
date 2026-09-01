using System.Collections.Generic;
using System.Threading;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>Non-run evaluation context that records warnings for assertion.</summary>
public sealed class FakeEvalContext : IEvalContext
{
    public bool IsRun => false;
    public CancellationToken Cancellation => CancellationToken.None;
    public List<string> Warnings { get; } = [];
    public void Warn(string message) => Warnings.Add(message);
}
