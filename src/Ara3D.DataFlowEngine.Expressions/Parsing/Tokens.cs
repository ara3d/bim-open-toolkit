namespace Ara3D.DataFlowEngine.Expressions.Parsing;

public enum TokenKind
{
    True,
    False,
    Null,
    And,
    Or,
    Not,
    Identifier,
    Integer,
    Number,
    Text,
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Amp,
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    LParen,
    RParen,
    Comma,
    Question,
    Colon,
    End,
}

/// <summary>
/// A lexed token. Value holds the decoded payload for Identifier/Text and the
/// raw digits for Integer/Number; null for punctuation and keywords.
/// Quoted marks a bracket-quoted identifier (never callable).
/// </summary>
public readonly record struct Token(TokenKind Kind, int Position, int Length, string? Value = null, bool Quoted = false);
