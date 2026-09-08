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
            [new("axis", ParamKind.Enum, "z", ["x", "y", "z"]), new("fraction", ParamKind.Number, "0.5")],
            p => new { axis = Choice(p, "axis", "z", "x", "y", "z"), fraction = Range(p, "fraction", .5, 0, 1) }),
        new ViewRecipeNode("sectionBox", "Reveal a centered box inside the model. Fraction 1 keeps the full model; 0.5 keeps its central half on each axis.",
            [new("fraction", ParamKind.Number, "0.5")], p => new { fraction = Range(p, "fraction", .5, .01, 1) }),
        new ViewRecipeNode("explode", "Fan source categories apart using the toolkit layout feature. Reset restores original coordinates.",
            [new("strength", ParamKind.Number, "0.5")], p => new { by = "category", strength = Range(p, "strength", .5, 0, 5) }),
        new ViewRecipeNode("projection", "Frame the model in perspective, orthographic or overhead plan view.",
            [new("mode", ParamKind.Enum, "orthographic", ["perspective", "orthographic", "plan"])],
            p => new { mode = Choice(p, "mode", "orthographic", "perspective", "orthographic", "plan") }),
        new ViewRecipeNode("environment", "Set a light or dark review background with scale-aware grid and axes.",
            [new("theme", ParamKind.Enum, "light", ["light", "dark"]), new("grid", ParamKind.Boolean, "true")],
            p => new { theme = Choice(p, "theme", "light", "light", "dark"), grid = bool.Parse(p.GetText("grid", "true")) }),
        new ViewRecipeNode("categoryStyle", "Color source categories, with a distinct unknown category; optionally ghost the entire model.",
            [new("opacity", ParamKind.Number, "1")], p => new { opacity = Range(p, "opacity", 1, 0, 1) }),
    ];

    private static string Choice(ParamValues p, string name, string fallback, params string[] choices)
    {
        var value = p.GetText(name, fallback);
        return choices.Contains(value) ? value : throw new ArgumentException($"{name} must be one of: {string.Join(", ", choices)}");
    }

    private static double Range(ParamValues p, string name, double fallback, double min, double max)
    {
        var value = p.GetNumber(name, fallback);
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
