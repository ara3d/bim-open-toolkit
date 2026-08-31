namespace Ara3D.DataFlowEngine.Expressions.Parsing;

public static class OpText
{
    public static string Text(this UnaryOp op)
        => op == UnaryOp.Negate ? "-" : "not";

    public static string Text(this BinaryOp op)
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
            _ => op.ToString(),
        };
}
