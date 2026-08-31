using System;
using System.Collections.Generic;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>An IFlowNode from a spec and a lambda, for quick fakes in tests.</summary>
public sealed class DelegateNode(
    NodeSpec spec,
    Func<IEvalContext, IReadOnlyList<FlowValue>, ParamValues, IReadOnlyList<FlowValue>> eval) : IFlowNode
{
    public NodeSpec Spec { get; } = spec;

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => eval(context, inputs, parameters);
}
