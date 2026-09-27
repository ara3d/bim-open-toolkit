namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// Every exception to "every node is Ok" and to the four lint checks, each with the reason
/// it is not a bug. Anything not named here is expected to be clean; a new entry needs a
/// reason a reviewer can check against the graph.
/// </summary>
public static class AllowLists
{
    public sealed record Entry(string Profile, string Id, string NodeId, string Reason);

    /// <summary>NodeStatus.EffectPending is not an allow-list entry: it is the documented
    /// behaviour of every Effect node outside a Run (PROJECT.md principle 2, "nothing writes
    /// until Run"), so every sink and writer in every sample graph is expected to sit at
    /// EffectPending, not Ok, until something calls Run. Only Error and Unready/Unavailable
    /// need a named exception below.</summary>
    public static readonly IReadOnlyList<Entry> NotOk =
    [
        new(SampleFlowsFixture.TablesProfile, "schema-error", "answer",
            "intentional: [Quantiy] is a deliberate typo demonstrating rel.filter's schema error"),
    ];

    /// <summary>No entries: a disconnected node is always a leftover from editing, and none of
    /// the sample graphs are meant to carry one. bim-level-summary's unconnected "levels" node
    /// is exactly this lint's job to catch: see the report for TKT-85, not an allow-list entry.</summary>
    public static readonly IReadOnlyList<Entry> DisconnectedNodes = [];

    /// <summary>A ranking whose small sample input already arrives in rank order. The sort
    /// states the flow's intent and changes the order on any larger model, so it stays; a sort
    /// that repeats an order its input node guarantees is removed instead.</summary>
    public static readonly IReadOnlyList<Entry> NoOpTransforms =
    [
        new(SampleFlowsFixture.BimProfile, "bim-duct-rooms", "ranked",
            "ranks duct-room overlaps by volume; the sample's few overlaps already arrive largest first"),
        new(SampleFlowsFixture.BimProfile, "bim-param-quality", "top",
            "ranks parameters by count; bim.paramCoverage promises no order, the sample's happens to match"),
        new(SampleFlowsFixture.BimProfile, "bim-room-classes", "ranked",
            "ranks room classes by room count; table.aggregate orders by class name, which matches only on this sample"),
    ];

    /// <summary>No entries: an empty final table is either a genuinely absent answer (which a
    /// graph should represent with InfoNotAvailable per PROJECT.md principle 3, not a silently
    /// empty table) or a bug in the query. None of the samples intend the empty case.</summary>
    public static readonly IReadOnlyList<Entry> EmptyFinalTables = [];

    public static bool Allows(IReadOnlyList<Entry> list, string profile, string id, string nodeId)
        => list.Any(e => e.Profile == profile && e.Id == id && e.NodeId == nodeId);
}
