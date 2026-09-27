namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// Every sample flow the host would seed into either profile, evaluated the way the host
/// evaluates it (see SampleFlowsFixture), asserted node by node and lint by lint so one
/// broken graph names itself instead of failing the whole suite. docs/sample-flows-test.md
/// explains each check and how to add an allow-list entry.
/// </summary>
[TestFixture]
public sealed class SampleFlowsTests
{
    public static IEnumerable<TestCaseData> Cases
        => SampleFlowsFixture.Cases.Select(c => new TestCaseData(c.Profile, c.Id).SetArgDisplayNames($"{c.Profile}/{c.Id}"));

    [Test]
    public void EveryProfile_SeedsAtLeastOneFlow()
    {
        foreach (var profile in SampleFlowsFixture.Profiles)
            Assert.That(SampleFlowsFixture.Profile(profile).SeededIds, Is.Not.Empty, profile);
    }

    [TestCaseSource(nameof(Cases))]
    public void EveryNode_IsOkOrAllowed(string profile, string id)
    {
        var snapshot = SampleFlowsFixture.Snapshot(profile, id);
        var bad = snapshot.Results
            .Where(r => r.Value.Status != NodeStatus.Ok
                && r.Value.Status != NodeStatus.EffectPending
                && !AllowLists.Allows(AllowLists.NotOk, profile, id, r.Key))
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}")
            .ToList();
        Assert.That(bad, Is.Empty, $"{profile}/{id}: node(s) not Ok and not allow-listed");
    }

    [TestCaseSource(nameof(Cases))]
    public void NoDisconnectedNodes(string profile, string id)
    {
        var doc = SampleFlowsFixture.Snapshot(profile, id).Document;
        var flagged = Lint.DisconnectedNodes(doc)
            .Where(nodeId => !AllowLists.Allows(AllowLists.DisconnectedNodes, profile, id, nodeId))
            .ToList();
        Assert.That(flagged, Is.Empty, $"{profile}/{id}: node(s) with no edge in a multi-node graph");
    }

    [TestCaseSource(nameof(Cases))]
    public void NoOpSortFilterLimit(string profile, string id)
    {
        var data = SampleFlowsFixture.Profile(profile);
        var snapshot = SampleFlowsFixture.Snapshot(profile, id);
        var flagged = Lint.NoOpTransforms(snapshot.Document, snapshot, data.Registry)
            .Where(nodeId => !AllowLists.Allows(AllowLists.NoOpTransforms, profile, id, nodeId))
            .ToList();
        Assert.That(flagged, Is.Empty, $"{profile}/{id}: sort/filter/limit node(s) whose output equals their input");
    }

    [TestCaseSource(nameof(Cases))]
    public void NoEmptyFinalTable(string profile, string id)
    {
        var data = SampleFlowsFixture.Profile(profile);
        var snapshot = SampleFlowsFixture.Snapshot(profile, id);
        var flagged = Lint.EmptyFinalTables(snapshot.Document, snapshot, data.Runtime)
            .Where(nodeId => !AllowLists.Allows(AllowLists.EmptyFinalTables, profile, id, nodeId))
            .ToList();
        Assert.That(flagged, Is.Empty, $"{profile}/{id}: final table node(s) with zero rows");
    }

    [TestCaseSource(nameof(Cases))]
    public void NoUnresolvedPlaceholders(string profile, string id)
    {
        var doc = SampleFlowsFixture.Snapshot(profile, id).Document;
        Assert.That(Lint.UnresolvedPlaceholders(doc), Is.Empty, $"{profile}/{id}: unresolved {{PLACEHOLDER}} in a parameter");
    }
}
