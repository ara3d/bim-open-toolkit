using BimOpenFlow.Ask;

namespace BimOpenMcp.Ifc.Ask;

/// <summary>The system prompt the question runner gives the model: which file to ask about,
/// which tool to reach for, the columns of the DuckDB text views, and the rules that decide
/// whether an answer is usable evidence (every number traced to a tool result, "not available"
/// allowed).</summary>
public static class IfcAskPrompts
{
    /// <summary>Property sets written by the analytics pass, as opposed to the ones the authoring
    /// tool exported. Named by prefix because each analysis writes its own set.</summary>
    public const string AnalyticsPrefix = "Pset_NRC";

    /// <summary>The tool guide, views and answer rules, read from the .claude/skills/ifc-ask
    /// file embedded at build time, so the Claude Code skill and this prompt never drift apart.</summary>
    public static readonly string Guide = EmbeddedText.Read(typeof(IfcAskPrompts).Assembly, "skills/ifc-ask/ifc-guide.md");

    public static string System(string modelPath)
        => $"""
            You answer questions about one IFC building model by calling the tools provided, and by nothing else.

            The model is the file at:
            {modelPath}
            Every tool takes 'path' as a required argument. Pass exactly that path on every call.

            {Guide}
            - Answer in two or three plain sentences. No markdown, no bullet lists, no tables.
            """;

    /// <summary>One question, as its own conversation: nothing carries over from the last one.</summary>
    public static string User(string question)
        => question.Trim();
}
