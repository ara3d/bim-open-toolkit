using BimOpenFlow.Ask;

namespace BimOpenMcp.Ifc.Ask;

/// <summary>What one question cost and produced: the final text, the turns and tokens it took,
/// and every event the agent reported on the way (tool calls in order, plus any text the model
/// wrote between them). The events are the record of how the answer was reached, which is the
/// point of the run.</summary>
public sealed record IfcAskAnswer(
    string Question,
    string Answer,
    int Turns,
    long InputTokens,
    long OutputTokens,
    IReadOnlyList<AskEvent> Events)
{
    public IReadOnlyList<AskEvent> ToolCalls
        => Events.Where(e => e.Type == "tool").ToList();
}
