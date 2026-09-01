using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Data-quality profile of a long parameter table: how often each parameter
/// occurs, how many distinct values it takes, and its fill rate across entities.</summary>
public sealed class BimParamCoverageNode : IFlowNode
{
    public const string Kind = "bim.paramCoverage";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("parameters", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [],
        "Profiles a long parameter table (the bos.load parameters output: EntityIndex, Name, "
        + "ParameterGroup, Units, ValueType, Value) into one row per parameter name: "
        + "Name, ParameterGroup, ValueType, Count, Distinct, FillRate (share of the input's "
        + "distinct entities that carry the parameter), ordered by Count descending.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var table = inputs.TableInput(0, Kind);
        var iEntity = table.RequireColumn(BimColumns.EntityIndex, Kind);
        var iName = table.RequireColumn(BimColumns.Name, Kind);
        var iValue = table.RequireColumn("Value", Kind);
        var iGroup = table.ColumnIndex(BimColumns.ParameterGroup);
        var iType = table.ColumnIndex(BimColumns.ValueType);

        var allEntities = new HashSet<string>();
        var groups = new Dictionary<string, Accumulator>();
        for (var row = 0; row < table.RowCount(); row++)
        {
            var entity = TableColumns.CellText(table[iEntity, row]);
            if (entity != null)
                allEntities.Add(entity);
            var name = TableColumns.CellText(table[iName, row]);
            if (!groups.TryGetValue(name ?? "\0", out var g))
                groups[name ?? "\0"] = g = new Accumulator(name);
            g.Count++;
            if (entity != null)
                g.Entities.Add(entity);
            if (TableColumns.CellText(table[iValue, row]) is { } value)
                g.Values.Add(value);
            if (iGroup >= 0)
                g.ParameterGroup ??= TableColumns.CellText(table[iGroup, row]);
            if (iType >= 0)
                g.ValueType ??= TableColumns.CellText(table[iType, row]);
        }

        var total = allEntities.Count;
        var ordered = groups.Values
            .OrderByDescending(g => g.Count)
            .ThenBy(g => g.Name, StringComparer.Ordinal)
            .ToList();

        var builder = new DataTableBuilder("paramCoverage");
        builder.AddColumn(ordered.Select(g => (object?)g.Name).ToArray(), BimColumns.Name, typeof(string));
        builder.AddColumn(ordered.Select(g => (object?)g.ParameterGroup).ToArray(), BimColumns.ParameterGroup, typeof(string));
        builder.AddColumn(ordered.Select(g => (object?)g.ValueType).ToArray(), BimColumns.ValueType, typeof(string));
        builder.AddColumn(ordered.Select(g => (object?)g.Count).ToArray(), BimColumns.Count, typeof(long));
        builder.AddColumn(ordered.Select(g => (object?)(long)g.Values.Count).ToArray(), BimColumns.Distinct, typeof(long));
        builder.AddColumn(
            ordered.Select(g => (object?)(total == 0 ? 0.0 : (double)g.Entities.Count / total)).ToArray(),
            BimColumns.FillRate, typeof(double));
        return [new TableValue(builder.Build())];
    }

    /// <summary>Per-parameter-name tallies gathered in one pass over the input rows.</summary>
    private sealed class Accumulator(string? name)
    {
        public string? Name { get; } = name;
        public long Count;
        public HashSet<string> Values { get; } = new();
        public HashSet<string> Entities { get; } = new();
        public string? ParameterGroup;
        public string? ValueType;
    }
}
