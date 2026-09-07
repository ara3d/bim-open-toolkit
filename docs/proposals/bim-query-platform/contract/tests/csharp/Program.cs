using System.Collections.Immutable;
using Ara3D.BimOpenSchema.QueryModel.Review;
using Platonic;

namespace RecordContract.CompileTests;

internal static class Program
{
    // The test shell reports outcomes; the generated model contains no IO.
    [Impure]
    public static int Main()
    {
        var snapshot = new ReferenceKey<Snapshot>("delivery-a");
        var otherSnapshot = new ReferenceKey<Snapshot>("delivery-b");
        var identity = new ReferenceKey<BimObject>("roof-17");
        var evidence = new Evidence(EvidenceOrigin.Asserted,
            ImmutableArray<SnapshotReferenceKey<SourceRecord>>.Empty,
            ImmutableArray<ReferenceKey<ReferenceSet>>.Empty,
            "compile-fixture", "Synthetic; not source evidence.");
        var absent = new Unavailable(UnavailableState.NotObserved, "No location supplied.", evidence);
        var state = new ObjectState(snapshot, identity, ObjectKind.Roof, "Roof 17",
            ObjectStateLifecycle.Existing, new Fact<LocationValue>.Missing(absent), evidence);
        var key = state.Key;
        var otherKey = new SnapshotReferenceKey<ObjectState>(otherSnapshot, identity.Value);
        var measured = new Fact<AreaValue>.Available(new AreaValue(new DecimalText("120")), Assurance.Observed, evidence);
        var missing = new Fact<AreaValue>.Missing(absent);

        if (key.SnapshotId != snapshot || key.Value != identity.Value || key == otherKey)
            throw new InvalidOperationException("Snapshot key identity was lost.");
        if (measured.Value.Amount.Text != "120" || measured.Value.Unit != "m2")
            throw new InvalidOperationException("Measurement projection changed.");
        if (missing.Detail.State != UnavailableState.NotObserved)
            throw new InvalidOperationException("Unavailable observation changed.");

#if WRONG_REFERENCE
        ReferenceKey<ReferenceSet> invalid = identity;
#endif
#if WRONG_SNAPSHOT_REFERENCE
        SnapshotReferenceKey<ObjectState> invalid = identity;
#endif

        Console.WriteLine("C# projection checks passed: typed keys, snapshot identity, available/missing facts.");
        return 0;
    }
}

#if ANALYZER_PROBE
// The negative build must report PURE002: proves Platonic is active in this project.
public sealed record AnalyzerProbe
{
    public int Value { get; set; }
}
#endif
