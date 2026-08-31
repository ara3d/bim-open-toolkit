using Ara3D.DataFlowEngine.Expressions.Parsing;

namespace Ara3D.DataFlowEngine.Expressions.Typing;

public static class TypeChecker
{
    /// <summary>
    /// Type-checks the AST against the environment, appending type errors (with
    /// offsets) to errors. Always returns a tree; it is only evaluable when no
    /// errors were added.
    /// </summary>
    public static TypedExpr Check(Expr expr, IReadOnlyDictionary<string, ScalarType> environment, List<ExprError> errors)
        => new Checker(environment, errors).Check(expr);

    /// <summary>Integer widens to Number; null (statically-null) unifies with anything.</summary>
    public static (ScalarType? Type, bool Ok) Unify(ScalarType? a, ScalarType? b)
        => a == null ? (b, true)
         : b == null ? (a, true)
         : a == b ? (a, true)
         : a.Value.IsNumeric() && b.Value.IsNumeric() ? (ScalarType.Number, true)
         : (null, false);

    private sealed class Checker(IReadOnlyDictionary<string, ScalarType> env, List<ExprError> errors)
    {
        private void Error(int position, string message)
            => errors.Add(new(position, message));

        public TypedExpr Check(Expr expr)
            => expr switch
            {
                BooleanLiteral b => new TypedLiteral(b.Position, ScalarType.Boolean, new BooleanScalar(b.Value)),
                IntegerLiteral i => new TypedLiteral(i.Position, ScalarType.Integer, new IntegerScalar(i.Value)),
                NumberLiteral n => new TypedLiteral(n.Position, ScalarType.Number, new NumberScalar(n.Value)),
                TextLiteral t => new TypedLiteral(t.Position, ScalarType.Text, new TextScalar(t.Value)),
                NullLiteral nl => new TypedLiteral(nl.Position, null, null),
                Identifier id => CheckIdentifier(id),
                Unary u => CheckUnary(u),
                Binary b => CheckBinary(b),
                Conditional c => CheckConditional(c),
                Call c => CheckCall(c),
                _ => throw new ArgumentException($"Unknown expression node {expr.GetType().Name}"),
            };

        private TypedExpr CheckIdentifier(Identifier id)
        {
            if (env.TryGetValue(id.Name, out var type))
                return new TypedIdentifier(id.Position, type, id.Name);
            Error(id.Position, $"Unknown identifier '{id.Name}'");
            return new TypedIdentifier(id.Position, null, id.Name);
        }

        private TypedExpr CheckUnary(Unary u)
        {
            var operand = Check(u.Operand);
            ScalarType? type;
            if (u.Op == UnaryOp.Not)
            {
                type = ScalarType.Boolean;
                if (operand.Type is { } t && t != ScalarType.Boolean)
                    Error(u.Position, $"'not' requires a Boolean operand, not {t}");
            }
            else
            {
                type = operand.Type;
                if (operand.Type is { } t && !t.IsNumeric())
                {
                    Error(u.Position, $"Unary '-' requires a numeric operand, not {t}");
                    type = null;
                }
            }
            return new TypedUnary(u.Position, type, u.Op, operand);
        }

        private TypedExpr CheckBinary(Binary b)
        {
            var left = Check(b.Left);
            var right = Check(b.Right);
            var type = b.Op switch
            {
                BinaryOp.Add or BinaryOp.Sub or BinaryOp.Mul => CheckArithmetic(b, left, right),
                BinaryOp.Div => RequireNumeric(b, left) & RequireNumeric(b, right) ? ScalarType.Number : (ScalarType?)null,
                BinaryOp.Mod => CheckModulo(b, left, right),
                BinaryOp.Concat => ScalarType.Text,
                BinaryOp.Eq or BinaryOp.Ne => CheckEquality(b, left, right),
                BinaryOp.Lt or BinaryOp.Le or BinaryOp.Gt or BinaryOp.Ge => CheckOrdering(b, left, right),
                BinaryOp.And or BinaryOp.Or => CheckLogical(b, left, right),
                _ => throw new ArgumentException($"Unknown operator {b.Op}"),
            };
            return new TypedBinary(b.Position, type, b.Op, left, right);
        }

        private ScalarType? CheckArithmetic(Binary b, TypedExpr left, TypedExpr right)
            => !(RequireNumeric(b, left) & RequireNumeric(b, right)) ? null
             : left.Type == ScalarType.Number || right.Type == ScalarType.Number ? ScalarType.Number
             : left.Type == null && right.Type == null ? null
             : ScalarType.Integer;

        private ScalarType? CheckModulo(Binary b, TypedExpr left, TypedExpr right)
            => RequireInteger(b, left) & RequireInteger(b, right)
                ? left.Type == null && right.Type == null ? null : ScalarType.Integer
                : null;

        private ScalarType? CheckEquality(Binary b, TypedExpr left, TypedExpr right)
        {
            var ok = left.Type == null || right.Type == null
                || left.Type == right.Type
                || (left.Type.Value.IsNumeric() && right.Type.Value.IsNumeric());
            if (!ok)
                Error(b.Position, $"Cannot compare {left.Type} and {right.Type} with '{b.Op.Text()}'");
            return ScalarType.Boolean;
        }

        private ScalarType? CheckOrdering(Binary b, TypedExpr left, TypedExpr right)
        {
            var ok = left.Type != ScalarType.Boolean && right.Type != ScalarType.Boolean
                && (left.Type == null || right.Type == null
                    || left.Type == right.Type
                    || (left.Type.Value.IsNumeric() && right.Type.Value.IsNumeric()));
            if (!ok)
                Error(b.Position, $"Cannot order {left.Type} and {right.Type} with '{b.Op.Text()}'");
            return ScalarType.Boolean;
        }

        private ScalarType? CheckLogical(Binary b, TypedExpr left, TypedExpr right)
        {
            RequireBoolean(b, left);
            RequireBoolean(b, right);
            return ScalarType.Boolean;
        }

        private bool RequireNumeric(Binary b, TypedExpr operand)
        {
            if (operand.Type is { } t && !t.IsNumeric())
            {
                Error(operand.Position, $"Operator '{b.Op.Text()}' requires numeric operands, not {t}");
                return false;
            }
            return true;
        }

        private bool RequireInteger(Binary b, TypedExpr operand)
        {
            if (operand.Type is { } t && t != ScalarType.Integer)
            {
                Error(operand.Position, $"Operator '{b.Op.Text()}' requires Integer operands, not {t}");
                return false;
            }
            return true;
        }

        private void RequireBoolean(Binary b, TypedExpr operand)
        {
            if (operand.Type is { } t && t != ScalarType.Boolean)
                Error(operand.Position, $"Operator '{b.Op.Text()}' requires Boolean operands, not {t}");
        }

        private TypedExpr CheckConditional(Conditional c)
        {
            var condition = Check(c.Condition);
            var whenTrue = Check(c.WhenTrue);
            var whenFalse = Check(c.WhenFalse);
            if (condition.Type is { } ct && ct != ScalarType.Boolean)
                Error(condition.Position, $"Conditional condition must be Boolean, not {ct}");
            var (type, ok) = Unify(whenTrue.Type, whenFalse.Type);
            if (!ok)
                Error(c.Position, $"Conditional branches have incompatible types {whenTrue.Type} and {whenFalse.Type}");
            return new TypedConditional(c.Position, type, condition, whenTrue, whenFalse);
        }

        private TypedExpr CheckCall(Call c)
        {
            var args = new List<TypedExpr>(c.Args.Count);
            foreach (var arg in c.Args)
                args.Add(Check(arg));
            var builtin = Builtins.FromName(c.Name);
            if (builtin == null)
            {
                Error(c.Position, $"Unknown function '{c.Name}'");
                return new TypedLiteral(c.Position, null, null);
            }
            var type = CheckBuiltin(c, builtin.Value, args);
            return new TypedCall(c.Position, type, builtin.Value, args);
        }

        private ScalarType? CheckBuiltin(Call c, Builtin builtin, IReadOnlyList<TypedExpr> args)
        {
            switch (builtin)
            {
                case Builtin.Abs:
                    return Arity(c, args, 1, 1) && NumericArg(c, args[0]) ? args[0].Type : null;
                case Builtin.Min:
                case Builtin.Max:
                {
                    if (!Arity(c, args, 2, int.MaxValue))
                        return null;
                    var ok = true;
                    foreach (var arg in args)
                        ok &= NumericArg(c, arg);
                    return !ok ? null
                        : args.Any(a => a.Type == ScalarType.Number) ? ScalarType.Number
                        : args.Any(a => a.Type == ScalarType.Integer) ? ScalarType.Integer
                        : null;
                }
                case Builtin.Round:
                    if (!Arity(c, args, 1, 2))
                        return null;
                    NumericArg(c, args[0]);
                    if (args.Count > 1 && args[1].Type is { } dt && dt != ScalarType.Integer)
                        Error(args[1].Position, $"Function '{c.Name}' requires an Integer digits argument, not {dt}");
                    return ScalarType.Number;
                case Builtin.Floor:
                case Builtin.Ceil:
                    if (Arity(c, args, 1, 1))
                        NumericArg(c, args[0]);
                    return ScalarType.Number;
                case Builtin.Len:
                    if (Arity(c, args, 1, 1))
                        TextArg(c, args[0]);
                    return ScalarType.Integer;
                case Builtin.Lower:
                case Builtin.Upper:
                    if (Arity(c, args, 1, 1))
                        TextArg(c, args[0]);
                    return ScalarType.Text;
                case Builtin.Contains:
                case Builtin.StartsWith:
                case Builtin.EndsWith:
                    if (Arity(c, args, 2, 2))
                    {
                        TextArg(c, args[0]);
                        TextArg(c, args[1]);
                    }
                    return ScalarType.Boolean;
                case Builtin.Coalesce:
                {
                    if (!Arity(c, args, 2, int.MaxValue))
                        return null;
                    ScalarType? type = null;
                    foreach (var arg in args)
                    {
                        var (unified, ok) = Unify(type, arg.Type);
                        if (!ok)
                        {
                            Error(arg.Position, $"coalesce argument of type {arg.Type} is incompatible with {type}");
                            return null;
                        }
                        type = unified;
                    }
                    return type;
                }
                default:
                    throw new ArgumentException($"Unknown builtin {builtin}");
            }
        }

        private bool Arity(Call c, IReadOnlyList<TypedExpr> args, int min, int max)
        {
            if (args.Count >= min && args.Count <= max)
                return true;
            var expected = min == max ? $"{min} argument{(min == 1 ? "" : "s")}"
                : max == int.MaxValue ? $"at least {min} arguments"
                : $"{min} to {max} arguments";
            Error(c.Position, $"Function '{c.Name}' expects {expected}, got {args.Count}");
            return false;
        }

        private bool NumericArg(Call c, TypedExpr arg)
        {
            if (arg.Type is { } t && !t.IsNumeric())
            {
                Error(arg.Position, $"Function '{c.Name}' requires a numeric argument, not {t}");
                return false;
            }
            return true;
        }

        private void TextArg(Call c, TypedExpr arg)
        {
            if (arg.Type is { } t && t != ScalarType.Text)
                Error(arg.Position, $"Function '{c.Name}' requires a Text argument, not {t}");
        }
    }
}
