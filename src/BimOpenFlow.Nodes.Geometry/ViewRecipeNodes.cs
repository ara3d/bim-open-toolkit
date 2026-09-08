using System.Text.Json;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Small, serializable view recipes. Rendering stays in the visualization toolkit.</summary>
public static class ViewRecipeNodes
{
    public static IReadOnlyList<IFlowNode> All { get; } =
    [
        new ViewRecipeNode("scene", "Open a model with the visualization toolkit. Connect view outputs to compose a presentation.",
            [new("path", ParamKind.FilePath)], p => new { path = p.GetText("path") }, source: true),
        new ViewRecipeNode("section", "Cut along an axis at a fraction of the model bounds (0–1). Keeps the lower side; no capped solids.",
            [new("axis", ParamKind.Enum, "z", ["x", "y", "z"]), Slider("fraction", "0.5", 0, 1, "Position")],
            p => new { axis = Choice(p, "axis", "z", "x", "y", "z"), fraction = Range(p, "fraction", .5, 0, 1) }),
        new ViewRecipeNode("sectionBox", "Reveal a centered box inside the model. Fraction 1 keeps the full model; 0.5 keeps its central half on each axis.",
            [Slider("fraction", "0.5", .01, 1, "Size")], p => new { fraction = Range(p, "fraction", .5, .01, 1) }),
        new ViewRecipeNode("explode", "Fan source categories apart using the toolkit layout feature. Reset restores original coordinates.",
            [Slider("strength", "0.5", 0, 5, "Separation factor")], p => new { by = "category", strength = Range(p, "strength", .5, 0, 5) }),
        new ViewRecipeNode("projection", "Frame the model in perspective, orthographic or overhead plan view.",
            [new("mode", ParamKind.Enum, "orthographic", ["perspective", "orthographic", "plan"])],
            p => new { mode = Choice(p, "mode", "orthographic", "perspective", "orthographic", "plan") }),
        new ViewRecipeNode("environment", "Set a light or dark review background with scale-aware grid and axes.",
            [new("theme", ParamKind.Enum, "light", ["light", "dark"]), new("grid", ParamKind.Boolean, "true")],
            p => new { theme = Choice(p, "theme", "light", "light", "dark"), grid = bool.Parse(p.GetText("grid", "true")) }),
        new ViewRecipeNode("categoryStyle", "Color source categories, with a distinct unknown category; optionally ghost the entire model.",
            [Slider("opacity", "1", 0, 1)], p => new { opacity = Range(p, "opacity", 1, 0, 1) }),
        new ViewRecipeNode("tint", "Apply a uniform color and opacity to the model.",
            [new("color", ParamKind.Text, "#2b8bd6", Control: new("color")),
                new("opacityPercent", ParamKind.Percent, "100", Control: new("slider", 0, 100, 1, Label: "Opacity"))],
            p => new { color = Color(p.GetText("color", "#2b8bd6")), opacity = p.GetPercent("opacityPercent", 100).ToFraction().Value }),
        new ViewRecipeNode("sectionRange", "Keep the band between two fractions of the original model bounds along an axis.",
            [new("axis", ParamKind.Enum, "z", ["x", "y", "z"]),
                new("range", ParamKind.Text, "[0.3,0.7]", Control: new("range", 0, 1, .01, "percent", "Band"))],
            p => new { axis = Choice(p, "axis", "z", "x", "y", "z"), range = SectionRange(p) }),
    ];

    private static ParamSpec Slider(string name, string value, double min, double max, string? label = null)
        => new(name, max <= 1 ? ParamKind.Fraction : ParamKind.Number, value,
            Control: new("slider", min, max, .01, max <= 1 ? "percent" : null, label));

    private static string Color(string value)
        => System.Text.RegularExpressions.Regex.IsMatch(value, "^#[0-9a-fA-F]{6}$")
            ? value : throw new ArgumentException("Color must be #RRGGBB.");

    private static double[] SectionRange(ParamValues p)
    {
        var range = JsonSerializer.Deserialize<double[]>(p.GetText("range", "[0.3,0.7]"));
        return range is { Length: 2 } && range.All(double.IsFinite) && range[0] >= 0 && range[1] <= 1 && range[0] <= range[1]
            ? range : throw new ArgumentException("Range must contain two ordered fractions between 0 and 1.");
    }

    private static string Choice(ParamValues p, string name, string fallback, params string[] choices)
    {
        var value = p.GetText(name, fallback);
        return choices.Contains(value) ? value : throw new ArgumentException($"{name} must be one of: {string.Join(", ", choices)}");
    }

    private static double Range(ParamValues p, string name, double fallback, double min, double max)
    {
        var value = max <= 1 ? p.GetFraction(name, fallback).Value : p.GetNumber(name, fallback);
        return double.IsFinite(value) && value >= min && value <= max
            ? value : throw new ArgumentException($"{name} must be between {min} and {max}.");
    }
}

internal sealed class ViewRecipeNode : IFlowNode
{
    private readonly string operation;
    private readonly Func<ParamValues, object> input;
    private readonly bool source;

    public ViewRecipeNode(string operation, string description, IReadOnlyList<ParamSpec> parameters,
        Func<ParamValues, object> input, bool source = false)
    {
        this.operation = operation;
        this.input = input;
        this.source = source;
        Spec = new($"view3d.{operation}", 1, NodeCapability.Pure,
            source ? [] : [new("view", PortType.Table)], [new("view", PortType.Table)], parameters, description);
    }

    public NodeSpec Spec { get; }

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var operations = new List<string>();
        var arguments = new List<string>();
        if (!source)
        {
            var table = ((TableValue)inputs[0]).Table;
            var op = table.RequireColumn("operation");
            var args = table.RequireColumn("input");
            if (table.RowCount() == 0 || table.RowCount() >= 64 || table[op, 0]?.ToString() != "scene")
                throw new ArgumentException("A view recipe must start with view3d.scene and contain fewer than 64 steps.");
            for (var row = 0; row < table.RowCount(); row++)
            {
                operations.Add(table[op, row]?.ToString() ?? "");
                arguments.Add(table[args, row]?.ToString() ?? "{}");
            }
        }
        operations.Add(operation);
        arguments.Add(JsonSerializer.Serialize(input(parameters)));
        var builder = new DataTableBuilder("view");
        builder.AddColumn(operations.ToArray(), "operation");
        builder.AddColumn(arguments.ToArray(), "input");
        return [new TableValue(builder.Build())];
    }
}
