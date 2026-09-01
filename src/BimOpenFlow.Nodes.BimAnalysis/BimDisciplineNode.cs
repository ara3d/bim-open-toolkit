using System.Text.Json;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Adds a Discipline column classified from a category column via a built-in
/// Revit/IFC category mapping, overridable per category.</summary>
public sealed class BimDisciplineNode : IFlowNode
{
    public const string Kind = "bim.discipline";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [new PortSpec("table", PortType.Table)],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("column", ParamKind.Text, BimColumns.Category,
                Suggest: SuggestSource.ColumnsOf("table")),
            new ParamSpec("overrides", ParamKind.Json),
        ],
        "Adds a Discipline column (Architecture, Structure, Mechanical, Electrical, Plumbing, "
        + "FireProtection, Site, or General) classified from the category column by a built-in "
        + "mapping of common Revit categories and IFC classes; 'overrides' is an optional JSON "
        + "object of {\"category\": \"discipline\"} entries that win over the built-ins. "
        + "Unmatched categories get General.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var table = inputs.TableInput(0, Kind);
        var column = table.RequireColumn(parameters.TextOr("column", BimColumns.Category), Kind);
        if (table.ColumnIndex(BimColumns.Discipline) >= 0)
            throw new ArgumentException($"{Kind}: column '{BimColumns.Discipline}' already exists.");
        var overrides = ParseOverrides(parameters.GetText("overrides"));

        var rows = table.RowCount();
        var disciplines = new object?[rows];
        for (var row = 0; row < rows; row++)
            disciplines[row] = Classify(TableColumns.CellText(table[column, row]), overrides);
        return [new TableValue(AppendTextColumn(table, BimColumns.Discipline, disciplines))];
    }

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

    private static IReadOnlyDictionary<string, string> ParseOverrides(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new Dictionary<string, string>();
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                throw new ArgumentException($"{Kind}: 'overrides' must be a JSON object of {{\"category\": \"discipline\"}}.");
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var property in document.RootElement.EnumerateObject())
                map[property.Name] = property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString()!
                    : throw new ArgumentException($"{Kind}: override '{property.Name}' must map to a string discipline.");
            return map;
        }
        catch (JsonException e)
        {
            throw new ArgumentException($"{Kind}: 'overrides' is not valid JSON: {e.Message}", e);
        }
    }

    private static string Classify(string? category, IReadOnlyDictionary<string, string> overrides)
    {
        if (string.IsNullOrWhiteSpace(category))
            return "General";
        if (overrides.TryGetValue(category, out var overridden))
            return overridden;
        if (Exact.TryGetValue(category, out var exact))
            return exact;
        foreach (var (prefix, discipline) in Prefixes)
            if (category.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return discipline;
        if (category.StartsWith("Ifc", StringComparison.OrdinalIgnoreCase))
            foreach (var (token, discipline) in IfcContains)
                if (category.Contains(token, StringComparison.OrdinalIgnoreCase))
                    return discipline;
        return "General";
    }

    private static readonly IReadOnlyDictionary<string, string> Exact =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Walls"] = "Architecture",
            ["Floors"] = "Architecture",
            ["Roofs"] = "Architecture",
            ["Ceilings"] = "Architecture",
            ["Doors"] = "Architecture",
            ["Windows"] = "Architecture",
            ["Stairs"] = "Architecture",
            ["Railings"] = "Architecture",
            ["Rooms"] = "Architecture",
            ["Areas"] = "Architecture",
            ["Furniture"] = "Architecture",
            ["Furniture Systems"] = "Architecture",
            ["Casework"] = "Architecture",
            ["Entourage"] = "Architecture",
            ["Rebar"] = "Structure",
            ["Ducts"] = "Mechanical",
            ["Flex Ducts"] = "Mechanical",
            ["Air Terminals"] = "Mechanical",
            ["Mechanical Equipment"] = "Mechanical",
            ["HVAC Zones"] = "Mechanical",
            ["Communication Devices"] = "Electrical",
            ["Data Devices"] = "Electrical",
            ["Fire Alarm Devices"] = "Electrical",
            ["Security Devices"] = "Electrical",
            ["Nurse Call Devices"] = "Electrical",
            ["Telephone Devices"] = "Electrical",
            ["Pipes"] = "Plumbing",
            ["Flex Pipes"] = "Plumbing",
            ["Plumbing Fixtures"] = "Plumbing",
            ["Sprinklers"] = "FireProtection",
            ["Fire Protection"] = "FireProtection",
            ["Site"] = "Site",
            ["Topography"] = "Site",
            ["Planting"] = "Site",
            ["Parking"] = "Site",
            ["Roads"] = "Site",
            ["Pads"] = "Site",
        };

    private static readonly (string Prefix, string Discipline)[] Prefixes =
    [
        ("Curtain", "Architecture"),
        ("Structural", "Structure"),
        ("Duct", "Mechanical"),
        ("Electrical", "Electrical"),
        ("Lighting", "Electrical"),
        ("Cable Tray", "Electrical"),
        ("Conduit", "Electrical"),
        ("Pipe", "Plumbing"),
        ("Plumbing", "Plumbing"),
    ];

    private static readonly (string Token, string Discipline)[] IfcContains =
    [
        ("IfcWall", "Architecture"), ("IfcSlab", "Architecture"), ("IfcRoof", "Architecture"),
        ("IfcDoor", "Architecture"), ("IfcWindow", "Architecture"), ("IfcStair", "Architecture"),
        ("IfcRailing", "Architecture"), ("IfcCovering", "Architecture"),
        ("IfcCurtainWall", "Architecture"), ("IfcSpace", "Architecture"), ("IfcFurnish", "Architecture"),
        ("IfcBeam", "Structure"), ("IfcColumn", "Structure"), ("IfcMember", "Structure"),
        ("IfcFooting", "Structure"), ("IfcPile", "Structure"), ("IfcReinforc", "Structure"),
        ("IfcDuct", "Mechanical"), ("IfcAirTerminal", "Mechanical"), ("IfcFan", "Mechanical"),
        ("IfcCoil", "Mechanical"), ("IfcBoiler", "Mechanical"), ("IfcChiller", "Mechanical"),
        ("IfcCable", "Electrical"), ("IfcElectric", "Electrical"), ("IfcLight", "Electrical"),
        ("IfcSwitch", "Electrical"), ("IfcOutlet", "Electrical"),
        ("IfcPipe", "Plumbing"), ("IfcSanitary", "Plumbing"), ("IfcValve", "Plumbing"),
        ("IfcPump", "Plumbing"), ("IfcWasteTerminal", "Plumbing"),
        ("IfcFireSuppression", "FireProtection"), ("IfcSprinkler", "FireProtection"),
        ("IfcSite", "Site"), ("IfcGeographicElement", "Site"),
    ];
}
