using System.Globalization;
using Ara3D.DataFlowEngine.Expressions;
using Ara3D.DataFlowEngine.Expressions.Parsing;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

/// <summary>Renders an AST as an s-expression for compact structural assertions.</summary>
public static class AstRenderer
{
    public static string Render(this Expr expr)
        => expr switch
        {
            BooleanLiteral b => b.Value ? "true" : "false",
            IntegerLiteral i => i.Value.ToString(CultureInfo.InvariantCulture),
            NumberLiteral n => n.Value.ToString("R", CultureInfo.InvariantCulture),
            TextLiteral t => $"'{t.Value}'",
            NullLiteral => "null",
            Identifier id => id.Name,
            Unary u => $"({OpText(u.Op)} {u.Operand.Render()})",
            Binary b => $"({OpText(b.Op)} {b.Left.Render()} {b.Right.Render()})",
            Conditional c => $"(if {c.Condition.Render()} {c.WhenTrue.Render()} {c.WhenFalse.Render()})",
            Call c => $"({c.Name}{string.Concat(c.Args.Select(a => " " + a.Render()))})",
            _ => throw new InvalidOperationException(expr.GetType().Name),
        };

    private static string OpText(UnaryOp op)
        => op == UnaryOp.Negate ? "neg" : "not";

    private static string OpText(BinaryOp op)
        => op switch
        {
            BinaryOp.Mul => "*",
            BinaryOp.Div => "/",
            BinaryOp.Mod => "%",
            BinaryOp.Add => "+",
            BinaryOp.Sub => "-",
            BinaryOp.Concat => "&",
            BinaryOp.Eq => "==",
            BinaryOp.Ne => "!=",
            BinaryOp.Lt => "<",
            BinaryOp.Le => "<=",
            BinaryOp.Gt => ">",
            BinaryOp.Ge => ">=",
            BinaryOp.And => "and",
            BinaryOp.Or => "or",
            _ => throw new InvalidOperationException(op.ToString()),
        };
}
