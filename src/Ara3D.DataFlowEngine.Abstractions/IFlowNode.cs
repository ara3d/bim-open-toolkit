using System.Collections.Generic;
using System.Threading;

namespace Ara3D.DataFlowEngine.Abstractions;

/// <summary>
/// What a node sees during evaluation. IsRun is true only inside an explicit Run;
/// Effect nodes are never invoked outside one.
/// </summary>
public interface IEvalContext
{
    bool IsRun { get; }
    CancellationToken Cancellation { get; }
    void Warn(string message);
}

/// <summary>
/// A stateless node implementation. One instance serves all evaluations;
/// outputs must be fully determined by (inputs, parameters).
/// </summary>
public interface IFlowNode
{
    NodeSpec Spec { get; }
    IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters);
}
