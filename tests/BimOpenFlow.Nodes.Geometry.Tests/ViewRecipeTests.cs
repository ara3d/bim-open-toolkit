using System.Text.Json;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class ViewRecipeTests
{
    private static Ara3D.DataFlowEngine.Abstractions.IFlowNode Node(string name)
        => ViewRecipeNodes.All.Single(n => n.Spec.Kind == "view3d." + name);

    [Test]
    public void CompositionRetainsSourceAndOrderWithoutMutatingInput()
    {
        var scene = Node("scene").EvalTable([], ("path", "Snowdon.bos"));
        var colored = Node("categoryStyle").EvalTable([new TableValue(scene)], ("opacity", "0.25"));
        var section = Node("section").EvalTable([new TableValue(colored)], ("axis", "x"), ("fraction", "0.4"));
        Assert.That(scene.Rows.Count, Is.EqualTo(1));
        Assert.That(colored.Rows.Count, Is.EqualTo(2));
        Assert.That(section.Rows.Count, Is.EqualTo(3));
        Assert.That(section.Cell("operation", 0), Is.EqualTo("scene"));
        Assert.That(section.Cell("operation", 1), Is.EqualTo("categoryStyle"));
        Assert.That(section.Cell("operation", 2), Is.EqualTo("section"));
        using var input = JsonDocument.Parse((string)section.Cell("input", 2)!);
        Assert.That(input.RootElement.GetProperty("fraction").GetDouble(), Is.EqualTo(.4));
    }

    [TestCase("section", "axis", "diagonal")]
    [TestCase("section", "fraction", "-0.1")]
    [TestCase("sectionBox", "fraction", "0")]
    [TestCase("sectionBox", "fraction", "1.1")]
    [TestCase("explode", "strength", "NaN")]
    [TestCase("projection", "mode", "invalid")]
    [TestCase("environment", "theme", "invalid")]
    [TestCase("categoryStyle", "opacity", "2")]
    [TestCase("categoryStyle", "palette", "invalid")]
    [TestCase("tint", "color", "red")]
    [TestCase("tint", "opacityPercent", "-1")]
    [TestCase("sectionRange", "range", "[0.9,0.2]")]
    [TestCase("sectionRange", "range", "[-0.1,0.7]")]
    [TestCase("sectionRange", "range", "[0.1,0.7,0.9]")]
    public void InvalidViewParametersFail(string node, string param, string value)
    {
        var scene = Node("scene").EvalTable([], ("path", "Snowdon.bos"));
        Assert.Catch<ArgumentException>(() => Node(node).EvalTable([new TableValue(scene)], (param, value)));
    }

    [Test]
    public void EveryOperationProducesAValidDefaultRecipe()
    {
        var scene = Node("scene").EvalTable([], ("path", "Snowdon.bos"));
        foreach (var node in ViewRecipeNodes.All.Skip(1))
        {
            var output = node.EvalTable([new TableValue(scene)]);
            Assert.That(output.Rows.Count, Is.EqualTo(2), node.Spec.Kind);
            using var input = JsonDocument.Parse((string)output.Cell("input", 1)!);
            Assert.That(input.RootElement.ValueKind, Is.EqualTo(JsonValueKind.Object));
        }
    }

    [Test]
    public void CategoryStyleDefaultsToClassicForExistingGraphs()
    {
        var scene = Node("scene").EvalTable([], ("path", "Snowdon.bos"));
        var colored = Node("categoryStyle").EvalTable([new TableValue(scene)]);
        using var input = JsonDocument.Parse((string)colored.Cell("input", 1)!);
        Assert.That(input.RootElement.GetProperty("palette").GetString(), Is.EqualTo("classic"));
        Assert.That(input.RootElement.GetProperty("opacity").GetDouble(), Is.EqualTo(1));
    }

    [TestCase("classic")]
    [TestCase("vivid")]
    [TestCase("pastel")]
    [TestCase("earth")]
    [TestCase("grayscale")]
    public void CategoryStylePreservesSelectedPaletteAndOpacity(string palette)
    {
        var scene = Node("scene").EvalTable([], ("path", "Snowdon.bos"));
        var colored = Node("categoryStyle").EvalTable([new TableValue(scene)], ("palette", palette), ("opacity", "0.25"));
        using var input = JsonDocument.Parse((string)colored.Cell("input", 1)!);
        Assert.That(input.RootElement.GetProperty("palette").GetString(), Is.EqualTo(palette));
        Assert.That(input.RootElement.GetProperty("opacity").GetDouble(), Is.EqualTo(.25));
    }

    [TestCase("0", 0)]
    [TestCase("25", .25)]
    [TestCase("100", 1)]
    public void TintConvertsDisplayPercentToRecipeFraction(string percent, double fraction)
    {
        var scene = Node("scene").EvalTable([], ("path", "Snowdon.bos"));
        var tinted = Node("tint").EvalTable([new TableValue(scene)], ("opacityPercent", percent));
        using var input = JsonDocument.Parse((string)tinted.Cell("input", 1)!);
        Assert.That(input.RootElement.GetProperty("opacity").GetDouble(), Is.EqualTo(fraction));
    }

    [TestCase("section", "fraction", 0)]
    [TestCase("sectionBox", "fraction", .01)]
    [TestCase("categoryStyle", "opacity", 0)]
    public void FractionControlsDeclarePercentDisplayAndCanonicalBounds(string node, string parameter, double minimum)
    {
        var spec = Node(node).Spec.Params.Single(p => p.Name == parameter);
        Assert.That(spec.Kind, Is.EqualTo(ParamKind.Fraction));
        Assert.That(spec.Control!.Unit, Is.EqualTo("percent"));
        Assert.That(spec.Control.Min, Is.EqualTo(minimum));
        Assert.That(spec.Control.Max, Is.EqualTo(1));
    }
}
