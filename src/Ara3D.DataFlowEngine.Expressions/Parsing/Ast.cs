namespace Ara3D.DataFlowEngine.Expressions.Parsing;

public enum UnaryOp
{
    Negate,
    Not,
}

public enum BinaryOp
{
    Mul,
    Div,
    Mod,
    Add,
    Sub,
    Concat,
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    And,
    Or,
}

/// <summary>Untyped AST node; Position is the character offset in the source text.</summary>
public abstract record Expr(int Position);

public sealed record BooleanLiteral(int Position, bool Value) : Expr(Position);
public sealed record IntegerLiteral(int Position, long Value) : Expr(Position);
public sealed record NumberLiteral(int Position, double Value) : Expr(Position);
public sealed record TextLiteral(int Position, string Value) : Expr(Position);
public sealed record NullLiteral(int Position) : Expr(Position);
public sealed record Identifier(int Position, string Name) : Expr(Position);
public sealed record Unary(int Position, UnaryOp Op, Expr Operand) : Expr(Position);
public sealed record Binary(int Position, BinaryOp Op, Expr Left, Expr Right) : Expr(Position);
public sealed record Conditional(int Position, Expr Condition, Expr WhenTrue, Expr WhenFalse) : Expr(Position);
public sealed record Call(int Position, string Name, IReadOnlyList<Expr> Args) : Expr(Position);
