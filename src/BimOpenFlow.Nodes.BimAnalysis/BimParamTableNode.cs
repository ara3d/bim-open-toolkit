using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The typed parameter table: one row per element, one column per requested
/// parameter, with real column types instead of the all-text ParameterText view.</summary>
public sealed class BimParamTableNode : IFlowNode
{
    public const string Kind = "bim.paramTable";

    // TODO: suggest parameter names from the file (needs a new SuggestKind through
    // contracts + web; ColumnsOfInput and TablesInFile are the only kinds today).
    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("path", ParamKind.FilePath),
            new ParamSpec("parameters", ParamKind.Text),
        ],
        "Loads a .bos file into one row per element with EntityIndex, Name, Category plus one "
        + "typed column per requested parameter ('parameters' is a comma-separated list of full "
        + "descriptor names, e.g. Rvt:Room:Volume). Columns take the short name after the last "
        + "colon (the full name on collision); Int maps to integer, Number to double, String and "
        + "Entity to text, and Point parameters expand to three .X/.Y/.Z double columns.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track PAR");
}
