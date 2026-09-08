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
    public void InvalidViewParametersFail(string node, string param, string value)
    {
        var scene = Node("scene").EvalTable([], ("path", "Snowdon.bos"));
        Assert.Throws<ArgumentException>(() => Node(node).EvalTable([new TableValue(scene)], (param, value)));
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
}
