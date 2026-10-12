using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using BimOpenFlow.Contracts;
using BimOpenFlow.Host.Api;
using BimOpenFlow.Studio;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>TKT-210: a fresh table.aggregate wired to bim.elements offers the element table's columns
/// in its pickers before any node has run (the .bos path is empty, so bim.elements cannot load).</summary>
[TestFixture]
public sealed class DeclaredPickerTests
{
    private static SuggestionList Resolve(string param)
    {
        var registry = StudioComposition.BimPacks();
        var snapshot = Graph.Node("e", "bim.elements").Node("a", "table.aggregate")
            .Connect("e.table", "a.table").Build().Evaluate(registry);
        Assert.That(snapshot.Results.GetValueOrDefault("e")?.Status, Is.Not.EqualTo(Ara3D.DataFlowEngine.NodeStatus.Ok), "nothing has run");
        var schemas = GraphSchemas.Infer(snapshot.Document, registry, new StaticCatalog(new Dictionary<string, Schema>()))
            .Select(p => p.ToPortSchema()).ToList();
        var suggest = registry.Find("table.aggregate", 1)!.Spec.Params.Single(p => p.Name == param).Suggest!;
        return SuggestEndpoints.Resolve(snapshot, registry, "a", suggest, null, schemas: schemas);
    }

    [Test]
    public void GroupByOffersCategoryAndLevelWithTypeAndMeaning()
    {
        var list = Resolve("groupBy");
        Assert.That(list.Status, Is.EqualTo(SuggestStatus.Ok));
        var names = list.Values.Select(v => v.Value).ToList();
        Assert.That(names, Does.Contain("Category").And.Contain("Level").And.Contain("EntityIndex"));
        foreach (var name in new[] { "Category", "Level" })
        {
            var column = list.Values.Single(v => v.Value == name);
            Assert.That(column.Detail, Is.EqualTo("Text"), name);
            Assert.That(column.Meaning, Is.Not.Empty, name);
        }
    }

    [Test]
    public void AggregatesOfferFunctionsByColumnType()
    {
        var list = Resolve("aggregates");
        Assert.That(list.Values[0].Value, Is.EqualTo("*"));
        Assert.That(list.Values.Single(v => v.Value == "Elevation").Functions, Does.Contain("sum"));
        Assert.That(list.Values.Single(v => v.Value == "Category").Functions, Is.EqualTo(new[] { "count", "min", "max" }));
    }
}
