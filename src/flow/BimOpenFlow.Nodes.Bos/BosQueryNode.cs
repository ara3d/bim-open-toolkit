using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Bos;

/// <summary>Runs one read-only SQL query over the input table, which is loaded into an
/// in-memory DuckDB as table "t". Named bos.* because the DuckDB dependency lives in this pack.</summary>
public sealed class BosQueryNode : ISchemaNode
{
    public const string Kind = "bos.query";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("table", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec("sql", ParamKind.Text)],
        "Runs one read-only SQL query over the input table, available as 't'.",
        Schemas: [SchemaSpec.Inferred("table")]);

    /// <summary>DESCRIBE over an empty typed view of the input, through the catalog.</summary>
    public SchemaResult Infer(string output, IReadOnlyList<SchemaInput> inputs, ParamValues parameters, ISchemaCatalog catalog)
    {
        if (inputs[0].Schema is not { Ok: true } input)
            return inputs[0].Schema ?? SchemaResult.Fail($"{Kind}: input 0 has no table connected.");
        try
        {
            return catalog.QuerySchema(SqlAlias.WithT(BosDuckDbQueries.ReadOnlyQuery(parameters.GetText("sql"))), [input.Schema!]);
        }
        catch (ArgumentException e)
        {
            return SchemaResult.Fail($"{Kind}: {e.Message}");
        }
    }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => [new TableValue(inputs.TableInput(0, Kind)
            .QueryOver(parameters.RequiredText("sql", Kind), "query"))];
}
