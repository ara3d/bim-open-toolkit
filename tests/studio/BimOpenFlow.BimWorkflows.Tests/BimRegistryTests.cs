using BimOpenFlow.Host;
using BimOpenFlow.Nodes.BimAnalysis;
using BimOpenFlow.Studio;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>The bim profile registry positively contains every bim.* analysis kind.</summary>
[TestFixture]
public sealed class BimRegistryTests
{
    [Test]
    public void AllPacks_ContainsEveryBimAnalysisKind()
        => Assert.That(
            StudioComposition.BimPacks().Nodes.Select(n => n.Spec.Kind).ToList(),
            Is.SupersetOf(BimAnalysisNodes.All.Select(n => n.Spec.Kind)));

    [Test]
    public void BimAnalysisPack_HasTheTwelveKinds()
        => Assert.That(BimAnalysisNodes.All.Select(n => n.Spec.Kind), Is.EquivalentTo(new[]
        {
            "bim.elements", "bim.rooms", "bim.levels", "bim.bounds",
            "bim.paramTable", "bim.paramCoverage", "bim.discipline", "bim.classifyRooms",
            "bim.containment", "bim.nearest", "bim.navGraph", "bim.hops",
        }));
}
