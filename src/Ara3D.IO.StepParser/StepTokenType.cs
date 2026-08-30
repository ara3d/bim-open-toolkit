namespace Ara3D.IO.StepParser
{
    public enum StepTokenType : byte
    {
        None,
        Identifier,
        SingleQuotedString,
        DoubleQuotedString,
        Whitespace,
        Number,
        Symbol,
        Id,
        Separator,
        Unassigned,
        Redeclared,
        Comment,
        Unknown,
        BeginGroup,
        EndGroup,
        Semicolon,
        Definition,
    }
}   