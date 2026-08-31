using Ara3D.DataFlowEngine.Expressions.Parsing;
using Ara3D.DataFlowEngine.Expressions.Typing;

namespace Ara3D.DataFlowEngine.Expressions.Evaluation;

public static class Evaluator
{
    /// <summary>
    /// Evaluates a type-checked tree. The lookup resolves identifier names to
    /// scalar values or null (absent). Null propagates through every operator;
    /// overflow, modulo by zero, and out-of-range round digits throw
    /// EvaluationException deterministically.
    /// </summary>
    public static Scalar? Eval(this TypedExpr expr, Func<string, Scalar?> lookup)
        => Widen(EvalCore(expr, lookup), expr.Type);

    private static Scalar? Widen(Scalar? value, ScalarType? type)
        => type == ScalarType.Number && value is IntegerScalar i ? new NumberScalar(i.Value) : value;

    private static Scalar? EvalCore(TypedExpr expr, Func<string, Scalar?> lookup)
        => expr switch
        {
            TypedLiteral lit => lit.Value,
            TypedIdentifier id => lookup(id.Name),
            TypedUnary u => EvalUnary(u, lookup),
            TypedBinary b => EvalBinary(b, lookup),
            TypedConditional c => EvalConditional(c, lookup),
            TypedCall c => BuiltinEvaluator.EvalCall(c, lookup),
            _ => throw new EvaluationException($"Unknown node {expr.GetType().Name}"),
        };

    private static Scalar? EvalUnary(TypedUnary u, Func<string, Scalar?> lookup)
    {
        var operand = u.Operand.Eval(lookup);
        return operand == null ? null
            : u.Op == UnaryOp.Not ? new BooleanScalar(!operand.AsBool())
            : operand is IntegerScalar i ? new IntegerScalar(CheckedNegate(i.Value))
            : new NumberScalar(-operand.AsDouble());
    }

    private static long CheckedNegate(long value)
        => value == long.MinValue
            ? throw new EvaluationException("Integer overflow in unary '-'")
            : -value;

    private static Scalar? EvalConditional(TypedConditional c, Func<string, Scalar?> lookup)
    {
        var condition = c.Condition.Eval(lookup);
        return condition == null ? null
            : condition.AsBool() ? c.WhenTrue.Eval(lookup)
            : c.WhenFalse.Eval(lookup);
    }

    private static Scalar? EvalBinary(TypedBinary b, Func<string, Scalar?> lookup)
    {
        var left = b.Left.Eval(lookup);
        var right = b.Right.Eval(lookup);
        if (left == null || right == null)
            return null;
        return b.Op switch
        {
            BinaryOp.Add or BinaryOp.Sub or BinaryOp.Mul => EvalArithmetic(b, left, right),
            BinaryOp.Div => new NumberScalar(left.AsDouble() / right.AsDouble()),
            BinaryOp.Mod => EvalModulo(left, right),
            BinaryOp.Concat => new TextScalar(left.ToCanonicalText() + right.ToCanonicalText()),
            BinaryOp.Eq or BinaryOp.Ne => EvalEquality(b.Op, left, right),
            BinaryOp.Lt or BinaryOp.Le or BinaryOp.Gt or BinaryOp.Ge => EvalOrdering(b.Op, left, right),
            BinaryOp.And => new BooleanScalar(left.AsBool() && right.AsBool()),
            BinaryOp.Or => new BooleanScalar(left.AsBool() || right.AsBool()),
            _ => throw new EvaluationException($"Unknown operator {b.Op}"),
        };
    }

    private static Scalar EvalArithmetic(TypedBinary b, Scalar left, Scalar right)
    {
        if (left is IntegerScalar li && right is IntegerScalar ri)
        {
            try
            {
                return new IntegerScalar(b.Op switch
                {
                    BinaryOp.Add => checked(li.Value + ri.Value),
                    BinaryOp.Sub => checked(li.Value - ri.Value),
                    _ => checked(li.Value * ri.Value),
                });
            }
            catch (OverflowException)
            {
                throw new EvaluationException($"Integer overflow in '{b.Op.Text()}'");
            }
        }
        var x = left.AsDouble();
        var y = right.AsDouble();
        return new NumberScalar(b.Op switch
        {
            BinaryOp.Add => x + y,
            BinaryOp.Sub => x - y,
            _ => x * y,
        });
    }

    private static Scalar EvalModulo(Scalar left, Scalar right)
    {
        var y = right.AsLong();
        return y == 0 ? throw new EvaluationException("Modulo by zero")
            : y == -1 ? new IntegerScalar(0)
            : new IntegerScalar(left.AsLong() % y);
    }

    private static Scalar EvalEquality(BinaryOp op, Scalar left, Scalar right)
    {
        var equal = (left, right) switch
        {
            (IntegerScalar x, IntegerScalar y) => x.Value == y.Value,
            (BooleanScalar x, BooleanScalar y) => x.Value == y.Value,
            (TextScalar x, TextScalar y) => string.Equals(x.Value, y.Value, StringComparison.Ordinal),
            _ => left.AsDouble() == right.AsDouble(),
        };
        return new BooleanScalar(op == BinaryOp.Eq ? equal : !equal);
    }

    private static Scalar EvalOrdering(BinaryOp op, Scalar left, Scalar right)
    {
        if (left is TextScalar lt && right is TextScalar rt)
        {
            var cmp = ScalarOps.CompareCodePoints(lt.Value, rt.Value);
            return new BooleanScalar(op switch
            {
                BinaryOp.Lt => cmp < 0,
                BinaryOp.Le => cmp <= 0,
                BinaryOp.Gt => cmp > 0,
                _ => cmp >= 0,
            });
        }
        if (left is IntegerScalar li && right is IntegerScalar ri)
            return new BooleanScalar(op switch
            {
                BinaryOp.Lt => li.Value < ri.Value,
                BinaryOp.Le => li.Value <= ri.Value,
                BinaryOp.Gt => li.Value > ri.Value,
                _ => li.Value >= ri.Value,
            });
        var x = left.AsDouble();
        var y = right.AsDouble();
        return new BooleanScalar(op switch
        {
            BinaryOp.Lt => x < y,
            BinaryOp.Le => x <= y,
            BinaryOp.Gt => x > y,
            _ => x >= y,
        });
    }
}
