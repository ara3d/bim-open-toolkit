using System.Text.Json;
using System.Text.RegularExpressions;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Adds a room-classification column derived from room names by ordered
/// regular-expression rules, with a built-in ruleset for common room types.</summary>
public sealed class BimClassifyRoomsNode : IFlowNode
{
    public const string Kind = "bim.classifyRooms";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("table", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("column", ParamKind.Text, BimColumns.Name,
                Suggest: SuggestSource.ColumnsOf("table")),
            new ParamSpec("rules", ParamKind.Json),
            new ParamSpec("as", ParamKind.Text, BimColumns.RoomClass),
        ],
        "Adds a room class column ('as', default RoomClass) by matching the name column against "
        + "ordered case-insensitive regex rules; first match wins, no match gets Other. The "
        + "built-in ruleset covers Office, Meeting, Circulation, Stair, Elevator, Sanitary, "
        + "Kitchen, Storage, Mechanical, Residential, and Parking; 'rules' is an optional JSON "
        + "array of {\"class\": ..., \"pattern\": ...} that replaces it.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var table = inputs.TableInput(0, Kind);
        var column = table.RequireColumn(parameters.GetText("column", BimColumns.Name), Kind);
        var name = parameters.GetText("as") is var n && !string.IsNullOrWhiteSpace(n)
            ? n
            : BimColumns.RoomClass;
        if (table.ColumnIndex(name) >= 0)
            throw new ArgumentException($"{Kind}: column '{name}' already exists.");
        var rules = ParseRules(parameters.GetText("rules"));

        var rows = table.RowCount();
        var classes = new object?[rows];
        for (var row = 0; row < rows; row++)
            classes[row] = Classify(TableColumns.CellText(table[column, row]), rules);
        return [new TableValue(AppendTextColumn(table, name, classes))];
    }

    private static string Classify(string? text, IReadOnlyList<(string Class, Regex Pattern)> rules)
    {
        if (text != null)
            foreach (var (cls, pattern) in rules)
                if (pattern.IsMatch(text))
                    return cls;
        return "Other";
    }

    private static IReadOnlyList<(string Class, Regex Pattern)> ParseRules(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return BuiltIns.Value;
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
                throw new ArgumentException($"{Kind}: 'rules' must be a JSON array of {{\"class\": ..., \"pattern\": ...}}.");
            return document.RootElement.EnumerateArray().Select(element =>
                element.ValueKind == JsonValueKind.Object
                    && element.TryGetProperty("class", out var cls) && cls.ValueKind == JsonValueKind.String
                    && element.TryGetProperty("pattern", out var pattern) && pattern.ValueKind == JsonValueKind.String
                    ? Rule(cls.GetString()!, pattern.GetString()!)
                    : throw new ArgumentException($"{Kind}: each rule needs string 'class' and 'pattern' properties.")).ToList();
        }
        catch (JsonException e)
        {
            throw new ArgumentException($"{Kind}: 'rules' is not valid JSON: {e.Message}", e);
        }
    }

    private static (string Class, Regex Pattern) Rule(string cls, string pattern)
    {
        try
        {
            return (cls, new Regex(pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant));
        }
        catch (ArgumentException e)
        {
            throw new ArgumentException($"{Kind}: invalid regex pattern '{pattern}': {e.Message}", e);
        }
    }

    private static readonly Lazy<IReadOnlyList<(string Class, Regex Pattern)>> BuiltIns = new(() =>
        new (string Class, string Pattern)[]
        {
            ("Office", "office|study|workstation"),
            ("Meeting", "meeting|conference|board ?room|huddle"),
            ("Circulation", "corridor|hall|lobby|entrance|vestibule|circulation|foyer"),
            ("Stair", "stair"),
            ("Elevator", "elevator|lift ?shaft|lift"),
            ("Sanitary", "wc|toilet|rest ?room|bath|washroom|shower|lavatory|sanitary"),
            ("Kitchen", "kitchen|pantry|break ?room|canteen|cafeteria"),
            ("Storage", "stor|closet|archive|janitor|utility ?closet"),
            ("Mechanical", "mech|electrical|elec\\b|server|data ?(room|center)|plant|boiler|ahu|switch|pump|riser|shaft"),
            ("Residential", "bed ?room|living|dining|lounge"),
            ("Parking", "parking|garage|carport"),
        }.Select(r => Rule(r.Class, r.Pattern)).ToList());

    private static IDataTable AppendTextColumn(IDataTable table, string name, object?[] cells)
    {
        var rows = table.RowCount();
        var builder = new DataTableBuilder(table.Name);
        foreach (var c in table.Columns)
        {
            var copy = new object?[rows];
            for (var row = 0; row < rows; row++)
                copy[row] = table[c.ColumnIndex, row];
            builder.AddColumn(copy, c.Descriptor.Name, c.Descriptor.Type);
        }
        builder.AddColumn(cells, name, typeof(string));
        return builder.Build();
    }
}
