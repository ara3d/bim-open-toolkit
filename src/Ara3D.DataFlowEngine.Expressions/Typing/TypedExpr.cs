using Ara3D.DataFlowEngine.Expressions.Parsing;

namespace Ara3D.DataFlowEngine.Expressions.Typing;

/// <summary>
/// A type-checked AST node. Type is null only when the value is statically known
/// to be null (a null literal, or an expression built solely from null literals).
/// </summary>
public abstract record TypedExpr(int Position, ScalarType? Type);

public sealed record TypedLiteral(int Position, ScalarType? Type, Scalar? Value) : TypedExpr(Position, Type);
public sealed record TypedIdentifier(int Position, ScalarType? Type, string Name) : TypedExpr(Position, Type);
public sealed record TypedUnary(int Position, ScalarType? Type, UnaryOp Op, TypedExpr Operand) : TypedExpr(Position, Type);
public sealed record TypedBinary(int Position, ScalarType? Type, BinaryOp Op, TypedExpr Left, TypedExpr Right) : TypedExpr(Position, Type);
public sealed record TypedConditional(int Position, ScalarType? Type, TypedExpr Condition, TypedExpr WhenTrue, TypedExpr WhenFalse) : TypedExpr(Position, Type);
public sealed record TypedCall(int Position, ScalarType? Type, Builtin Builtin, IReadOnlyList<TypedExpr> Args) : TypedExpr(Position, Type);
