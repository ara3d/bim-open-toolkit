using System.Globalization;
using System.Text;

namespace Ara3D.DataFlowEngine.Expressions.Parsing;

public static class Lexer
{
    /// <summary>
    /// Tokenizes the text, appending lexical errors (with offsets) to errors.
    /// Always ends the result with an End token.
    /// </summary>
    public static IReadOnlyList<Token> Tokenize(string text, List<ExprError> errors)
    {
        var tokens = new List<Token>();
        var i = 0;
        while (i < text.Length)
        {
            var start = i;
            var c = text[i];
            if (char.IsWhiteSpace(c))
                i++;
            else if (IsDigit(c))
                ReadNumber(text, ref i, tokens, errors);
            else if (IsWordStart(c))
                ReadWord(text, ref i, tokens);
            else if (c == '[')
                ReadBracketIdentifier(text, ref i, tokens, errors);
            else if (c is '\'' or '"')
                ReadText(text, ref i, tokens, errors);
            else if (!ReadPunctuation(text, ref i, tokens))
            {
                errors.Add(new(start, $"Unexpected character '{c}'"));
                i++;
            }
        }
        tokens.Add(new(TokenKind.End, text.Length, 0));
        return tokens;
    }

    private static bool IsDigit(char c) => c is >= '0' and <= '9';

    private static bool IsWordStart(char c) => c is (>= 'a' and <= 'z') or (>= 'A' and <= 'Z') or '_';

    private static bool IsWordChar(char c) => IsWordStart(c) || IsDigit(c);

    private static void ReadNumber(string text, ref int i, List<Token> tokens, List<ExprError> errors)
    {
        var start = i;
        while (i < text.Length && IsDigit(text[i]))
            i++;
        var isNumber = false;
        if (i + 1 < text.Length && text[i] == '.' && IsDigit(text[i + 1]))
        {
            isNumber = true;
            i++;
            while (i < text.Length && IsDigit(text[i]))
                i++;
        }
        if (i < text.Length && text[i] is 'e' or 'E')
        {
            var j = i + 1;
            if (j < text.Length && text[j] is '+' or '-')
                j++;
            if (j < text.Length && IsDigit(text[j]))
            {
                isNumber = true;
                i = j + 1;
                while (i < text.Length && IsDigit(text[i]))
                    i++;
            }
        }
        var digits = text.Substring(start, i - start);
        if (isNumber)
            tokens.Add(new(TokenKind.Number, start, i - start, digits));
        else if (long.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out _))
            tokens.Add(new(TokenKind.Integer, start, i - start, digits));
        else
            errors.Add(new(start, $"Integer literal '{digits}' is out of range"));
    }

    private static void ReadWord(string text, ref int i, List<Token> tokens)
    {
        var start = i;
        while (i < text.Length && IsWordChar(text[i]))
            i++;
        var word = text.Substring(start, i - start);
        var kind = word switch
        {
            "true" => TokenKind.True,
            "false" => TokenKind.False,
            "null" => TokenKind.Null,
            "and" => TokenKind.And,
            "or" => TokenKind.Or,
            "not" => TokenKind.Not,
            _ => TokenKind.Identifier,
        };
        tokens.Add(new(kind, start, i - start, kind == TokenKind.Identifier ? word : null));
    }

    private static void ReadBracketIdentifier(string text, ref int i, List<Token> tokens, List<ExprError> errors)
    {
        var start = i;
        i++;
        var sb = new StringBuilder();
        while (true)
        {
            if (i >= text.Length)
            {
                errors.Add(new(start, "Unterminated bracketed identifier"));
                return;
            }
            var c = text[i];
            if (c == ']')
            {
                if (i + 1 < text.Length && text[i + 1] == ']')
                {
                    sb.Append(']');
                    i += 2;
                    continue;
                }
                i++;
                break;
            }
            sb.Append(c);
            i++;
        }
        if (sb.Length == 0)
            errors.Add(new(start, "Empty bracketed identifier"));
        else
            tokens.Add(new(TokenKind.Identifier, start, i - start, sb.ToString(), Quoted: true));
    }

    private static void ReadText(string text, ref int i, List<Token> tokens, List<ExprError> errors)
    {
        var start = i;
        var quote = text[i];
        i++;
        var sb = new StringBuilder();
        while (true)
        {
            if (i >= text.Length)
            {
                errors.Add(new(start, "Unterminated text literal"));
                return;
            }
            var c = text[i];
            if (c == quote)
            {
                i++;
                break;
            }
            if (c == '\\')
            {
                if (i + 1 >= text.Length)
                {
                    errors.Add(new(start, "Unterminated text literal"));
                    return;
                }
                var e = text[i + 1];
                var decoded = e switch
                {
                    '\\' => '\\',
                    '\'' => '\'',
                    '"' => '"',
                    'n' => '\n',
                    't' => '\t',
                    _ => (char?)null,
                };
                if (decoded == null)
                {
                    errors.Add(new(i, $"Invalid escape sequence '\\{e}'"));
                    return;
                }
                sb.Append(decoded.Value);
                i += 2;
                continue;
            }
            sb.Append(c);
            i++;
        }
        tokens.Add(new(TokenKind.Text, start, i - start, sb.ToString()));
    }

    private static bool ReadPunctuation(string text, ref int i, List<Token> tokens)
    {
        var two = i + 1 < text.Length ? text[i + 1] : '\0';
        var (kind, length) = text[i] switch
        {
            '+' => (TokenKind.Plus, 1),
            '-' => (TokenKind.Minus, 1),
            '*' => (TokenKind.Star, 1),
            '/' => (TokenKind.Slash, 1),
            '%' => (TokenKind.Percent, 1),
            '&' => (TokenKind.Amp, 1),
            '(' => (TokenKind.LParen, 1),
            ')' => (TokenKind.RParen, 1),
            ',' => (TokenKind.Comma, 1),
            '?' => (TokenKind.Question, 1),
            ':' => (TokenKind.Colon, 1),
            '=' when two == '=' => (TokenKind.Eq, 2),
            '!' when two == '=' => (TokenKind.Ne, 2),
            '<' => two == '=' ? (TokenKind.Le, 2) : (TokenKind.Lt, 1),
            '>' => two == '=' ? (TokenKind.Ge, 2) : (TokenKind.Gt, 1),
            _ => (TokenKind.End, 0),
        };
        if (length == 0)
            return false;
        tokens.Add(new(kind, i, length));
        i += length;
        return true;
    }
}
