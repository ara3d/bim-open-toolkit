using System;
using System.Threading;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine;

internal sealed class EvalContext(bool isRun, CancellationToken cancellation, Action<string> warn) : IEvalContext
{
    public bool IsRun { get; } = isRun;
    public CancellationToken Cancellation { get; } = cancellation;

    public void Warn(string message)
        => warn(message);
}
