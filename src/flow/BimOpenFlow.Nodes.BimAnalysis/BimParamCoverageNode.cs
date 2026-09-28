using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Data-quality profile of a long parameter table: how often each parameter
/// occurs, how many distinct values it takes, and its fill rate across entities.</summary>
public sealed class BimParamCoverageNode : IFlowNode
{
    public const string Kind = "bim.paramCoverage";

    public const string GroupBy = "groupBy";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("parameters", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec(GroupBy, ParamKind.Text, "", Suggest: SuggestSource.ColumnsOf("parameters"))],
        "Profiles a long parameter table (the bos.load parameters output: EntityIndex, Name, "
        + "ParameterGroup, Units, ValueType, Value) into one row per parameter name: "
        + "Name, ParameterGroup, ValueType, Count, Distinct, FillRate, ordered by Count "
        + "descending. With 'groupBy' empty (the default), FillRate is the share of every "
        + "distinct entity in the input that carries the parameter, which understates fill for "
        + "a parameter that only applies to one kind of entity. With 'groupBy' naming a column "
        + "present on the input (for example a Category column joined in from bos.load's "
        + "entities table), the output gets one row per parameter per group value, and FillRate "
        + "is the share of that group's entities that carry the parameter.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var table = inputs.TableInput(0, Kind);
        var iEntity = table.RequireColumn(BimColumns.EntityIndex, Kind);
        var iName = table.RequireColumn(BimColumns.Name, Kind);
        var iValue = table.RequireColumn("Value", Kind);
        var iGroup = table.ColumnIndex(BimColumns.ParameterGroup);
        var iType = table.ColumnIndex(BimColumns.ValueType);
        var groupByName = parameters.GetText(GroupBy);
        var hasGroupBy = groupByName.Length > 0;
        var iGroupBy = hasGroupBy ? table.RequireColumn(groupByName, Kind) : -1;

        var allEntities = new HashSet<string>();
        var groupTotals = new Dictionary<string, HashSet<string>>();
        var groups = new Dictionary<(string Name, string? Group), Accumulator>();
        for (var row = 0; row < table.RowCount(); row++)
        {
            var entity = TableColumns.CellText(table[iEntity, row]);
            var groupValue = hasGroupBy ? TableColumns.CellText(table[iGroupBy, row]) : null;
            if (entity != null)
            {
                allEntities.Add(entity);
                if (hasGroupBy)
                {
                    if (!groupTotals.TryGetValue(groupValue ?? "\0", out var set))
                        groupTotals[groupValue ?? "\0"] = set = new HashSet<string>();
                    set.Add(entity);
                }
            }
            var name = TableColumns.CellText(table[iName, row]);
            var key = (name ?? "\0", hasGroupBy ? groupValue : null);
            if (!groups.TryGetValue(key, out var g))
                groups[key] = g = new Accumulator(name, groupValue);
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
        double FillRate(Accumulator g)
        {
            if (!hasGroupBy)
                return total == 0 ? 0.0 : (double)g.Entities.Count / total;
            var groupSize = groupTotals.TryGetValue(g.Group ?? "\0", out var set) ? set.Count : 0;
            return groupSize == 0 ? 0.0 : (double)g.Entities.Count / groupSize;
        }

        var ordered = groups.Values
            .OrderByDescending(g => g.Count)
            .ThenBy(g => g.Name, StringComparer.Ordinal)
            .ThenBy(g => g.Group, StringComparer.Ordinal)
            .ToList();

        var builder = new DataTableBuilder("paramCoverage");
        builder.AddColumn(ordered.Select(g => (object?)g.Name).ToArray(), BimColumns.Name, typeof(string));
        builder.AddColumn(ordered.Select(g => (object?)g.ParameterGroup).ToArray(), BimColumns.ParameterGroup, typeof(string));
        builder.AddColumn(ordered.Select(g => (object?)g.ValueType).ToArray(), BimColumns.ValueType, typeof(string));
        if (hasGroupBy)
            builder.AddColumn(ordered.Select(g => (object?)g.Group).ToArray(), groupByName, typeof(string));
        builder.AddColumn(ordered.Select(g => (object?)g.Count).ToArray(), BimColumns.Count, typeof(long));
        builder.AddColumn(ordered.Select(g => (object?)(long)g.Values.Count).ToArray(), BimColumns.Distinct, typeof(long));
        builder.AddColumn(ordered.Select(g => (object?)FillRate(g)).ToArray(), BimColumns.FillRate, typeof(double));
        return [new TableValue(builder.Build())];
    }

    /// <summary>Per-(parameter name, group value) tallies gathered in one pass over the
    /// input rows; Group is null when the node has no groupBy.</summary>
    private sealed class Accumulator(string? name, string? group)
    {
        public string? Name { get; } = name;
        public string? Group { get; } = group;
        public long Count;
        public HashSet<string> Values { get; } = new();
        public HashSet<string> Entities { get; } = new();
        public string? ParameterGroup;
        public string? ValueType;
    }
}
