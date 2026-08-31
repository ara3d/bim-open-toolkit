using System.Globalization;

namespace Ara3D.DataFlowEngine.Expressions.Parsing;

public static class Parser
{
    /// <summary>
    /// Parses the text into an AST, appending lexical/syntax errors (with offsets)
    /// to errors. Returns null when any error occurred.
    /// </summary>
    public static Expr? Parse(string text, List<ExprError> errors)
    {
        var tokens = Lexer.Tokenize(text, errors);
        if (errors.Count > 0)
            return null;
        try
        {
            var cursor = new Cursor(tokens, errors);
            var expr = cursor.ParseConditional();
            if (cursor.Current.Kind != TokenKind.End)
                cursor.Fail(cursor.Current.Position, "Unexpected token after end of expression");
            return expr;
        }
        catch (SyntaxException)
        {
            return null;
        }
    }

    private sealed class SyntaxException : Exception;

    private sealed class Cursor(IReadOnlyList<Token> tokens, List<ExprError> errors)
    {
        private int _index;

        public Token Current => tokens[_index];

        private Token Advance() => tokens[_index++];

        private bool Match(TokenKind kind)
        {
            if (Current.Kind != kind)
                return false;
            _index++;
            return true;
        }

        public Expr Fail(int position, string message)
        {
            errors.Add(new(position, message));
            throw new SyntaxException();
        }

        public Expr ParseConditional()
        {
            var condition = ParseOr();
            if (!Match(TokenKind.Question))
                return condition;
            var position = tokens[_index - 1].Position;
            var whenTrue = ParseConditional();
            if (!Match(TokenKind.Colon))
                Fail(Current.Position, "Expected ':' in conditional expression");
            var whenFalse = ParseConditional();
            return new Conditional(position, condition, whenTrue, whenFalse);
        }

        private Expr ParseOr()
            => ParseLeftAssoc(ParseAnd, k => k == TokenKind.Or ? BinaryOp.Or : null);

        private Expr ParseAnd()
            => ParseLeftAssoc(ParseComparison, k => k == TokenKind.And ? BinaryOp.And : null);

        private Expr ParseComparison()
            => ParseLeftAssoc(ParseConcat, k => k switch
            {
                TokenKind.Eq => BinaryOp.Eq,
                TokenKind.Ne => BinaryOp.Ne,
                TokenKind.Lt => BinaryOp.Lt,
                TokenKind.Le => BinaryOp.Le,
                TokenKind.Gt => BinaryOp.Gt,
                TokenKind.Ge => BinaryOp.Ge,
                _ => null,
            });

        private Expr ParseConcat()
            => ParseLeftAssoc(ParseAdditive, k => k == TokenKind.Amp ? BinaryOp.Concat : null);

        private Expr ParseAdditive()
            => ParseLeftAssoc(ParseMultiplicative, k => k switch
            {
                TokenKind.Plus => BinaryOp.Add,
                TokenKind.Minus => BinaryOp.Sub,
                _ => null,
            });

        private Expr ParseMultiplicative()
            => ParseLeftAssoc(ParseUnary, k => k switch
            {
                TokenKind.Star => BinaryOp.Mul,
                TokenKind.Slash => BinaryOp.Div,
                TokenKind.Percent => BinaryOp.Mod,
                _ => null,
            });

        private Expr ParseLeftAssoc(Func<Expr> next, Func<TokenKind, BinaryOp?> toOp)
        {
            var left = next();
            while (toOp(Current.Kind) is { } op)
            {
                var position = Advance().Position;
                left = new Binary(position, op, left, next());
            }
            return left;
        }

        private Expr ParseUnary()
            => Current.Kind switch
            {
                TokenKind.Minus => new Unary(Advance().Position, UnaryOp.Negate, ParseUnary()),
                TokenKind.Not => new Unary(Advance().Position, UnaryOp.Not, ParseUnary()),
                _ => ParsePrimary(),
            };

        private Expr ParsePrimary()
        {
            var token = Current;
            switch (token.Kind)
            {
                case TokenKind.True:
                    Advance();
                    return new BooleanLiteral(token.Position, true);
                case TokenKind.False:
                    Advance();
                    return new BooleanLiteral(token.Position, false);
                case TokenKind.Null:
                    Advance();
                    return new NullLiteral(token.Position);
                case TokenKind.Integer:
                    Advance();
                    return new IntegerLiteral(token.Position, long.Parse(token.Value!, NumberStyles.None, CultureInfo.InvariantCulture));
                case TokenKind.Number:
                    Advance();
                    return new NumberLiteral(token.Position, double.Parse(token.Value!, NumberStyles.Float, CultureInfo.InvariantCulture));
                case TokenKind.Text:
                    Advance();
                    return new TextLiteral(token.Position, token.Value!);
                case TokenKind.Identifier:
                    Advance();
                    return Current.Kind == TokenKind.LParen && !token.Quoted
                        ? ParseCallArgs(token)
                        : new Identifier(token.Position, token.Value!);
                case TokenKind.LParen:
                    Advance();
                    var inner = ParseConditional();
                    if (!Match(TokenKind.RParen))
                        Fail(Current.Position, "Expected ')'");
                    return inner;
                default:
                    return Fail(token.Position, "Expected an expression");
            }
        }

        private Expr ParseCallArgs(Token name)
        {
            Advance();
            var args = new List<Expr>();
            if (!Match(TokenKind.RParen))
            {
                do
                    args.Add(ParseConditional());
                while (Match(TokenKind.Comma));
                if (!Match(TokenKind.RParen))
                    Fail(Current.Position, "Expected ')' after arguments");
            }
            return new Call(name.Position, name.Value!, args);
        }
    }
}
