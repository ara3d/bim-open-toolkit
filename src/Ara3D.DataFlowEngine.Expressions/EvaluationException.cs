namespace Ara3D.DataFlowEngine.Expressions;

/// <summary>
/// A deterministic runtime evaluation error: integer overflow, modulo by zero,
/// or round digits out of range. Distinct from parse/type errors, which are
/// collected as ExprError values before evaluation.
/// </summary>
public sealed class EvaluationException(string message) : Exception(message);
